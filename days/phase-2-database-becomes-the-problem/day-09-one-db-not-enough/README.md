# Day 09 — When One Database Is No Longer Enough

> 🔗 **LinkedIn Discussion**: [Read & Discuss on LinkedIn](https://www.linkedin.com/in/himanshu-verma-822a07286/)  
> 🏛️ **System Architecture Milestone**: [`v3-cached-data`](../../../system-evolution/v3-cached-data/README.md)

---

## The Problem

On Day 07, we scaled read traffic by deploying streaming read replicas with PgBouncer. On Day 08, we introduced an in-memory Redis caching tier, intercepting 85% of repetitive read queries before they ever reached SQL execution.

Our read path is now fast and horizontally scalable. However, **ShopScale** has hit an entirely different, more intractable bottleneck: **the write path and total storage capacity.**

Over the past 12 months:
* Daily orders increased from **5,000 to 750,000 orders per day**.
* The `orders` and `order_items` tables have grown to **1.2 billion rows** totaling **6.8 TB** of data on disk.
* Every order placement, payment update, inventory reservation, and shipment status update is an `INSERT` or `UPDATE`.
* **Neither read replicas nor Redis caches can absorb write traffic.** Every mutation must ultimately commit to the single PostgreSQL primary database host.

Our primary database node is in severe distress:

1. **Write Throughput Ceiling**: The primary database is sustaining **18,000 write operations/second**. Even on high-end NVMe storage provisioned for 64,000 IOPS, Write-Ahead Log (WAL) flushing and random page writes consume 95% of available I/O bandwidth.
2. **Buffer Pool Eviction Thrashing**: Total table and index data (6.8 TB) vastly exceeds system RAM (512 GB). Working dataset B-Tree indexes no longer fit in PostgreSQL `shared_buffers`. Every single write requires swapping index pages from disk to memory, driving query latencies from 8ms to 850ms+.
3. **Operational Impossibility**: 
   * A full database backup (`pg_dump` or filesystem snapshot) takes over 14 hours and degrades live transaction performance.
   * Autovacuum cannot keep up with dead tuple generation on a 1-billion-row table, leading to massive table bloat.
   * Restoring from a backup in a disaster recovery scenario (Recovery Time Objective / RTO) would take over 24 hours of total downtime.

```text
       40,000 Read Req/sec                 18,000 Write Mutations/sec
      (Absorbed by Redis & Replicas)         (ALL Hit Single Primary)
                  │                                     │
                  │                                     ▼
                  │                        ┌──────────────────────────────┐
                  │                        │  Single PostgreSQL Primary   │
                  │                        ├──────────────────────────────┤
                  │                        │ 💥 6.8 TB Table + Index Data │
                  │                        │ 💥 RAM (512 GB) Outgrown     │
                  │                        │ 💥 Disk IOPS Maxed Out       │
                  │                        │ 💥 Vacuum & Backups Failing  │
                  ▼                        └──────────────┬───────────────┘
        ┌───────────────────┐                             │
        │ Redis + Replicas  │                             │ (Replication Lag Spikes)
        │ (Healthy at 25%)  │                             ▼
        └───────────────────┘              ┌──────────────────────────────┐
                                           │   Read Replicas (Falling Behind)
                                           └──────────────────────────────┘
```

We have reached the physical and architectural limit of a single database machine. We must horizontally partition our data across multiple independent database instances.

---

## Why the Simple Approach Breaks

When a database becomes too large for a single host, teams often try three intuitive workarounds. Under sustained scale, all three fail.

```text
                  [ Monolithic DB at Storage/Write Limit (6.8 TB) ]
                                          │
        ┌─────────────────────────────────┼─────────────────────────────────┐
        ▼                                 ▼                                 ▼
┌─────────────────────────┐   ┌─────────────────────────┐   ┌─────────────────────────┐
│ 1. Bigger Cloud Server  │   │ 2. Functional Splitting │   │ 3. In-Database Table    │
│    (Vertical Scaling)   │   │    (Split by Domain)    │   │    Partitioning         │
├─────────────────────────┤   ├─────────────────────────┤   ├─────────────────────────┤
│ • Hits hardware ceiling │   │ • Buys temporary time   │   │ • Organizes data pages  │
│ • Exponential cost      │   │ • The 'orders' table    │   │ • Still constrained by  │
│ • Single point of write │   │   still exceeds a       │   │   single machine CPU,   │
│   failure remains       │   │   single machine        │   │   disk IOPS, & RAM      │
└─────────────────────────┘   └─────────────────────────┘   └─────────────────────────┘
```

### 1. Vertical Scaling (Bigger Hardware) Hits a Hard Ceiling
Upgrading from a 32-vCPU / 128 GB RAM instance to an AWS `db.r6i.32xlarge` (128 vCPUs, 1,024 GB RAM) costs over $14,000/month. Yet write throughput only improves by ~30%. 

Why? Because relational write bottlenecks are fundamentally bound by **WAL synchronization locks**, sequential disk flush latencies, and row-level locking contention. Furthermore, once you reach the largest cloud instance type available, there is no bigger box to buy.

### 2. Functional Splitting (Separating Tables by Service)
A common second step is separating domain tables into distinct databases:
* `db-auth` for `users` and `credentials`
* `db-catalog` for `products` and `inventory`
* `db-orders` for `orders` and `order_items`

This buys temporary breathing room by distributing total connections and I/O across three hosts. However, it does not solve the fundamental problem: **within 6 months, the `orders` database alone outgrows a single machine.** Functional splitting cannot scale a single hyper-growth entity.

### 3. Native Single-Database Table Partitioning
PostgreSQL and MySQL provide native declarative table partitioning (e.g., partitioning `orders` by `PARTITION BY RANGE (created_at)` into monthly tables).

While this improves query performance (partition pruning) and makes archival trivial (`DROP TABLE orders_2024_01`), **all partitions still reside on the exact same physical machine**. Every partition shares the same underlying CPU, disk controller, memory bus, and WAL engine. It solves data lifecycle management, not physical write and storage scalability.

To scale beyond a single physical host, we must embrace **Horizontal Database Sharding**.

---

## Understanding the Problem

Horizontal database sharding is fundamentally different from read replication and in-database partitioning.

---

### Partitioning vs. Sharding: The Architectural Boundary

The industry often blurs these terms, but their architectural implications are radically different:

| Dimension | Native Table Partitioning | Horizontal Database Sharding |
|---|---|---|
| **Physical Topology** | Single database server (or primary + replicas) | Multiple independent, uncoordinated database servers |
| **Storage Architecture** | Shared storage / Shared disk controller | **Shared-Nothing Architecture** |
| **Cross-Partition ACID** | Full ACID transactions supported natively | **No cross-shard ACID** without distributed 2PC/Sagas |
| **Foreign Keys & Joins** | Supported across partitions by the SQL engine | **Impossible** across shards at the database engine level |
| **Routing Responsibility** | Handled transparently by PostgreSQL query planner | Handled by application code, client drivers, or proxy routers |
| **Scalability Bottleneck** | Physical limits of a single machine's CPU, RAM, & IOPS | Near-linear horizontal scale across N machines |

```text
Native Table Partitioning (Single Host):
┌──────────────────────────────────────────────────────────┐
│                   Single PostgreSQL Host                 │
│  ┌───────────────────┐ ┌───────────────────┐             │
│  │ orders_2025_01    │ │ orders_2025_02    │ ...         │
│  └─────────┬─────────┘ └─────────┬─────────┘             │
│            └──────────────┬──────┘                       │
│                           ▼                              │
│             Shared CPU, RAM, Disk Controller             │
└──────────────────────────────────────────────────────────┘

Horizontal Database Sharding (Shared-Nothing Multi-Host):
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│ Shard 01 (Host)  │  │ Shard 02 (Host)  │  │ Shard 03 (Host)  │
│ Independent CPU  │  │ Independent CPU  │  │ Independent CPU  │
│ Independent RAM  │  │ Independent RAM  │  │ Independent RAM  │
│ Independent Disk │  │ Independent Disk │  │ Independent Disk │
└──────────────────┘  └──────────────────┘  └──────────────────┘
```

---

### The Fundamental Rule of Sharding: Shared-Nothing

In a **Shared-Nothing Architecture**, each shard is a completely autonomous database server with its own CPU, memory, and persistent storage. 

* **Shard 01** has no awareness that **Shard 02** exists.
* There is no shared storage, no shared network buffer pool, and no central lock manager.
* A client application wanting to read or write data must compute which shard holds that record using a deterministic mathematical function:

```text
Target Shard = f(Shard Key)
```

---

### What Breaks the Moment You Shard

The moment your data is distributed across multiple autonomous database instances, **the relational model breaks down**:

1. **No Cross-Shard Foreign Keys**: PostgreSQL cannot enforce referential integrity between `order_items` on Shard 02 and `products` on Shard 01. Foreign key constraints must be handled by application validation or abandoned.
2. **No Cross-Shard Joins**: You cannot execute `SELECT * FROM orders o JOIN users u ON o.user_id = u.id` if orders and users live on different hosts. Joins must be executed in application memory (fetching records from both shards and stitching them together).
3. **No Cross-Shard ACID Transactions**: A transaction updating two rows located on different physical shards cannot rely on PostgreSQL `BEGIN ... COMMIT`. It requires distributed consensus protocols (Two-Phase Commit / 2PC) or asynchronous Saga patterns.
4. **Scatter-Gather Queries**: Any query that does not include the Shard Key in its `WHERE` clause must be broadcast to **every single shard in the cluster**. The application must collect, merge, sort, and paginate the partial results in memory.

---

## Possible Approaches to Sharding

How an application maps records to physical shards defines the entire behavior, operational complexity, and performance characteristics of the system.

```mermaid
flowchart TD
    subgraph Pattern1["1. Range-Based Sharding"]
        direction TB
        R_App[Application Request] --> R_Router[Range Router]
        R_Router -->|ID 1 - 1,000,000| R_S1[(Shard 1)]
        R_Router -->|ID 1,000,001 - 2,000,000| R_S2[(Shard 2)]
        R_Router -->|ID 2,000,001+| R_S3[(Shard 3 - Hotspot!)]
    end

    subgraph Pattern2["2. Hash-Based Sharding"]
        direction TB
        H_App[Application Request] --> H_Hash["hash(Key) % N"]
        H_Hash -->|Hash % 3 == 0| H_S1[(Shard 1)]
        H_Hash -->|Hash % 3 == 1| H_S2[(Shard 2)]
        H_Hash -->|Hash % 3 == 2| H_S3[(Shard 3)]
    end

    subgraph Pattern3["3. Directory / Lookup Table"]
        direction TB
        D_App[Application Request] --> D_Map[(Directory Service / Redis)]
        D_Map -->|Lookup: User 42 -> Shard 2| D_S2[(Shard 2)]
        D_Map -.->|Lookup: Tenant Nike -> Shard 4| D_S4[(Shard 4)]
    end
```

---

### 1. Range-Based Sharding

Data is partitioned into contiguous ranges based on the shard key value (e.g., date ranges, numerical ID ranges, or alphabetical ranges).

* **How It Works**: 
  * Orders with IDs `1` to `10,000,000` → Shard 01
  * Orders with IDs `10,000,001` to `20,000,000` → Shard 02
  * Orders created in `2024` → Shard 2024
* **Where It Helps**: Range queries are exceptionally efficient. Running `SELECT * FROM orders WHERE created_at BETWEEN '2024-01-01' AND '2024-01-31'` targets a single physical shard.
* **Limitations**: **Severe Write Hotspots.** In e-commerce, 99% of all write operations occur on current, active data. If you shard by date or auto-incrementing ID, **100% of all incoming writes slam into the single shard handling the latest range**, leaving older shards completely idle.
* **When It Makes Sense**: Time-series metrics, telemetry, and append-only audit archives where older data is read-only and queries predominantly target bounded historical intervals.

---

### 2. Hash-Based Sharding (Algorithmic / Modulo)

Data is distributed uniformly across N physical shards by applying a deterministic cryptographic or non-cryptographic hash function (e.g., MurmurHash3, MD5, CRC32) to the shard key, modulo the number of shards.

```text
Shard ID = MurmurHash3(Shard Key) % N
```

* **How It Works**: The application hashes the key (e.g., `user_id = 48291`), gets a 32-bit integer, computes modulo N, and routes the query directly to that shard instance.
* **Where It Helps**: **Uniform Data and Write Distribution.** Randomizes data placement across all nodes, preventing sequential write hotspots. Every shard receives roughly `1/N` of total system writes.
* **Limitations**:
  1. **Range Scans Become Scatter-Gather**: Fetching a range of IDs requires querying every shard simultaneously.
  2. **Rebalancing Nightmare with Naive Modulo**: If you have 4 shards and add a 5th shard, the formula changes from `hash % 4` to `hash % 5`. **Over 80% of all existing keys must move to a different physical shard**, causing massive data reshuffling.
* **When It Makes Sense**: High-throughput OLTP systems with random access patterns where uniform write distribution is the top priority.

---

### 3. Directory-Based (Lookup Table) Sharding

An external routing service or high-speed lookup table (stored in a dedicated database or Redis cluster) maintains an explicit mapping between each entity's Shard Key and its current physical Shard ID.

```text
Mapping Store: {
  "user_1042":   "shard_03",
  "user_1043":   "shard_01",
  "tenant_nike": "shard_vip_01"
}
```

* **How It Works**: Every request first consults the directory service to resolve the target shard connection string, then connects to the shard to execute SQL.
* **Where It Helps**: **Extreme Flexibility.** Moving a user or tenant from Shard 01 to Shard 04 requires updating a single entry in the directory. Perfect for isolating massive enterprise accounts ("VIP tenants") onto dedicated hardware.
* **Limitations**:
  * **Extra Network Hop**: Adds latency to every database query unless aggressively cached at the application tier.
  * **Critical Single Point of Failure**: If the directory database crashes or corrupts its lookup table, the entire platform goes dark.
* **When It Makes Sense**: Multi-tenant B2B SaaS platforms where individual tenant sizes vary wildly.

---

## Comparison of Sharding Strategies

| Strategy | Write Distribution | Range Query Efficiency | Cluster Resizing / Rebalancing | Operational Complexity |
|---|---|---|---|---|
| **Range-Based** | Poor (Constant Hotspots) | Excellent (Single shard) | Simple (Add new range shard) | Low |
| **Hash-Based** | Excellent (Evenly distributed) | Poor (Scatter-Gather) | High (Requires Consistent Hashing) | Medium |
| **Directory-Based** | Highly Configurable | Poor (Scatter-Gather) | Seamless (Update pointer in lookup) | High (SPOF Risk) |

---

## Choosing a Shard Key: The Most Irreversible Decision

> [!CAUTION]
> Changing a shard key on a multi-terabyte production database requires rebuilding the entire cluster from scratch while running dual-writes. **You must get this right on day one.**

An effective shard key satisfies three non-negotiable criteria:
1. **High Cardinality**: The key must have millions of distinct values. Sharding by `country_code` or `status` produces only a handful of distinct values, limiting your cluster to that number of shards.
2. **Uniform Write Distribution**: The key must distribute mutations evenly across time. Avoid timestamps, dates, or monotonically increasing sequential sequences.
3. **Query Colocation (Access Pattern Alignment)**: The shard key must be present in the vast majority of your critical queries, allowing them to route to a single shard.

---

### Evaluating Shard Keys for ShopScale

Let's evaluate three potential shard keys for **ShopScale**'s `orders` and `order_items` tables:

```text
                                [ Choose Shard Key ]
                                          │
             ┌────────────────────────────┼────────────────────────────┐
             ▼                            ▼                            ▼
      Option A: order_id           Option B: user_id           Option C: merchant_id
┌───────────────────────────┐┌───────────────────────────┐┌───────────────────────────┐
│ • Perfectly uniform write ││ • Colocates all user data ││ • Perfect for merchant B2B│
│   distribution            ││ • User order history hits ││   dashboards              │
│ • "Find User 42 Orders"   ││   a SINGLE shard          ││ • 💥 NIKE flash sale hits │
│   must scatter-gather to  ││ • Looking up by order_id  ││   ONE shard               │
│   ALL 16 shards! 💥       ││   requires secondary index││ • Massive Skew (Celebrity)│
└───────────────────────────┘└───────────────────────────┘└───────────────────────────┘
```

#### Option A: Sharding by `order_id`
* **Advantage**: Perfect, uniform write distribution. Each order lands on a random shard.
* **Fatal Flaw**: When a user visits their account page (`GET /api/users/42/orders`), the query does not contain `order_id`. The application must issue queries to **all 16 shards**, wait for all 16 to respond, merge the results, sort by date, and return the top 10. A single slow shard degrades the entire user experience.

#### Option B: Sharding by `user_id` (Customer ID)
* **Advantage**: **High query colocation.** All orders, order items, shipping addresses, and cart data for User #42 reside on the exact same physical shard.
  * User checkout executes as a **local, single-shard ACID transaction**.
  * User order history queries hit exactly **one shard**.
* **Trade-off**: When an operations manager searches for `order_id = 998241`, the query lacks `user_id`. We must maintain a secondary global lookup table (`order_id -> user_id`) to route the query without scatter-gathering.

#### Option C: Sharding by `merchant_id` (Seller ID)
* **Advantage**: Great for B2B dashboards where merchants manage their own catalog and orders.
* **Fatal Flaw: The Celebrity / Whale Problem.** A boutique seller receives 5 orders a day; a mega-brand like Apple or Nike receives 200,000 orders an hour. Shard 04 (hosting Nike) melts down under 100% CPU, while Shard 02 sits at 1% utilization.

> [!IMPORTANT]
> **ShopScale Decision**: We select **`user_id`** as our primary shard key for customer-facing order processing, paired with a global secondary lookup cache (`order_id -> user_id`) stored in Redis.

---

## The Celebrity Problem: Hot Partitions & Skew

Even with hash-based sharding, real-world data is rarely uniform. When an entity receives disproportionately massive traffic, it creates a **Hot Partition**.

```text
  Incoming Traffic: 50,000 req/sec
  -------------------------------------------------------------
  45,000 req/sec target "Merchant: SuperStore" (Whale)
   5,000 req/sec distributed across 10,000 small sellers

  Shard 01: [ Small Sellers ] ➔ CPU:  4%   | Disk IOPS:   150
  Shard 02: [ Small Sellers ] ➔ CPU:  6%   | Disk IOPS:   210
  Shard 03: [ SuperStore    ] ➔ CPU: 99% 💥| Disk IOPS: 64,000 (SATURATED!)
  Shard 04: [ Small Sellers ] ➔ CPU:  3%   | Disk IOPS:   120
```

### Mitigations for Hot Partitions

1. **Key Salting (Compounded Shard Key)**:
   For hyper-hot entities, append a pseudo-random salt to distribute their records across multiple shards:
   ```python
   compound_shard_key = f"{merchant_id}_{random.randint(0, 3)}"
   ```
   Writes are distributed across 4 shards. Reads must query all 4 salted sub-partitions and aggregate results, trading read latency for write survival.
2. **Dedicated VIP Shards**:
   Identify high-volume tenants through metrics. Using directory-based routing, assign the mega-tenant to an isolated, dedicated database cluster sized specifically for their workload, completely isolating normal tenants from their noisy neighbors.

---

## Cluster Resizing: The Rebalancing Challenge

What happens when your 4-shard cluster runs out of capacity and you must expand to 8 shards?

### Why Naive Modulo Fails
If your routing logic is:
```text
Shard ID = hash(key) % 4
```
When expanding to 8 shards, the formula becomes `Shard ID = hash(key) % 8`.
* A key with hash `12`: `12 % 4 = 0` → `12 % 8 = 4` (Must Move)
* A key with hash `13`: `13 % 4 = 1` → `13 % 8 = 5` (Must Move)
* **Result**: **87.5% of all existing records in the entire database must be physically migrated across the network.** Performing this on a live production database causes hours of downtime or severe performance degradation.

---

### Modern Solution 1: Consistent Hashing with Virtual Nodes

Instead of a fixed modulo, the hash space is organized as an abstract ring from `0` to `2^32 - 1`.

```mermaid
flowchart LR
    Ring((Consistent Hash Ring<br/>0 to 2^32 - 1))
    
    NodeA["Shard A (Tokens: 100, 500)"]
    NodeB["Shard B (Tokens: 250, 750)"]
    NodeC["Shard C (Tokens: 400, 900)"]
    
    Key1["Key X (Hash: 210)"] -.->|Maps Clockwise| NodeB
    Key2["Key Y (Hash: 450)"] -.->|Maps Clockwise| NodeA
```

* Shards are assigned multiple positions ("virtual nodes") on the ring.
* A key's hash places it on the ring; it is assigned to the next clockwise shard node.
* **When a new shard is added, it only takes keys from its immediate neighbors.** Only `1/N` of the total dataset moves across the network, leaving `(N-1)/N` of the cluster completely untouched.

---

### Modern Solution 2: Fixed Virtual Buckets (Pre-Sharding)

This is the battle-tested pattern used by systems like Redis Cluster, DynamoDB, and Couchbase:

1. Divide the system into a **large, fixed number of logical buckets** (e.g., exactly **1,024 virtual buckets**), regardless of how many physical machines you have.
2. The shard key always maps to a bucket:
   ```text
   Bucket ID = MurmurHash3(user_id) % 1024
   ```
3. A lightweight mapping table assigns ranges of buckets to physical database hosts:
   * **Host A**: Buckets `0` to `255`
   * **Host B**: Buckets `256` to `511`
   * **Host C**: Buckets `512` to `767`
   * **Host D**: Buckets `768` to `1023`
4. **Expanding the Cluster**: When you add **Host E**, you simply reassign buckets `768` to `895` from Host D to Host E. The hashing algorithm never changes; only bucket-to-host pointers change in the routing configuration.

---

## Trade-offs: What We Gain and What We Give Up

```text
               Single Central Database                     Horizontally Sharded Cluster
┌───────────────────────────────────────────────────┐┌───────────────────────────────────────────────────┐
│ • Strict Global ACID Guarantees                   ││ • Shared-Nothing Physical Scalability             │
│ • Seamless Relational Joins & Foreign Keys        ││ • Independent Disk IOPS & Compute per Shard       │
│ • Simple Single-Connection Application Code       ││ • Infinite Horizontal Storage Ceiling             │
│ • Trivial Backups & Consistent Snapshots          ││ • Blast Radius Containment (One shard dies,       │
│ • Hard Physical Ceilings on IOPS, RAM, and Writes ││   only 1/N of users affected)                     │
│ • Outages Bring Down 100% of Users                ││ • 💥 No Cross-Shard Joins or Foreign Keys         │
│                                                   ││ • 💥 Complex Scatter-Gather Query Overhead        │
│                                                   ││ • 💥 Extreme Operational & Rebalancing Cost       │
└───────────────────────────────────────────────────┘└───────────────────────────────────────────────────┘
```

---

## A Practical Example: ShopScale Sharded Architecture

Let's design and implement a production-grade sharded database layer for **ShopScale** using PostgreSQL and Python/SQLAlchemy.

---

### 1. Cluster Topology

```mermaid
flowchart TD
    Client([HTTP Clients / Web]) --> LB[Load Balancer]
    LB --> App[FastAPI Application Node]

    subgraph RoutingTier["Application Routing Tier"]
        App --> Router[Smart Shard Router]
        Router --> GlobalIndex[(Global Secondary Index<br/>Redis: order_id -> user_id)]
    end

    subgraph PhysicalStorageTier["Shared-Nothing PostgreSQL Shards"]
        Router -->|user_id % 3 == 0| Shard0[(Shard 0 - Host A<br/>orders, items, balances)]
        Router -->|user_id % 3 == 1| Shard1[(Shard 1 - Host B<br/>orders, items, balances)]
        Router -->|user_id % 3 == 2| Shard2[(Shard 2 - Host C<br/>orders, items, balances)]
    end

    classDef route fill:#fff3e0,stroke:#e65100,stroke-width:2px;
    classDef shard fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px;
    class Router,GlobalIndex route;
    class Shard0,Shard1,Shard2 shard;
```

---

### 2. Production Shard Router Implementation (Python / SQLAlchemy)

This implementation demonstrates:
1. **Virtual Bucket Hashing** using MurmurHash3.
2. **Single-Shard Routing** for operations providing `user_id`.
3. **Secondary Index Lookup** for operations querying by `order_id`.
4. **Parallel Scatter-Gather** with bounded timeouts for cross-shard analytical searches.

```python
import mmh3
import concurrent.futures
from typing import List, Dict, Any, Optional
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, Session
import redis

# Configuration: 1,024 Virtual Buckets mapped across 3 Physical Database Hosts
NUM_VIRTUAL_BUCKETS = 1024

SHARD_CONFIG = {
    "shard_0": "postgresql://app:pass@shard0.internal.shopscale.net:5432/shopscale_0",
    "shard_1": "postgresql://app:pass@shard1.internal.shopscale.net:5432/shopscale_1",
    "shard_2": "postgresql://app:pass@shard2.internal.shopscale.net:5432/shopscale_2",
}

class ShardedDatabaseRouter:
    def __init__(self):
        # 1. Initialize independent connection pools for each physical shard host
        self.shard_engines = {
            shard_id: create_engine(url, pool_size=20, max_overflow=5, pool_timeout=5)
            for shard_id, url in SHARD_CONFIG.items()
        }
        self.session_factories = {
            shard_id: sessionmaker(bind=engine)
            for shard_id, engine in self.shard_engines.items()
        }
        
        # 2. Global secondary index store (Redis) to map order_id -> user_id
        self.global_index = redis.Redis(
            host="redis-index.internal.shopscale.net", 
            port=6379, 
            decode_responses=True,
            socket_timeout=0.2
        )

        # 3. Static routing map: Assign virtual bucket ranges to physical shards
        self.bucket_to_shard = {}
        for bucket in range(NUM_VIRTUAL_BUCKETS):
            if bucket < 341:
                self.bucket_to_shard[bucket] = "shard_0"
            elif bucket < 682:
                self.bucket_to_shard[bucket] = "shard_1"
            else:
                self.bucket_to_shard[bucket] = "shard_2"

    def get_shard_for_user(self, user_id: int) -> str:
        """Deterministic Shard Resolution via Consistent MurmurHash3 Virtual Bucketing."""
        # Compute unsigned 32-bit hash
        hash_val = mmh3.hash(str(user_id), signed=False)
        bucket_id = hash_val % NUM_VIRTUAL_BUCKETS
        return self.bucket_to_shard[bucket_id]

    def create_order(self, user_id: int, order_id: int, total_amount: float) -> Dict[str, Any]:
        """Single-Shard Write: Executes as a fast, local ACID transaction on target shard."""
        target_shard = self.get_shard_for_user(user_id)
        session: Session = self.session_factories[target_shard]()
        
        try:
            # 1. Insert order locally
            session.execute(
                text("INSERT INTO orders (id, user_id, total_amount, status) VALUES (:id, :uid, :amt, 'PENDING')"),
                {"id": order_id, "uid": user_id, "amt": total_amount}
            )
            session.commit()

            # 2. Update global secondary index (order_id -> user_id)
            self.global_index.set(f"order_idx:{order_id}", str(user_id), ex=86400 * 30)

            return {"order_id": order_id, "shard": target_shard, "status": "CREATED"}
        except Exception as e:
            session.rollback()
            raise RuntimeError(f"Order creation failed on {target_shard}: {e}")
        finally:
            session.close()

    def get_order_by_id(self, order_id: int) -> Optional[Dict[str, Any]]:
        """
        Resolves query by order_id WITHOUT scatter-gathering across all shards
        by consulting the Global Secondary Index.
        """
        # Step 1: Query global index to find user_id
        user_id_str = self.global_index.get(f"order_idx:{order_id}")
        if not user_id_str:
            # If not in cache, fallback to scatter-gather across all shards
            return self._scatter_gather_order_lookup(order_id)

        user_id = int(user_id_str)
        target_shard = self.get_shard_for_user(user_id)

        # Step 2: Query single target shard directly
        session: Session = self.session_factories[target_shard]()
        try:
            row = session.execute(
                text("SELECT id, user_id, total_amount, status FROM orders WHERE id = :oid"),
                {"oid": order_id}
            ).mappings().fetchone()
            return dict(row) if row else None
        finally:
            session.close()

    def _scatter_gather_order_lookup(self, order_id: int) -> Optional[Dict[str, Any]]:
        """
        Fallback Scatter-Gather: Executes concurrent queries across all shards.
        Warning: High resource consumption; only used when index is cold.
        """
        def query_shard(shard_name: str):
            s = self.session_factories[shard_name]()
            try:
                res = s.execute(
                    text("SELECT id, user_id, total_amount, status FROM orders WHERE id = :oid"),
                    {"oid": order_id}
                ).mappings().fetchone()
                return dict(res) if res else None
            finally:
                s.close()

        with concurrent.futures.ThreadPoolExecutor(max_workers=len(self.shard_engines)) as executor:
            future_to_shard = {
                executor.submit(query_shard, shard): shard 
                for shard in self.shard_engines.keys()
            }
            for future in concurrent.futures.as_completed(future_to_shard, timeout=2.0):
                result = future.result()
                if result:
                    # Cancel remaining futures and populate global index for next time
                    self.global_index.set(f"order_idx:{order_id}", str(result["user_id"]), ex=86400 * 30)
                    return result
        return None
```

---

## Failure Scenarios

Operating a sharded cluster introduces distributed failure modes that never exist in a single-instance database.

```text
                                  [ Sharded Cluster ]
                                           │
         ┌─────────────────────────────────┼─────────────────────────────────┐
         ▼                                 ▼                                 ▼
┌─────────────────────────┐   ┌─────────────────────────┐   ┌─────────────────────────┐
│ 1. Scatter-Gather Tail  │   │ 2. Partial Outages &    │   │ 3. Index/Shard Drift    │
│    Latency Explosion    │   │    Cluster Inconsistency│   │    (Split-State)        │
├─────────────────────────┤   ├─────────────────────────┤   ├─────────────────────────┤
│ One slow shard blocks   │   │ Shard 2 crashes. 33% of │   │ Secondary index points  │
│ the entire aggregated   │   │ users cannot log in or  │   │ to Shard 1, but record  │
│ customer query          │   │ place orders            │   │ was migrated to Shard 2 │
└─────────────────────────┘   └─────────────────────────┘   └─────────────────────────┘
```

---

### 1. The Scatter-Gather Tail Latency Explosion
* **What Happens**: A user searches for an order without specifying a date or user filter, triggering a scatter-gather query across 32 shards.
* **Impact**: If each shard has a P99 latency of 15ms, the overall P99 latency of the scatter-gather request is:
```text
P(All 32 shards respond within 15ms) = 0.99^32 ≈ 72.5%
```
  **There is a 27.5% probability that the user's request will take significantly longer than 15ms.** The slowest shard dictates the user's experience.
* **Mitigation**:
  * Enforce mandatory shard key filters on public search endpoints.
  * Offload full-text and multi-attribute search queries to a dedicated search index (e.g., Elasticsearch / Meilisearch) rather than querying sharded relational databases.

---

### 2. Partial Cluster Outage & Unequal Availability
* **What Happens**: Shard 02 suffers a primary host crash. Automated failover takes 45 seconds to promote a replica.
* **Impact**: Unlike a monolithic database where a crash takes down 100% of the platform:
  * Users mapped to Shard 00 and Shard 01 (66% of traffic) experience **zero downtime**.
  * Users mapped to Shard 02 (33% of traffic) experience **total failure**.
* **Mitigation**:
  * Build application interfaces to fail gracefully per user session (e.g., displaying "Order history temporarily unavailable" rather than an unhandled 500 server error).
  * Maintain High Availability (HA) standby replicas for **every individual shard**.

---

### 3. Cross-Shard Foreign Key Drift & Orphaned Rows
* **What Happens**: A user record is deleted on Shard 00, but their related historical order records live on Shard 02 (or vice versa in poorly colocated architectures).
* **Impact**: Because physical database engines cannot maintain foreign keys across network boundaries, orphaned data accumulates silently, causing application crashes during deserialization.
* **Mitigation**:
  * Colocate child entities on the **exact same shard** as their parent (e.g., `order_items` always share the same `user_id` and shard as `orders`).
  * Implement background data reconciliation workers to identify and purge orphaned records across shards.

---

## Key Engineering Decisions

Before embarking on database sharding, evaluate your system against this decision ladder:

```text
                           ┌──────────────────────────────┐
                           │ Database Saturated?          │
                           └──────────────┬───────────────┘
                                          │
                                          ▼
                           ┌──────────────────────────────┐
                           │ Have you optimized queries,  │
                           │ added indexes, and PgBouncer?│
                           └──────────────┬───────────────┘
                                          │ YES
                                          ▼
                           ┌──────────────────────────────┐
                           │ Have you added Read Replicas │
                           │ and an in-memory Redis cache?│
                           └──────────────┬───────────────┘
                                          │ YES
                                          ▼
                           ┌──────────────────────────────┐
                           │ Is the write volume or data  │
                           │ size still exceeding 1 host? │
                           └──────┬───────────────┬───────┘
                                  │               │
                         NO       │               │       YES
                 ┌────────────────┘               └────────────────┐
                 ▼                                                 ▼
┌────────────────────────────────┐               ┌────────────────────────────────┐
│ Stop! Do NOT Shard.            │               │ Shard by High-Cardinality Key  │
│ Continue with vertical scaling │               │ (Virtual Buckets / Consistent  │
│ or functional DB splitting.    │               │ Hash + Global Secondary Index) │
└────────────────────────────────┘               └────────────────────────────────┘
```

1. **Exhaust Every Alternative First**: Sharding is the most complex architectural transition a team can undertake. Only shard when you have maxed out indexing, connection pooling, read replicas, caching, and vertical instance upgrades.
2. **Prioritize Query Colocation Over Write Uniformity**: Choose a shard key that colocates the vast majority of your transactions and queries on a single node (e.g., `user_id`), even if it requires secondary indexes to handle occasional reverse lookups.
3. **Use Fixed Virtual Buckets for Rebalancing**: Never use raw modulo hashing (`hash % N`). Use fixed virtual buckets (e.g., 1024 buckets) from day one so you can add physical nodes by simply transferring bucket ranges.
4. **Isolate Shard Metadata**: Do not hardcode shard connection strings in application configuration. Use a dynamic service registry or configuration manager to update shard allocations without redeploying code.

---

## Key Takeaways

1. **Sharding scales writes and storage, not reads.** Read scalability is solved by replicas and caches. Sharding is the solution for when write IOPS, WAL limits, and multi-terabyte table sizes exceed a single machine.
2. **Sharding breaks the relational model.** Foreign keys across shards disappear, cross-shard joins become impossible, and multi-shard transactions require distributed coordination.
3. **Choosing a shard key is irreversible.** A great shard key balances high cardinality, uniform write distribution, and query colocation. Getting this wrong requires a complete system re-architecture.
4. **Never shard with raw modulo arithmetic.** Always implement consistent hashing or fixed virtual buckets to avoid migrating 80%+ of your data whenever you add a new node.
5. **Scatter-gather queries kill tail latency.** Always maintain global secondary index lookups for high-frequency queries that cannot supply the shard key.

---

### 🧭 Navigation & Next Steps
* Read the previous guide: **[Day 08 — Caching Is Easy Until It Isn't](../day-08-caching-easy-until-not/README.md)**
* Read the next guide: **[Day 10 — Moving Data Without Breaking Consistency](../day-10-data-without-breaking-consistency/README.md)**
* View the architecture milestone: [`v3-cached-data`](../../../system-evolution/v3-cached-data/README.md)

# Day 03 — The First 1,000 Users: What Breaks First?

> 🔗 **LinkedIn Discussion**: [Read & Discuss on LinkedIn](https://www.linkedin.com/in/himanshu-verma-822a07286/)  
> 🏛️ **System Architecture Milestone**: [`v1-monolith`](../../../system-evolution/v1-monolith/README.md)

---

## The Problem

On Day 01, we launched **ShopScale** as a single-process Modular Monolith (`v1-monolith`) backed by a PostgreSQL database on a single virtual server (2 vCPUs, 4 GB RAM, single SSD block storage). On Day 02, we established how to measure system metrics—decomposing scale into throughput, latency percentiles, and capacity limits.

For the first few weeks, the application ran smoothly with zero operational issues. Then marketing launched a featured campaign. 

Within minutes, traffic scales from a baseline of 5 active concurrent users to **1,000 active concurrent users**. Suddenly, the application monitoring dashboard lights up with alerts:

- **P99 Latency** explodes from **35ms** to **14,200ms**.
- Users attempting to place orders or load product pages receive HTTP `500 Internal Server Error` or HTTP `504 Gateway Timeout` pages.
- The single server CPU spikes to 100%, while application logs flood with `dial tcp 127.0.0.1:5432: connect: connection refused` and `socket: too many open files`.

```text
[ Baseline Traffic: 5 Users ]          [ Spiked Traffic: 1,000 Users ]
Single App Server (2 vCPU, 4GB RAM)    Single App Server (2 vCPU, 4GB RAM)
├── CPU: 4%                            ├── CPU: 100% (Saturated)
├── RAM: 450 MB                        ├── RAM: 3.8 GB (Near OOM)
├── DB Conns: 3                        ├── DB Conns: Max Exceeded (Failed)
└── Latency: 25ms                      └── Latency: 14,200ms (Crashing)
```

When an application fails under initial traffic growth, engineers often default to vague statements like *"the server overloaded"* or *"the monolith can't scale."*

However, servers do not fail abstractly. A computer running an operating system consists of five distinct, finite hardware and OS resource boundaries: **CPU**, **Memory**, **Database Connections**, **Network Socket I/O**, and **Disk I/O**.

When traffic increases by 200x, one of these five resources will saturate first. Understanding which resource breaks first—and why—is the foundation of **capacity thinking**.

---

## Why the Simple Approach Breaks

When faced with a failing server during a traffic spike, teams typically attempt three quick fixes:

1. **Rebooting the Application Process**: Clears transient memory allocations and resets connections, but as soon as traffic hits the restarted instance, the server re-saturates within seconds.
2. **Increasing Database Max Connections**: Changing PostgreSQL `max_connections` from `100` to `2,000` in hopes of allowing more concurrent requests to execute queries simultaneously.
3. **Upgrading Server Specs Naively (Scale Up)**: Upgrading from 2 vCPUs to 8 vCPUs without addressing underlying code and connection bottlenecks.

These naive fixes fail because server resources do not exist in isolation. Saturation in one resource triggers a **Resource Cascade (Domino Effect)** that degrades all other components:

```text
[ High Request Volume ]
           │
           ▼
[ 1. Unbounded DB Connections Created ] ──> Exhausts DB Process Memory
           │
           ▼
[ 2. Context Switching Explosion on CPU ] ──> Extends Query Latency (10ms ──> 2,000ms)
           │
           ▼
[ 3. HTTP Worker Threads Blocked Waiting ] ──> Requests Accumulate in Heap Memory
           │
           ▼
[ 4. Garbage Collector Thrashing ] ─────────> Consumes 100% CPU Cycles
           │
           ▼
[ 5. OS File Descriptors Exhausted ] ───────> Rejects Incoming Network Sockets
           │
           ▼
   [ 💥 SYSTEM CRASH ]
```

### 1. Why Increasing Database Connections Kills the Database
PostgreSQL uses a **process-per-connection** model. Every client connection spawns a dedicated backend OS process. Each connection consumes between **2 MB to 10 MB** of RAM just for session state and query working memory (`work_mem`).

If 1,000 concurrent HTTP requests each open a dedicated PostgreSQL connection:
- Memory overhead alone requires $1,000 \times 5\text{ MB} = 5\text{ GB}$ of RAM, immediately triggering an Out-Of-Memory (OOM) panic on a 4 GB machine.
- The operating system CPU scheduler is forced to context-switch across 1,000 active processes on 2 CPU cores. More time is spent saving and restoring CPU registers than executing actual SQL queries. 

Queries that took 5ms with 20 connections now take 5,000ms with 1,000 connections.

### 2. Why Memory Saturation Spikes Latency Before Crashing
When memory fills up with unpaginated query results or request payloads, managed runtimes (Go, Java, Node.js) trigger Garbage Collection (GC) to reclaim unused objects. 

Under heavy memory pressure:
- GC threads run continuously, stealing CPU execution time away from HTTP handlers.
- "Stop-The-World" GC pauses freeze the entire application process for seconds at a time.
- Requests waiting during GC pauses exceed client connection timeouts.

---

## Understanding the Problem

To prevent system collapse under traffic growth, you must understand the **5 physical resource constraints** of a server and master **Little's Law** for capacity estimation.

---

### Part 1: The 5 Physical Bottlenecks

```mermaid
graph TD
    subgraph Host ["Single Virtual Server (2 vCPU, 4GB RAM)"]
        CPU["1. CPU Cores (Compute)"]
        RAM["2. RAM / Heap (Memory)"]
        DB["3. DB Connection Pool"]
        NET["4. Network Sockets & FDs"]
        DISK["5. Disk I/O & IOPS"]
    end

    CPU --- RAM
    RAM --- DB
    DB --- NET
    NET --- DISK
```

#### 1. CPU (Central Processing Unit)
- **Primary Consumers**: HTTP request parsing, JSON serialization/deserialization, synchronous cryptography (password hashing via `bcrypt`), business logic, and OS context switching.
- **Symptom of Saturation**: Linux Load Average exceeds the number of available CPU cores (`load avg > 2.0` on a 2-core machine). P50 latency increases uniformly across all endpoints.
- **Critical Threshold**: Sustained CPU usage above **80%** causes request queueing in OS socket backlogs.

#### 2. Memory (RAM & Heap Allocation)
- **Primary Consumers**: In-memory session stores, large database query result sets buffer allocations, application thread stacks, and object caching.
- **Symptom of Saturation**: High Garbage Collection overhead, frequency of GC cycles spiking, swap space usage, and Linux Kernel OOM Killer invoking `SIGKILL` (Exit Code 137) on the main app binary.
- **Critical Threshold**: Available system memory dropping below **15%**.

#### 3. Database Connections
- **Primary Consumers**: HTTP request handler threads attempting to perform SQL operations.
- **Symptom of Saturation**: `sql: database connection pool exhausted`, `FATAL: sorry, too many clients already`, or long P99 latency spikes occurring specifically on endpoints performing write/read operations.
- **Critical Threshold**: Connection pool queue length growing greater than zero.

#### 4. Network Sockets & OS File Descriptors (FDs)
- **Primary Consumers**: Open TCP connections from HTTP clients, outgoing database sockets, local file handles, and internal pipe descriptors.
- **Symptom of Saturation**: `socket: too many open files` errors in application logs, high count of TCP sockets trapped in `TIME_WAIT` state, or client connection resets (`ECONNRESET`).
- **Critical Threshold**: Open file descriptors approaching the process soft limit defined by `ulimit -n` (default on many Linux distros is 1024).

#### 5. Disk Storage & I/O (IOPS & Bandwidth)
- **Primary Consumers**: Database write-ahead logging (WAL), table/index disk updates, unindexed table scans forcing disk reads, application log writes, and OS swap usage.
- **Symptom of Saturation**: High Disk Utilization (`%util` at 100% in `iostat`), high I/O Wait time (`%wa` in `top`), and slow database transactions.
- **Critical Threshold**: Disk read/write operations exceeding the allocated IOPS limit of the block storage volume (e.g., 3,000 IOPS on a standard cloud SSD).

---

### Part 2: Capacity Modeling via Little's Law

To calculate how many concurrent users a single server can support before saturating resources, apply **Little's Law**:

$$L = \lambda \times W$$

Where:
- $L$ = **Concurrency** (The average number of active requests being processed simultaneously inside the system).
- $\lambda$ = **Throughput** (The arrival rate of requests per second, RPS).
- $W$ = **Average Request Latency** (The average time in seconds taken to process a request).

#### Concrete Capacity Calculation

Suppose **ShopScale** receives 500 requests per second ($\lambda = 500$).

1. **Scenario A (Healthy Latency = 20ms)**:
   $$L = 500 \text{ req/sec} \times 0.020 \text{ sec} = 10 \text{ concurrent requests}$$
   The application only needs to execute **10 requests concurrently** at any given millisecond. A pool of 15–20 database connections handles this load effortlessly.

2. **Scenario B (Degraded Latency = 2,000ms due to unindexed query)**:
   $$L = 500 \text{ req/sec} \times 2.000 \text{ sec} = 1,000 \text{ concurrent requests}$$
   Because each request now takes 2 seconds to complete, the server must hold **1,000 requests open simultaneously**.

If your application worker pool or database connection limit is set to 50, the 51st through 1000th requests are forced into an OS memory queue, causing latency to spiral further until requests time out.

> **Key Rule**: Reducing request latency ($W$) directly reduces system concurrency ($L$), freeing up memory, sockets, and CPU threads without buying larger hardware.

---

## Possible Approaches

To survive 1,000 concurrent users on a single server, you must implement techniques that bound resource utilization and enforce explicit backpressure.

| Strategy | How It Works | Where It Helps | Limitations | When It Makes Sense |
|---|---|---|---|---|
| **Bounded Database Connection Pooling** | Replaces per-request DB connections with a fixed pool (e.g., 25 connections) shared across all threads. | Prevents DB context switching, keeps DB RAM usage constant, caps maximum DB load. | Requests wait in an application queue if all 25 connections are busy. | **Mandatory baseline** for every database-backed application. |
| **Enforced Pagination & Query Limits** | Hardcodes max record limits (`LIMIT 50`) on all API read queries and database calls. | Caps memory allocation per request; prevents sudden RAM spikes and OOM crashes. | Requires frontend clients to handle paginated lists or cursor tokens. | **Mandatory baseline** for all list/search endpoints. |
| **OS File Descriptor & Socket Tuning** | Increases `ulimit -n` and optimizes Linux kernel TCP socket reuse parameters. | Prevents `too many open files` errors under high concurrent TCP socket demands. | Resolves OS limit bottlenecks only; does not fix slow code or DB query bugs. | When handling $>500$ concurrent TCP network connections on Linux. |
| **In-Process Async Worker Channels** | Offloads non-critical side-effects (e.g., sending emails) to a background queue thread. | Immediately returns HTTP 202/200 response, reducing request duration ($W$) and concurrency ($L$). | In-memory queues lose unprocessed jobs if the app process crashes or reboots. | For non-critical, non-blocking side tasks (notifications, metrics). |

---

## Trade-offs

Optimizing a single server for 1,000 users requires making explicit trade-offs between availability, latency, and operational complexity:

```text
       Resource Bounding & System Survival           Latency under Saturated Peak
┌─────────────────────────────────────────────┐        ┌─────────────────────────────────────────────┐
│ • Bounded DB Connection Pool (Size: 25)     │        │ • Requests queue in application memory      │
│ • Hard API Pagination (Max 50 items/page)   │   VS   │ • Tail latency (P99) increases during peak  │
│ • HTTP Request Body Limits (Max 1 MB)       │        │ • Client requests rejected when queue full  │
│ • Deterministic Memory Footprint            │        │ • Callers must handle 429 Too Many Requests │
└─────────────────────────────────────────────┘        └─────────────────────────────────────────────┘
```

### What You Gain
- **Deterministic Resource Utilization**: The application will never crash from OOM or crash PostgreSQL from connection overload, regardless of traffic volume.
- **Predictable Failure Modes**: Under extreme load, the system sheds load gracefully by returning HTTP `429 Too Many Requests` or `503 Service Unavailable` rather than locking up entirely.
- **Cost Efficiency**: Maximize the throughput of a low-cost $20/month cloud instance before spending thousands on multi-server infrastructure.

### What You Give Up
- **Tail Latency under Saturated Spikes**: When all 25 database connections are in use, incoming requests must wait in an in-memory queue, causing P99 latency to rise for queued callers.
- **Client Flexibility**: Clients can no longer request unbounded datasets (e.g., `GET /orders` returning 10,000 records in one payload).

---

## A Practical Example

Let's examine how **ShopScale** failed under 1,000 users due to naive resource management, and how we refactored it to handle the load cleanly on the same hardware.

### 1. The Naive Code Path (Failure Scenario)

In the unoptimized implementation of the order history endpoint:
1. Every HTTP request created a brand-new connection to PostgreSQL.
2. The SQL query fetched all historical orders for a user without pagination.
3. The response loaded all records into memory before serializing to JSON.

```go
// BAD: Unbounded connection creation & unbounded memory allocation
package orders

import (
	"database/sql"
	"encoding/json"
	"net/http"
	_ "github.com/lib/pq"
)

func HandleGetOrdersBad(w http.ResponseWriter, r *http.Request) {
	userID := r.URL.Query().Get("user_id")

	// ❌ BOTTLENECK 1: Opens a new TCP database connection per HTTP request
	db, err := sql.Open("postgres", "postgres://user:pass@localhost:5432/shopscale?sslmode=disable")
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer db.Close()

	// ❌ BOTTLENECK 2: Unpaginated SELECT query fetching unlimited rows into RAM
	rows, err := db.Query("SELECT id, total_amount, status, created_at FROM orders WHERE user_id = $1", userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var results []Order
	for rows.Next() {
		var o Order
		rows.Scan(&o.ID, &o.TotalAmount, &o.Status, &o.CreatedAt)
		results = append(results, o) // ❌ BOTTLENECK 3: Unbounded slice growth in heap memory
	}

	json.NewEncoder(w).Encode(results)
}
```

Under 1,000 concurrent requests, this code spawned **1,000 TCP sockets to Postgres**, allocated **hundreds of megabytes of JSON arrays**, exhausted OS File Descriptors, and crashed the application.

---

### 2. The Production-Grade Refactored Code (Capacity-Aware)

We refactor the endpoint to enforce bounded resources:
1. Use a singleton database connection pool with fixed limits (`SetMaxOpenConns`, `SetMaxIdleConns`).
2. Enforce strict cursor/limit pagination on SQL queries (`LIMIT 50`).
3. Set request execution context timeouts to prevent runaway queries.

```go
// GOOD: Bounded connection pool, strict query pagination, and context timeout
package orders

import (
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"time"
)

type OrderHandler struct {
	DB *sql.DB // Shared global connection pool initialized at startup
}

func (h *OrderHandler) HandleGetOrdersGood(w http.ResponseWriter, r *http.Request) {
	userID := r.URL.Query().Get("user_id")

	// 1. Enforce strict request timeout context (Prevents hanging threads)
	ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
	defer cancel()

	// 2. Enforce hard limit pagination (Caps memory footprint per request)
	limit := 50
	query := `
		SELECT id, total_amount, status, created_at 
		FROM orders 
		WHERE user_id = $1 
		ORDER BY id DESC 
		LIMIT $2`

	rows, err := h.DB.QueryContext(ctx, query, userID, limit)
	if err != nil {
		if ctx.Err() == context.DeadlineExceeded {
			http.Error(w, "Request Timeout", http.StatusGatewayTimeout)
			return
		}
		http.Error(w, "Database Error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	// Pre-allocate slice capacity to prevent dynamic memory re-allocations
	results := make([]Order, 0, limit)
	for rows.Next() {
		var o Order
		if err := rows.Scan(&o.ID, &o.TotalAmount, &o.Status, &o.CreatedAt); err != nil {
			http.Error(w, "Scan Error", http.StatusInternalServerError)
			return
		}
		results = append(results, o)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(results)
}
```

---

### 3. Database & Connection Pool Setup

In `main.go`, initialize the shared PostgreSQL connection pool calculated specifically for a 2 vCPU database host:

```go
func InitDB(dataSourceName string) (*sql.DB, error) {
	db, err := sql.Open("postgres", dataSourceName)
	if err != nil {
		return nil, err
	}

	// Optimal HikariCP / Postgres pool formula: Connections = (CPU Cores * 2) + Effective Spindle/Disk Count
	// For a 2 vCPU machine with 1 SSD: (2 * 2) + 1 = 5 base connections (typically set between 10 to 25 to absorb I/O wait latency)
	db.SetMaxOpenConns(25)                  // Hard limit on active DB connections
	db.SetMaxIdleConns(10)                  // Keep idle connections ready
	db.SetConnMaxLifetime(5 * time.Minute)  // Recycle stale connections
	db.SetConnMaxIdleTime(1 * time.Minute)  // Close long-idle connections

	return db, nil
}
```

---

### 4. Bounded Request Execution Flow

```mermaid
sequenceDiagram
    autonumber
    actor Client
    participant HTTP as HTTP Worker Thread
    participant Pool as App DB Pool (Max 25)
    participant PG as PostgreSQL Engine

    Client->>HTTP: POST /orders (Request 1 of 1,000)
    HTTP->>HTTP: Check Timeout Context (2s Limit)
    HTTP->>Pool: Acquire Connection Handle
    alt Pool Has Available Connection
        Pool->>PG: Execute Paginated SQL Query (LIMIT 50)
        PG-->>Pool: Return Query Result Rows
        Pool-->>HTTP: Release Connection back to Pool
        HTTP-->>Client: 200 OK (JSON Data)
    else Pool Full (All 25 in use)
        HTTP->>HTTP: Queue Request in Memory (Wait for free conn)
        alt Free Connection Acquired within 2s
            Pool->>PG: Execute Query
            PG-->>Client: 200 OK
        else Timeout Reached (> 2s)
            HTTP-->>Client: 504 Gateway Timeout (Graceful Load Shed)
        end
    end
```

---

## Failure Scenarios

Even with bounded pools and pagination, operating a high-concurrency single server introduces distinct failure modes:

### 1. Connection Leak Slow Death
If a code path fails to call `rows.Close()` or misses `defer cancel()`, the connection handle is never returned to the pool.

```text
[ Application Pool: Max 25 Connections ]
Req 1  ──> Acquires Conn #1  ──> Error thrown ──> (Forgot rows.Close()) ──> Conn #1 Leaked!
Req 2  ──> Acquires Conn #2  ──> Error thrown ──> (Forgot rows.Close()) ──> Conn #2 Leaked!
...
Req 25 ──> Acquires Conn #25 ──> Error thrown ──> (Forgot rows.Close()) ──> Conn #25 Leaked!
Req 26 ──> Tries to acquire Conn... ──> [ HANGS FOREVER ] ──> HTTP 504 Timeout
```

- **Mitigation**: Use strict linter rules (e.g., `sqlclosecheck` in Go) and enforce mandatory query timeout contexts (`QueryContext`).

### 2. Linux OS File Descriptor Exhaustion
By default, many Linux distributions limit a single process to **1,024 open file descriptors** (`ulimit -n`). 

When 1,000 concurrent users open HTTP connections while the application holds database connections and log files open, the 1,025th socket attempt fails immediately with `accept: too many open files`.

- **Mitigation**: Adjust systemd environment configs or `/etc/security/limits.conf` to increase the soft and hard file descriptor limits for the application user:

```bash
# Increase process file descriptor limit to 65535
ulimit -n 65535
```

### 3. TCP `TIME_WAIT` Socket Accumulation
When high HTTP traffic generates thousands of short-lived client TCP connections per minute, closed sockets remain in the Linux kernel `TIME_WAIT` state for **60 seconds** to ensure trailing packets are drained.

If ephemeral ports (typically ports 32,768 to 60,999) fill with `TIME_WAIT` sockets, the operating system can no longer allocate local ports for new outgoing connections (e.g., connecting to external APIs).

- **Mitigation**: Enable kernel socket reuse in `/etc/sysctl.conf`:

```ini
net.ipv4.tcp_tw_reuse = 1
net.ipv4.ip_local_port_range = 1024 65535
```

---

## Key Engineering Decisions

Before making structural infrastructure changes, evaluate your single server against this capacity checklist:

1. **Calculate Little's Law Baselines**: Measure your average request latency ($W$). If $W = 50\text{ms}$, a single process can serve 1,000 RPS with only 50 concurrent handles. Focus on lowering latency before scaling out compute.
2. **Never Let Connections Grow Unbounded**: Bound database connection pools explicitly (`MaxOpenConns <= 25–50`). It is far better for a request to wait 100ms in an application queue than for PostgreSQL to crash from context switching.
3. **Set Hard Limits on Every Inputs & Queries**: Enforce HTTP payload size limits (`MaxBytesReader`), set database query timeouts, and mandate SQL pagination limits (`LIMIT 50`).
4. **Audit OS Limits Before Traffic Events**: Ensure Linux `ulimit -n` is set to at least `65535` and kernel socket recycling is enabled.

---

## Key Takeaways

1. **Systems fail at physical resource boundaries, not abstract concepts.** When load spikes, identify whether CPU, Memory, DB Connections, File Descriptors, or Disk IOPS saturated first.
2. **PostgreSQL connections are expensive.** Increasing database connection limits degrades database performance. Bound connections tightly and let application workers queue gracefully.
3. **Little's Law proves that latency controls concurrency.** Reducing query duration from 500ms to 20ms reduces active system concurrency by 25x, dramatically lowering memory and socket overhead.
4. **Enforce hard bounds everywhere.** Unbounded arrays, unpaginated SQL queries, and un-timed contexts are tick-ticking bombs waiting for traffic growth.

---

### ⏭️ Next Step
* Read the next guide: **[Day 04 — Vertical vs Horizontal Scaling](../day-04-vertical-vs-horizontal/README.md)**
* View the updated architecture milestone: [`v1-monolith`](../../../system-evolution/v1-monolith/README.md)

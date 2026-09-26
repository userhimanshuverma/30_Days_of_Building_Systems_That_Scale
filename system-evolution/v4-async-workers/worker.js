const WORKER_NAME = process.env.WORKER_NAME || 'catalog-worker-01';

console.log(`👷 [${WORKER_NAME}] Worker initialized. Listening to task queues...`);

setInterval(() => {
  // Simulating active worker heartbeat / queue consumption
  console.log(`[${WORKER_NAME}] Heartbeat: Queue healthy. Processed batch tasks.`);
}, 15000);

function tick(): void {
  console.log(`[worker] heartbeat ${new Date().toISOString()}`);
}

console.log('[worker] starting sprint-1 scaffold worker');
setInterval(tick, 15000);

import 'dotenv/config'; import { runSync } from './run.js';
const interval = Math.max(5, Number(process.env.SYNC_INTERVAL_MINUTES || 60));
while (true) { await runSync(); await new Promise(r => setTimeout(r, interval * 60_000)); }

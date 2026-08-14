import { spawn } from 'node:child_process';
import path from 'node:path';

const port = Number.parseInt(process.env.HLTB_ACCEPTANCE_PORT ?? '8765', 10);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('HLTB_ACCEPTANCE_PORT must be an integer between 1 and 65535');
}

const wxt = path.resolve('node_modules', 'wxt', 'bin', 'wxt.mjs');
const child = spawn(process.execPath, [wxt, 'build'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    WXT_REMOTE_SNAPSHOT_BASE_URL: `http://127.0.0.1:${port}/`,
    WXT_REMOTE_SNAPSHOT_HOST_PERMISSION: 'http://127.0.0.1/*',
  },
});

child.on('error', (error) => {
  console.error(error);
  process.exitCode = 1;
});

child.on('exit', (code, signal) => {
  if (signal) {
    console.error(`Acceptance build terminated by ${signal}`);
    process.exitCode = 1;
    return;
  }
  process.exitCode = code ?? 1;
});

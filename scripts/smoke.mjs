// Starts the real desktop app in self-test mode, prints the checks and closes again.
// Usage: npm run smoke  (works on Windows, macOS and Linux)
import { spawn } from 'node:child_process';
import electron from 'electron';

const child = spawn(electron, ['.'], {
  stdio: 'inherit',
  env: { ...process.env, NEON_DASH_SMOKE: '1' },
});
child.on('exit', (code) => process.exit(code ?? 0));

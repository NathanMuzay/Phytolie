import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

const require = createRequire(import.meta.url);
const children = new Set();
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill('SIGTERM');
  process.exitCode = code;
}
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
function start(args, env, stdio) {
  const child = spawn(process.execPath, args, { env, stdio });
  children.add(child);
  child.on('error', error => { console.error(error.message); stop(1); });
  child.on('exit', code => { children.delete(child); if (!stopping) stop(code ?? 1); });
  return child;
}

try {
  const database = resolve(process.env.FOLIA_DEMO_DB_PATH || 'data/demo.sqlite');
  console.log(`Démo : comptes et plantes séparés dans ${database}`);
  const api = start(['--experimental-strip-types', 'server/index.mjs'], {
    ...process.env, API_PORT: '0', API_HOST: '127.0.0.1', FOLIA_DB_PATH: database,
  }, ['ignore', 'pipe', 'inherit']);
  const port = await new Promise((resolvePort, reject) => {
    const timer = setTimeout(() => { reject(new Error('Le serveur de démo ne démarre pas.')); }, 15000);
    let output = '';
    api.stdout.on('data', chunk => {
      output += chunk.toString();
      const match = output.match(/API Folia prête sur http:\/\/127\.0\.0\.1:(\d+)/);
      if (match) { clearTimeout(timer); resolvePort(match[1]); }
    });
    api.once('error', error => { clearTimeout(timer); reject(error); });
    api.once('exit', () => { clearTimeout(timer); reject(new Error('Le serveur de démo s’est arrêté.')); });
  });
  if (!stopping) {
    console.log('Application et API dans le même tunnel. Scannez le nouveau QR code avec Expo Go.');
    console.log('Vous pouvez utiliser la 4G/5G. Gardez ce terminal et cet ordinateur allumés. Ctrl+C arrête la démo.');
    start([require.resolve('expo/bin/cli'), 'start', '--go', '--tunnel', '--clear', ...process.argv.slice(2)], {
      ...process.env, FOLIA_DEMO_API_PORT: port, EXPO_PUBLIC_API_VIA_EXPO: '1',
    }, 'inherit');
  }
} catch (error) { console.error(error.message); stop(1); }

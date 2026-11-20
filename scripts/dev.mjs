import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const apiPort = Number(process.env.API_PORT || 8787);
const webPort = Number(process.env.FOLIA_WEB_PORT || 8081);
if (process.env.NODE_ENV === 'production') throw new Error('Cette commande est réservée au développement local.');
if ([apiPort, webPort].some(port => !Number.isInteger(port) || port < 1 || port > 65535) || apiPort === webPort) {
  throw new Error('API_PORT et FOLIA_WEB_PORT doivent être deux ports différents entre 1 et 65535.');
}

const children = new Set();
let stopping = false;
function stop(code) {
  if (stopping) return;
  stopping = true;
  process.exitCode = code;
  for (const child of children) child.kill();
}

function start(args, env) {
  const child = spawn(process.execPath, args, { env, stdio: 'inherit' });
  children.add(child);
  child.on('error', error => { console.error(error.message); stop(1); });
  child.on('exit', code => { children.delete(child); stop(code ?? 1); });
}

process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));

const origins = new Set((process.env.FOLIA_ALLOWED_ORIGINS ?? '').split(',').map(value => value.trim()).filter(Boolean));
origins.add(`http://localhost:${webPort}`);
origins.add(`http://127.0.0.1:${webPort}`);
console.log(`Phytolie : http://127.0.0.1:${webPort}`);
start(['--experimental-strip-types', 'server/index.mjs'], {
  ...process.env,
  API_PORT: String(apiPort),
  API_HOST: '127.0.0.1',
  FOLIA_ALLOWED_ORIGINS: [...origins].join(','),
});
start([require.resolve('expo/bin/cli'), 'start', '--localhost', '--web', '--port', String(webPort)], {
  ...process.env,
  FOLIA_DEMO_API_PORT: '',
  EXPO_PUBLIC_API_VIA_EXPO: '0',
  EXPO_PUBLIC_API_AUTO_LOCAL: '0',
  EXPO_PUBLIC_API_URL: `http://127.0.0.1:${apiPort}`,
});

import { mkdtemp, cp, symlink, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

// Verify imports without any access to root Expo/React Native node_modules.
const dependencies = resolve('server/node_modules');
await access(dependencies);
const directory = await mkdtemp(join(tmpdir(), 'folia-runtime-'));
try {
  await cp(resolve('src'), join(directory, 'src'), { recursive: true });
  await cp(resolve('server'), join(directory, 'server'), { recursive: true, filter: source => source !== dependencies });
  await symlink(dependencies, join(directory, 'server/node_modules'), 'dir');
  const modules = ['accounts', 'delegations', 'security', 'identification', 'measurement'];
  const code = modules.map(name => `await import(${JSON.stringify(pathToFileURL(join(directory, 'server', name + '.mjs')).href)});`).join('\n');
  execFileSync(process.execPath, ['--experimental-strip-types', '--input-type=module', '-e', code], { cwd: directory, stdio: 'pipe' });
  console.log('Imports API validés sans les dépendances Expo/React Native racines.');
} finally { await rm(directory, { recursive: true, force: true }); }

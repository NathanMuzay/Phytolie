import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve, basename } from 'node:path';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const root = resolve(dirname(require.resolve('expo-notifications/package.json')), 'build');

// Check the installed SDK's transitive runtime imports, including platform
// overrides: importing the package root used to register push listeners before
// React could render, even though the app only schedules local reminders.
for (const platform of ['android', 'ios', 'web']) {
  test(`Local notifications do not initialize push registration on ${platform}`, () => {
    const visited = new Set();
    function walk(file) {
      if (visited.has(file)) return;
      visited.add(file);
      assert.doesNotMatch(basename(file), /^(index|TokenEmitter|DevicePushTokenAutoRegistration\.fx|getExpoPushTokenAsync|getDevicePushTokenAsync|warnOfExpoGoPushUsage)\.js$/,
        `Unsupported push dependency loaded from ${file}`);
      const source = ts.transpileModule(readFileSync(file, 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
      }).outputText;
      for (const { fileName: specifier } of ts.preProcessFile(source).importedFiles) {
        let target;
        if (specifier.startsWith('expo-notifications')) target = require.resolve(specifier);
        else if (specifier.startsWith('.')) target = resolve(dirname(file), specifier);
        else continue;
        const base = target.replace(/\.js$/, '');
        const candidates = [`${base}.${platform}.js`, ...(platform === 'web' ? [] : [`${base}.native.js`]), `${base}.js`];
        const dependency = candidates.find(existsSync);
        assert.ok(dependency, `Missing notification dependency: ${specifier}`);
        walk(dependency);
      }
    }
    walk(resolve('src/services/localNotifications.ts'));
    assert.ok(visited.has(resolve(root, 'scheduleNotificationAsync.js')));
    assert.ok(visited.has(resolve(root, 'NotificationsEmitter.js')));
  });
}

import test from 'node:test';
import assert from 'node:assert/strict';
import { configureApiHost, getApiBase, localApiBase } from '../src/services/apiBase.ts';

function withEnvironment(run) {
  const keys = ['NODE_ENV', 'EXPO_PUBLIC_API_AUTO_LOCAL', 'EXPO_PUBLIC_API_PORT', 'EXPO_PUBLIC_API_URL', 'EXPO_PUBLIC_API_VIA_EXPO'];
  const before = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  try {
    process.env.NODE_ENV = 'development';
    process.env.EXPO_PUBLIC_API_AUTO_LOCAL = '1';
    process.env.EXPO_PUBLIC_API_PORT = '8787';
    process.env.EXPO_PUBLIC_API_URL = 'http://192.168.1.42:8787';
    delete process.env.EXPO_PUBLIC_API_VIA_EXPO;
    run();
  } finally {
    configureApiHost(undefined);
    for (const key of keys) {
      if (before[key] === undefined) delete process.env[key];
      else process.env[key] = before[key];
    }
  }
}

test('Local API follows the Expo host on each Wi-Fi, including newly assigned DHCP addresses', () => {
  withEnvironment(() => {
    for (const address of ['192.168.1.140', '10.79.216.43', '10.119.14.142', '10.119.14.200', '172.20.1.2']) {
      configureApiHost(`${address}:8081`);
      assert.equal(getApiBase(), `http://${address}:8787`);
    }
    process.env.EXPO_PUBLIC_API_PORT = '8790';
    assert.equal(getApiBase(), 'http://172.20.1.2:8790');
  });
});

test('Browser uses its own host, keeping localhost stable when the Wi-Fi address changes', () => {
  withEnvironment(() => {
    for (const address of ['192.168.1.140', '10.79.216.43', '10.119.14.142']) {
      configureApiHost(`${address}:8081`, 'http://localhost:8081');
      assert.equal(getApiBase(), 'http://localhost:8787');
    }
    configureApiHost('10.79.216.43:8081', 'http://192.168.1.140:8081');
    assert.equal(getApiBase(), 'http://192.168.1.140:8787');
    assert.equal(localApiBase('http://[::1]:8081'), 'http://[::1]:8787');
    assert.equal(localApiBase('ordinateur.local:8081'), 'http://ordinateur.local:8787');
  });
});

test('Automatic mode respects explicit opt-out and cannot redirect the production API', () => {
  withEnvironment(() => {
    configureApiHost('10.119.14.142:8081');
    process.env.EXPO_PUBLIC_API_AUTO_LOCAL = '0';
    assert.equal(getApiBase(), 'http://192.168.1.42:8787');
    process.env.EXPO_PUBLIC_API_AUTO_LOCAL = '1';
    process.env.NODE_ENV = 'production';
    assert.throws(() => getApiBase(), /HTTPS obligatoire/);
    process.env.EXPO_PUBLIC_API_URL = 'https://api.example.test/v1/';
    assert.equal(getApiBase(), 'https://api.example.test/v1');
  });
});

test('Demo tunnel takes priority over local hosts and old configured addresses', () => {
  withEnvironment(() => {
    process.env.EXPO_PUBLIC_API_VIA_EXPO = '1';
    configureApiHost('demo-8081.exp.direct:80', 'http://localhost:8081');
    assert.equal(getApiBase(), 'https://demo-8081.exp.direct/folia-api');
  });
});

test('Unknown or public hosts use the configured fallback; malformed hosts and ports are rejected', () => {
  withEnvironment(() => {
    for (const host of [undefined, 'demo-8081.exp.direct:80', 'https://app.example.test', 'file:///tmp/test', 'http://user:pass@192.168.1.140:8081', 'http://[invalid']) {
      assert.equal(localApiBase(host), undefined);
      configureApiHost(host);
      assert.equal(getApiBase(), 'http://192.168.1.42:8787');
    }
    for (const port of ['0', '65536', '-1', '8787/path', 'abc']) assert.throws(() => localApiBase('localhost:8081', port), /EXPO_PUBLIC_API_PORT/);
  });
});

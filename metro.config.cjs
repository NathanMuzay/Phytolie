const { getDefaultConfig } = require('expo/metro-config');
const { demoProxy } = require('./scripts/demo-proxy.cjs');
const config = getDefaultConfig(__dirname);

// Only the explicitly launched demo exposes its isolated API through Metro.
if (process.env.FOLIA_DEMO_API_PORT) {
  const enhance = config.server.enhanceMiddleware;
  config.server.enhanceMiddleware = (middleware, server) => demoProxy(
    Number(process.env.FOLIA_DEMO_API_PORT), enhance ? enhance(middleware, server) : middleware,
  );
}

module.exports = config;

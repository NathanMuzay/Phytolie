const http = require('node:http');

function demoProxy(apiPort, fallback) {
  return (request, response, next) => {
    if (!request.url?.startsWith('/folia-api/')) return fallback(request, response, next);
    const upstream = http.request({
      hostname: '127.0.0.1', port: apiPort, method: request.method,
      path: request.url.slice('/folia-api'.length),
      headers: { ...request.headers, host: `127.0.0.1:${apiPort}` },
    }, incoming => {
      response.writeHead(incoming.statusCode, incoming.headers);
      incoming.pipe(response);
    });
    upstream.setTimeout(65000, () => upstream.destroy(new Error('API timeout')));
    upstream.on('error', () => {
      if (response.headersSent) { response.destroy(); return; }
      response.writeHead(503, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      response.end(JSON.stringify({ error: 'API de démonstration indisponible. Relancez npm run demo.' }));
    });
    request.on('aborted', () => upstream.destroy());
    response.on('close', () => { if (!response.writableFinished) upstream.destroy(); });
    request.pipe(upstream);
  };
}

module.exports = { demoProxy };

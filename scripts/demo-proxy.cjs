const http = require('node:http');

function demoProxy(apiPort, fallback) {
  return (request, response, next) => {
    if (!request.url?.startsWith('/folia-api/')) return fallback(request, response, next);
    const headers = { ...request.headers, host: `127.0.0.1:${apiPort}` };
    // The development UI and API share this tunnel. Cross-origin callers retain
    // their Origin and are checked by the API's explicit allowlist.
    if (typeof headers.origin === 'string') {
      try { if (new URL(headers.origin).host === request.headers.host) delete headers.origin; } catch { /* API rejects malformed origins. */ }
    }
    const upstream = http.request({
      hostname: '127.0.0.1', port: apiPort, method: request.method,
      path: request.url.slice('/folia-api'.length),
      headers,
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

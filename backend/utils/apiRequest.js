'use strict';

const http = require('http');

/**
 * POST a JSON body to a localhost API and return { status, body }.
 * Intended only for local CLI tooling (e.g. init-admin), not for browser use.
 */
function postJson(urlString, payload, options = {}) {
  return new Promise((resolve, reject) => {
    let bodyText = '';
    try {
      bodyText = JSON.stringify(payload);
    } catch (error) {
      return reject(error);
    }

    const url = new URL(urlString);
    const headers = Object.assign(
      {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      options.headers || {}
    );

    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port || 80,
        path: url.pathname + url.search,
        method: 'POST',
        headers,
      },
      (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          let parsed = null;
          try { parsed = JSON.parse(text); } catch { parsed = null; }
          resolve({ status: res.statusCode, body: parsed, raw: text });
        });
      }
    );

    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('request timed out')); });
    req.end(bodyText);
  });
}

module.exports = { postJson };

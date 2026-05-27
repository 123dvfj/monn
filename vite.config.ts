import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import https from 'https';
import http from 'http';

// Yahoo Finance requires a "crumb" for API access.
// This middleware fetches the crumb and passes it through.
function yahooProxyPlugin(): Plugin {
  let cookie = '';
  let crumb = '';

  async function refreshCrumb() {
    return new Promise<void>((resolve) => {
      const req = https.get('https://fc.yahoo.com/', (res) => {
        const setCookie = res.headers['set-cookie'];
        if (setCookie) {
          cookie = setCookie.map((c) => c.split(';')[0]).join('; ');
        }
        // Get crumb
        const crumbReq = https.get('https://query2.finance.yahoo.com/v1/test/getcrumb', {
          headers: { Cookie: cookie, 'User-Agent': 'Mozilla/5.0' },
        }, (crumbRes) => {
          let data = '';
          crumbRes.on('data', (chunk) => (data += chunk));
          crumbRes.on('end', () => {
            crumb = data.trim();
            resolve();
          });
        });
        crumbReq.on('error', () => resolve());
      });
      req.on('error', () => resolve());
    });
  }

  function proxyRequest(
    targetHost: string,
    req: http.IncomingMessage,
    res: http.ServerResponse,
    rewritePath?: (p: string) => string
  ) {
    let path = req.url ?? '/';
    if (rewritePath) path = rewritePath(path);

    const options: https.RequestOptions = {
      hostname: targetHost,
      path: path,
      method: req.method,
      headers: {
        Cookie: cookie,
        'User-Agent': 'Mozilla/5.0',
        Accept: 'application/json',
      },
    };

    const proxyReq = https.request(options, (proxyRes) => {
      res.writeHead(proxyRes.statusCode ?? 200, proxyRes.headers);
      proxyRes.pipe(res);
    });

    proxyReq.on('error', (err) => {
      res.writeHead(502);
      res.end(JSON.stringify({ error: 'Proxy error', message: err.message }));
    });

    if (req.method === 'POST' || req.method === 'PUT') {
      req.pipe(proxyReq);
    } else {
      proxyReq.end();
    }
  }

  return {
    name: 'yahoo-proxy',
    async configureServer(server) {
      // Initial crumb fetch
      await refreshCrumb();
      // Refresh crumb every 4 hours
      setInterval(refreshCrumb, 4 * 60 * 60 * 1000);

      // Handle /api/yahoo/* requests
      server.middlewares.use('/api/yahoo', (req, res) => {
        const url = req.url ?? '';
        let targetHost: string;
        // Determine target host from the original path
        if (url.startsWith('/v7/') || url.startsWith('/v8/') || url.startsWith('/v1/')) {
          targetHost = 'query1.finance.yahoo.com';
        } else {
          targetHost = 'query1.finance.yahoo.com';
        }
        proxyRequest(targetHost, req, res);
      });

      // Handle /api/yahoo-news/* requests
      server.middlewares.use('/api/yahoo-news', (req, res) => {
        proxyRequest('query2.finance.yahoo.com', req, res, (p) => p.replace(/^\/api\/yahoo-news/, ''));
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), yahooProxyPlugin()],
  base: './',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});

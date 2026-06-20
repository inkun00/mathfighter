import { defineConfig, loadEnv } from 'vite';
import { fetchPadletPostHtml } from './api/padlet-service.js';

function padletProxyPlugin() {
  return {
    name: 'padlet-proxy',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url && req.url.startsWith('/api/fetch-padlet')) {
          const urlObj = new URL(req.url, 'http://localhost:3000');
          const targetUrl = urlObj.searchParams.get('url');
          if (!targetUrl) {
            res.statusCode = 400;
            res.end('Missing url parameter');
            return;
          }

          try {
            const body = await fetchPadletPostHtml(targetUrl, process.env.PADLET_API_KEY);
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.statusCode = 200;
            res.end(body);
          } catch (err) {
            res.statusCode = err.statusCode || 500;
            res.end(err.message);
          }
          return;
        }
        next();
      });
    }
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  Object.assign(process.env, env);

  return {
    plugins: [padletProxyPlugin()],
    server: {
      port: 3000,
      open: true,
      hmr: false
    },
    build: {
      outDir: 'dist'
    }
  };
});

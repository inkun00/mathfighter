import { defineConfig } from 'vite';
import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

function padletProxyPlugin() {
  return {
    name: 'padlet-proxy',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url && req.url.startsWith('/api/fetch-padlet')) {
          const urlObj = new URL(req.url, 'http://localhost:3000');
          const targetUrl = urlObj.searchParams.get('url');
          if (targetUrl) {
            try {
              if (!targetUrl.startsWith('https://padlet.com/')) {
                res.statusCode = 400;
                res.end('Invalid URL. Only padlet.com URLs are allowed.');
                return;
              }
              const safeUrl = targetUrl.replace(/"/g, '\\"');
              const cmd = `curl.exe -L -s -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" "${safeUrl}"`;
              const { stdout } = await execPromise(cmd, { maxBuffer: 10 * 1024 * 1024 });
              res.setHeader('Content-Type', 'text/html; charset=utf-8');
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.statusCode = 200;
              res.end(stdout);
            } catch (err) {
              res.statusCode = 500;
              res.end(err.message);
            }
            return;
          }
        }
        next();
      });
    }
  };
}

export default defineConfig({
  plugins: [padletProxyPlugin()],
  server: {
    port: 3000,
    open: true,
    hmr: false
  },
  build: {
    outDir: 'dist'
  }
});


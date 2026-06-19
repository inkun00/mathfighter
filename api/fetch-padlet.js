export default async function handler(req, res) {
  const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const targetUrl = urlObj.searchParams.get('url');

  if (!targetUrl) {
    res.statusCode = 400;
    res.end('Missing url parameter');
    return;
  }

  if (!targetUrl.startsWith('https://padlet.com/')) {
    res.statusCode = 400;
    res.end('Invalid URL. Only padlet.com URLs are allowed.');
    return;
  }

  // Try multiple public proxy endpoints sequentially to bypass Padlet's IP block & proxy outages
  const proxyUrls = [
    `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`,
    `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(targetUrl)}`,
    `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`
  ];

  let contents = null;
  let lastError = null;

  for (const proxyUrl of proxyUrls) {
    try {
      // 5 seconds timeout per proxy attempt
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(proxyUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        contents = await response.text();
        // Check if the response is actually valid HTML and not a Cloudflare error block
        if (contents.length > 500 && !contents.includes("error code: 520") && !contents.includes("error code: 522") && !contents.includes("Cloudflare")) {
          break;
        }
      }
    } catch (err) {
      lastError = err;
    }
  }

  if (contents) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.statusCode = 200;
    res.end(contents);
  } else {
    res.statusCode = 502;
    res.end(`All proxies failed. Last error: ${lastError ? lastError.message : 'Unknown'}`);
  }
}

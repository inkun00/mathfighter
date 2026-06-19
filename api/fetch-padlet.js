export default async function handler(req, res) {
  // Extract URL parameters
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

  // Bypass Padlet IP block by proxying through allorigins raw endpoint
  const bypassUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`;

  try {
    const response = await fetch(bypassUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    if (!response.ok) {
      res.statusCode = response.status;
      res.end(`Failed to fetch padlet: ${response.statusText}`);
      return;
    }

    const html = await response.text();
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.statusCode = 200;
    res.end(html);
  } catch (err) {
    res.statusCode = 500;
    res.end(err.message);
  }
}

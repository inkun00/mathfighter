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

  try {
    // Extract board ID and wish/post ID
    const boardMatch = targetUrl.match(/padlet\.com\/[^/]+\/([^/]+)/);
    let boardId = boardMatch ? boardMatch[1] : null;
    if (boardId && boardId.startsWith('padlet-')) {
      boardId = boardId.substring(7); // strip 'padlet-' prefix to match API format
    }

    const wishMatch = targetUrl.match(/wish\/([a-zA-Z0-9]+)/);
    const wishId = wishMatch ? wishMatch[1] : null;

    if (!boardId || !wishId) {
      res.statusCode = 400;
      res.end('Failed to parse board ID or wish ID from the provided URL.');
      return;
    }

    // Call Padlet Official API using the provided API Key
    const apiKey = 'pdltp_a3ad49af0daf10d748de79410061079003fe2f592f26a59010122161d933b6d5f6958e';
    const apiUrl = `https://api.padlet.dev/v1/boards/${boardId}?include=posts`;

    const response = await fetch(apiUrl, {
      headers: {
        'X-Api-Key': apiKey,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    if (!response.ok) {
      res.statusCode = response.status;
      res.end(`Padlet API responded with status ${response.status}: ${response.statusText}`);
      return;
    }

    const data = await response.json();
    if (!data.included || !Array.isArray(data.included)) {
      res.statusCode = 502;
      res.end('Invalid API response: missing "included" array.');
      return;
    }

    // Find the post by wishId in the included items
    const post = data.included.find(item => 
      item.type === 'post' && 
      (item.id === `post_${wishId}` || item.id === wishId || (item.attributes?.webUrl?.live && item.attributes.webUrl.live.includes(wishId)))
    );

    if (!post || !post.attributes || !post.attributes.content || !post.attributes.content.bodyHtml) {
      res.statusCode = 404;
      res.end('Specified post/wish not found in the board.');
      return;
    }

    // Strip HTML tags from bodyHtml to get the raw text
    let bodyText = post.attributes.content.bodyHtml;
    bodyText = bodyText.replace(/<[^>]+>/g, '').trim();

    // Construct a fake HTML with the parsed quiz description inside the meta tag
    const fakeHtml = `<html><head><meta name="description" content="${bodyText}"><meta property="og:description" content="${bodyText}"></head><body></body></html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.statusCode = 200;
    res.end(fakeHtml);
  } catch (err) {
    res.statusCode = 500;
    res.end(`Internal Server Error: ${err.message}`);
  }
}

function escapeHtmlAttribute(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export async function fetchPadletPostHtml(targetUrl, apiKey, fetchImpl = fetch) {
  if (!apiKey) {
    throw new Error('Server is missing PADLET_API_KEY.');
  }

  if (!targetUrl.startsWith('https://padlet.com/')) {
    const error = new Error('Invalid URL. Only padlet.com URLs are allowed.');
    error.statusCode = 400;
    throw error;
  }

  const boardMatch = targetUrl.match(/padlet\.com\/[^/]+\/([^/]+)/);
  let boardId = boardMatch ? boardMatch[1] : null;
  if (boardId && boardId.startsWith('padlet-')) {
    boardId = boardId.substring(7);
  }

  const postMatch = targetUrl.match(/(?:wish|posts)\/([a-zA-Z0-9_-]+)/);
  const postId = postMatch ? postMatch[1] : null;

  if (!boardId || !postId) {
    const error = new Error('Failed to parse board ID or post ID from the provided URL.');
    error.statusCode = 400;
    throw error;
  }

  const apiUrl = `https://api.padlet.dev/v1/boards/${boardId}?include=posts`;
  const response = await fetchImpl(apiUrl, {
    headers: {
      'X-Api-Key': apiKey,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
  });

  if (!response.ok) {
    const error = new Error(`Padlet API responded with status ${response.status}: ${response.statusText}`);
    error.statusCode = response.status;
    throw error;
  }

  const data = await response.json();
  if (!data.included || !Array.isArray(data.included)) {
    const error = new Error('Invalid API response: missing "included" array.');
    error.statusCode = 502;
    throw error;
  }

  const post = data.included.find(item =>
    item.type === 'post' &&
    (item.id === `post_${postId}` || item.id === postId || item.attributes?.webUrl?.live?.includes(postId))
  );

  if (!post?.attributes?.content?.bodyHtml) {
    const error = new Error('Specified post/wish not found in the board.');
    error.statusCode = 404;
    throw error;
  }

  const bodyText = post.attributes.content.bodyHtml.replace(/<[^>]+>/g, '').trim();
  const escapedBodyText = escapeHtmlAttribute(bodyText);
  return `<html><head><meta name="description" content="${escapedBodyText}"><meta property="og:description" content="${escapedBodyText}"></head><body></body></html>`;
}

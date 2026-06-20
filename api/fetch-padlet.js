import { fetchPadletPostHtml } from './padlet-service.js';

export default async function handler(req, res) {
  const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const targetUrl = urlObj.searchParams.get('url');
  const apiKey = process.env.PADLET_API_KEY;

  if (!targetUrl) {
    res.statusCode = 400;
    res.end('Missing url parameter');
    return;
  }

  try {
    const fakeHtml = await fetchPadletPostHtml(targetUrl, apiKey);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.statusCode = 200;
    res.end(fakeHtml);
  } catch (err) {
    res.statusCode = err.statusCode || 500;
    res.end(err.message);
  }
}

module.exports = function newsletterPreview(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const url = new URL(req.url || '/', 'http://localhost');
  if (req.method === 'GET' && url.searchParams.get('previewNewsletter') === '1' &&
      ['preview', 'development'].includes(process.env.VERCEL_ENV)) {
    return res.status(200).json({ preview: true });
  }
  return res.status(404).json({ outcome: 'not_found' });
};

module.exports = async function newsletterPreview(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const url = new URL(req.url || '/', 'http://localhost');
  if (req.method === 'GET' && ['preview', 'development'].includes(process.env.VERCEL_ENV)) {
    if (url.searchParams.get('previewNewsletter') === '1') {
      return res.status(200).json({ preview: true });
    }

    const kind = url.searchParams.get('previewMail');
    if (kind === 'admin' || kind === 'welcome') {
      const { renderNewsletterEmail } = await import('../supabase/functions/newsletter/index.ts');
      const { html } = renderNewsletterEmail(kind === 'admin'
        ? { kind, email: 'exemple@example.org', source: 'footer', timestamp: '2026-11-22T15:30:00Z' }
        : { kind, unsubscribe: '#apercu-desinscription' });
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('X-Robots-Tag', 'noindex, nofollow');
      return res.status(200).send(html);
    }
  }
  return res.status(404).json({ outcome: 'not_found' });
};

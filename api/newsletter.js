const { createHmac } = require('node:crypto');
const { isIP } = require('node:net');

module.exports = async function newsletter(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ outcome: 'method_not_allowed' });
  }

  if (req.headers['sec-fetch-site'] === 'cross-site' ||
      (req.headers.origin && req.headers.origin !== `https://${req.headers.host}` &&
        !(process.env.VERCEL_ENV === 'development' && req.headers.origin === `http://${req.headers.host}`))) {
    return res.status(403).json({ outcome: 'forbidden' });
  }
  if (req.headers['content-type']?.split(';')[0].trim() !== 'application/json') {
    return res.status(415).json({ outcome: 'invalid' });
  }

  const { isEmailValid } = await import('../js/utils/validation.js');
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const source = req.body?.source;
  if (email.length > 254 || !isEmailValid(email) || !['article', 'footer'].includes(source)) {
    return res.status(400).json({ outcome: 'invalid' });
  }

  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, NEWSLETTER_RATE_LIMIT_SECRET } = process.env;
  const ip = req.headers['x-vercel-forwarded-for'];
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !NEWSLETTER_RATE_LIMIT_SECRET ||
      typeof ip !== 'string' || !isIP(ip)) {
    return res.status(503).json({ outcome: 'unavailable' });
  }

  const hour = Math.floor(Date.now() / 3_600_000);
  const bucket = createHmac('sha256', NEWSLETTER_RATE_LIMIT_SECRET).update(`${hour}:${ip}`).digest('hex');
  try {
    const response = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/rpc/subscribe_newsletter`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ p_email: email, p_source: source, p_bucket: bucket }),
      signal: AbortSignal.timeout(7000)
    });

    if (response.ok) {
      const outcome = await response.json();
      if (outcome === 'limited') return res.status(429).json({ outcome });
      if (outcome === 'invalid') return res.status(400).json({ outcome });
      if (outcome === 'subscribed') return res.status(201).json({ outcome });
      if (['already_subscribed', 'pending', 'contact_required'].includes(outcome)) {
        return res.status(200).json({ outcome });
      }
    }
  } catch {
    // An unreachable database and an unconfirmed write both require a retry.
  }
  console.error('[newsletter] Supabase registration unavailable');
  return res.status(503).json({ outcome: 'unavailable' });
};

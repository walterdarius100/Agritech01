// An opaque response never proves that Apps Script persisted the request.
export async function storeLead(config, payload, fetcher = globalThis.fetch) {
  if (!config.sheetEndpoint) return { state: 'unconfigured' };
  try {
    await fetcher(config.sheetEndpoint, {
      method: 'POST', mode: 'no-cors', body: new URLSearchParams(payload),
      signal: AbortSignal.timeout(15000)
    });
    return { state: 'unconfirmed' };
  } catch {
    return { state: 'unknown' };
  }
}

export function createSubmissionService(config, { emailjs, fetcher = globalThis.fetch } = {}) {
  const requests = new Map();
  async function sessionKey(key) {
    try {
      if (!globalThis.sessionStorage || !globalThis.crypto?.subtle) return null;
      let salt = sessionStorage.getItem('agritech-form-salt');
      if (!salt) {
        salt = crypto.randomUUID();
        sessionStorage.setItem('agritech-form-salt', salt);
      }
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(salt + key));
      return 'agritech-form:' + Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
    } catch { return null; }
  }
  function remember(key, result) {
    try { if (key) sessionStorage.setItem(key, JSON.stringify(result)); } catch { /* Memory guard remains active. */ }
  }
  return async function submit(payload, newsletter = false) {
    // Raw field values stay in memory; only salted fingerprints/results enter sessionStorage.
    const key = JSON.stringify(newsletter ? ['newsletter', payload.from_email.toLowerCase()] :
      ['contact', payload.from_name, payload.from_email.toLowerCase(), payload.phone, payload.need, payload.message]);
    if (requests.has(key)) return requests.get(key);
    const operation = (async () => {
      const savedKey = await sessionKey(key);
      try {
        const saved = savedKey && JSON.parse(sessionStorage.getItem(savedKey));
        if (saved?.notification === 'accepted') return saved;
      } catch { /* Storage may be unavailable or contain obsolete data. */ }
      let notification = 'failed';
      try {
        if (!emailjs || !config.publicKey || !config.serviceId || !config.templateId) throw new Error('Configuration');
        await emailjs.send(config.serviceId, config.templateId, payload);
        notification = 'accepted';
      } catch {
        return { notification, reply: 'skipped', storage: { state: 'skipped' } };
      }
      // Record the accepted operation before any secondary effect, including on navigation.
      remember(savedKey, { notification, reply: 'unconfirmed', storage: { state: 'unknown' } });
      // Storage and reply failures cannot undo the accepted main notification.

      let reply = 'unconfigured';
      if (!newsletter && config.autoReplyVerified === true && config.autoReplyTemplateId &&
          config.autoReplyTemplateId !== config.templateId) {
        try {
          // Separate rate bucket: the global ten-second contact throttle must not block the reply.
          await emailjs.send(config.serviceId, config.autoReplyTemplateId, payload, {
            limitRate: { id: 'agritech-auto-reply', throttle: 1000 }
          });
          reply = 'accepted';
        } catch { reply = 'failed'; }
      }
      const storage = await storeLead(config, payload, fetcher);
      const result = { notification, reply, storage };
      remember(savedKey, result);
      return result;
    })();
    requests.set(key, operation);
    const result = await operation;
    if (result.notification !== 'accepted') requests.delete(key);
    return result;
  };
}

export function contactResultMessage(result) {
  if (result.notification !== 'accepted') return 'L’envoi de votre demande n’a pas pu être confirmé. Vos champs sont conservés. Avant de réessayer, vérifiez si vous avez déjà reçu une réponse.';
  const base = 'Votre demande a été transmise à Agri-tech pour traitement.';
  if (result.reply === 'accepted') return `${base} L’accusé de réception a été pris en charge par le service email ; sa livraison n’est pas garantie.`;
  if (result.reply === 'failed' || result.reply === 'unconfirmed') return `${base} L’envoi de l’accusé de réception n’a pas pu être confirmé. Ne renvoyez pas votre demande.`;
  return `${base} Aucun accusé de réception automatique n’est activé.`;
}

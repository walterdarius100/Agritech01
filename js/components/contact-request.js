// The receipt lets a retry recover an uncertain storage response without creating a new row.
export function createContactRequest({ endpoint, emailConfig, fetcher = fetch, emailjs = () => window.emailjs, storage = () => sessionStorage, pause = ms => new Promise(resolve => setTimeout(resolve, ms)) }) {
  const receipts = new Map();
  let inFlight = false;
  let salt;
  function session() { try { return storage(); } catch { return null; } }
  async function receiptFor(fields) {
    const store = session();
    try { salt ||= store?.getItem('contact-salt'); } catch { /* memory fallback */ }
    salt ||= crypto.randomUUID();
    try { store?.setItem('contact-salt', salt); } catch { /* memory fallback */ }
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(salt + JSON.stringify(fields)));
    const key = 'contact:' + Array.from(new Uint8Array(hash), n => n.toString(16).padStart(2, '0')).join('');
    let receipt = receipts.get(key);
    try { receipt ||= JSON.parse(store?.getItem(key) || 'null'); } catch { /* memory fallback */ }
    if (!receipt || !/^[0-9a-f-]{36}$/i.test(receipt.id) || !/^[a-f0-9]{64}$/.test(receipt.receipt)) {
      receipt = { id: crypto.randomUUID(), receipt: Array.from(crypto.getRandomValues(new Uint8Array(32)), n => n.toString(16).padStart(2, '0')).join('') };
    }
    receipts.set(key, receipt);
    const save = () => { try { store?.setItem(key, JSON.stringify(receipt)); } catch { /* memory fallback */ } };
    save();
    return { receipt, save };
  }
  return async payload => {
    if (inFlight) return { busy: true };
    inFlight = true;
    try {
      const fields = { full_name: payload.from_name, email: payload.from_email.trim().toLowerCase(), phone: payload.phone,
        request_type: payload.need, message: payload.message, consent: true, website: '' };
      const { receipt, save } = await receiptFor(fields);
      let response, result;
      try {
        response = await fetcher(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: 'storage-only-v1', id: receipt.id, receipt: receipt.receipt, ...fields }), signal: AbortSignal.timeout(30000) });
        result = await response.json();
      } catch { return { stored: false }; }
      if (!response.ok || result.stored !== true || result.id !== receipt.id || result.transport !== 'storage-only-v1') return { stored: false };
      const sdk = emailjs();
      if (!sdk || !emailConfig.publicKey || !emailConfig.serviceId || !emailConfig.templateId) return { stored: true, notification: 'unavailable', reply: 'unavailable' };
      const params = { ...payload, request_id: receipt.id };
      const options = { publicKey: emailConfig.publicKey, limitRate: { id: 'agritech-contact-form', throttle: 1100 } };
      async function send(kind, template) {
        if (receipt[kind]) return receipt[kind];
        receipt[kind] = 'unknown'; save(); // Never automatically repeat an uncertain send.
        try { await sdk.send(emailConfig.serviceId, template, params, options); receipt[kind] = 'accepted'; }
        catch { receipt[kind] = 'failed'; }
        save();
        return receipt[kind];
      }
      const notification = await send('notification', emailConfig.templateId);
      let reply = 'unavailable';
      if (emailConfig.autoReplyTemplateId && emailConfig.autoReplyTemplateId !== emailConfig.templateId) {
        if (!receipt.reply) await pause(1200);
        reply = await send('reply', emailConfig.autoReplyTemplateId);
      }
      return { stored: true, notification, reply };
    } finally { inFlight = false; }
  };
}

import { sendReservedContactEmails } from './browser-contact-email.js';
// Inactive unless CONTACT_STORAGE_CONFIG.enabled is explicitly true in the reviewed config.
const states = ['pending','attempting','accepted','failed','unknown','disabled'];
export function createStoredContactService(config, { fetcher = globalThis.fetch, now = Date.now, sendEmail, pause } = {}) {
  const receipts = new Map();
  const inFlight = new Map();
  let salt;
  let retryAt = 0;
  function session() { try { return globalThis.sessionStorage; } catch { return null; } }
  async function getReceipt(fields) {
    const storage = session();
    try { salt ||= storage?.getItem('agritech-contact-salt'); } catch { /* Memory only. */ }
    salt ||= crypto.randomUUID();
    try { storage?.setItem('agritech-contact-salt', salt); } catch { /* Memory only. */ }
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(salt + JSON.stringify(fields)));
    const key = 'agritech-contact-receipt:' + Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2,'0')).join('');
    if (receipts.has(key)) return receipts.get(key);
    let saved;
    try { saved = JSON.parse(storage?.getItem(key) || 'null'); } catch { /* Ignore invalid storage. */ }
    if (!/^[0-9a-f-]{36}$/i.test(saved?.id || '') || !/^[a-f0-9]{64}$/.test(saved?.receipt || '')) {
      saved = { id:crypto.randomUUID(), receipt:Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2,'0')).join('') };
    }
    Object.defineProperty(saved, 'storageKey', { value:key });
    receipts.set(key,saved);
    try { storage?.setItem(key,JSON.stringify(saved)); } catch { /* Survives only while page is open. */ }
    return saved;
  }
  return async payload => {
    if (config.enabled !== true) throw Error('Inactive contact storage');
    if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/functions\/v1\/contact-request$/.test(config.endpoint || '')) {
      return { stored:false, code:'configuration' };
    }
    if (now() < retryAt) return { stored:null, code:'rate_limited' };
    const fields = { full_name:payload.from_name.trim(), email:payload.from_email.trim().toLowerCase(),
      phone:payload.phone, request_type:payload.need, message:payload.message.trim(), consent:payload.consent === 'Oui', website:'' };
    let receipt;
    // Cryptography is mandatory; never fall back to the legacy email-first path.
    try { receipt = await getReceipt(fields); } catch { return { stored:false, code:'configuration' }; }
    const cached = receipt.result;
    const terminal = result => result?.stored === true && result.id === receipt.id &&
      states.includes(result.notification) && states.includes(result.reply) &&
      (['failed','unknown','attempting'].includes(result.notification) ||
        (result.notification === 'accepted' && result.reply !== 'pending'));
    if (terminal(cached)) return { stored:true, id:receipt.id, notification:cached.notification, reply:cached.reply };
    if (inFlight.has(receipt.id)) return inFlight.get(receipt.id);
    const operation = (async () => {
      try {
        const reply = await fetcher(config.endpoint, { method:'POST', headers:{'Content-Type':'application/json'},
          body:JSON.stringify({id:receipt.id,receipt:receipt.receipt,...fields}), signal:AbortSignal.timeout(30000) });
        const result = await reply.json();
        if (reply.ok && result.stored === true && result.id === receipt.id && states.includes(result.notification) && states.includes(result.reply)) {
          const call = async (action,state) => {
            const response = await fetcher(config.endpoint, { method:'POST',headers:{'Content-Type':'application/json'},
              body:JSON.stringify({id:receipt.id,receipt:receipt.receipt,...fields,action,...(state ? {state} : {})}),signal:AbortSignal.timeout(15000) });
            if (!response.ok) throw Error('reservation_unconfirmed');
            return response.json();
          };
          const sent = await sendReservedContactEmails(result, payload, call, sendEmail, pause);
          const safe = { stored:true, id:receipt.id, notification:sent.notification, reply:sent.reply };
          if (terminal(safe)) {
            receipt.result = safe;
            try { session()?.setItem(receipt.storageKey,JSON.stringify(receipt)); } catch { /* Memory only. */ }
          }
          return safe;
        }
        if (result.stored === false && ['invalid','configuration','disabled','origin','conflict'].includes(result.code)) return { stored:false, code:result.code };
        if (result.code === 'rate_limited' || reply.status === 429) {
          retryAt = now() + 60000;
          return { stored:null, code:'rate_limited' };
        }
        return { stored:null, code:result.code === 'rate_limited' ? 'rate_limited' : 'storage_unknown' };
      } catch { return { stored:null, code:'storage_unknown' }; }
    })();
    inFlight.set(receipt.id,operation);
    try { return await operation; } finally { inFlight.delete(receipt.id); }
  };
}

export function storedContactMessage(result) {
  if (result.stored !== true) {
    if (result.code === 'rate_limited') return 'La limite de demandes est atteinte. Vos champs sont conservés. Attendez au moins une minute avant de reprendre cette même demande ; la limite horaire ou journalière peut nécessiter une attente plus longue.';
    if (result.stored === false) return 'L’enregistrement a été refusé. Vos champs sont conservés. Contactez Agri-tech si le problème persiste.';
    return 'L’enregistrement n’a pas pu être confirmé. Vos champs sont conservés. Réessayez cette même demande sans la recréer.';
  }
  if (result.notification !== 'accepted') return 'Votre demande est enregistrée. La notification email n’est pas confirmée. Ne renvoyez pas votre demande.';
  if (['failed','unknown','attempting'].includes(result.reply)) return 'Votre demande est enregistrée et la notification a été prise en charge. L’accusé de réception n’a pas pu être confirmé. Ne renvoyez pas votre demande.';
  if (result.reply === 'accepted') return 'Votre demande est enregistrée. Les emails ont été pris en charge par le service d’envoi.';
  return 'Votre demande est enregistrée et la notification a été prise en charge. Aucun accusé de réception automatique n’est confirmé.';
}

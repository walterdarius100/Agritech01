import { SUPABASE_URL } from '../config/supabase-config.js';

export function createContactSubmission({ fetcher = fetch, storage, cryptoApi = crypto } = {}) {
  const pending = new Map();

  return async function submitContactRequest(fields) {
    const fingerprint = Array.from(new Uint8Array(
      await cryptoApi.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(fields)))
    ), byte => byte.toString(16).padStart(2, '0')).join('');
    const key = `agritech-contact-pending:${fingerprint}`;
    let id = pending.get(key);
    try {
      id ||= storage?.getItem(key);
    } catch {
      // The in-memory key still covers retries on this page.
    }
    if (!id) id = cryptoApi.randomUUID();
    pending.set(key, id);
    try {
      storage?.setItem(key, id);
    } catch {
      // Storage can be unavailable in private browsing.
    }

    try {
      const response = await fetcher(`${SUPABASE_URL}/functions/v1/contact-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...fields }),
        signal: AbortSignal.timeout(15000)
      });
      const result = await response.json();
      if (response.ok && result.status === 'recorded' && result.id === id) {
        pending.delete(key);
        try {
          storage?.removeItem(key);
        } catch {
          // A subsequent replay remains safe if cleanup fails.
        }
        return 'recorded';
      }
      if ([400, 413, 429].includes(response.status) && result.status === 'rejected') return 'rejected';
    } catch {
      // The server may have committed before the connection failed.
    }
    return 'uncertain';
  };
}

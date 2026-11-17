// No third-party SDK or automatic retries. URLs and credentials come only from Edge environment.
export function createRpcDatabase({ url, secret, fetcher = fetch }) {
  async function call(name, args) {
    const response = await fetcher(`${url}/rest/v1/rpc/${name}`, {
      method:'POST', headers:{ 'Content-Type':'application/json', apikey:secret, Authorization:`Bearer ${secret}` },
      body:JSON.stringify(args), signal:AbortSignal.timeout(10000)
    });
    if (!response.ok) throw Error('database_unconfirmed');
    return response.json();
  }
  return { submit:args => call('contact_submit',args), claim:args => call('contact_claim_email',args), finish:args => call('contact_finish_email',args) };
}
// Provider text is used only for classification, never returned or logged.
export function classifyEmailFailure(status, text = '') {
  const message = text.toLowerCase();
  if (/non.browser|server.side|server side|server access|api calls.*disabled|access.*disabled/.test(message)) return 'server_access_disabled';
  if (/private.key|access.?token/.test(message)) return 'private_key';
  if (/public.key|user.?id/.test(message)) return 'public_key';
  if (/quota|monthly|credits|limit.*exceed/.test(message)) return 'quota';
  if (status === 429) return 'rate_limit';
  if (/template(?:[ _-]?id)?(?: is)? (?:invalid|not found|does not|missing)|(?:invalid|unknown|missing) template/.test(message)) return 'template';
  if (/service(?:[ _-]?id)?(?: is)? (?:invalid|not found|does not|missing)|(?:invalid|unknown|missing) service/.test(message)) return 'service';
  if (status === 401 || status === 403) return 'authorization';
  return status >= 500 ? 'provider_unavailable' : 'provider_rejected';
}

async function readDiagnostic(response) {
  // Bound memory even if a proxy returns an unexpectedly large body.
  const reader = response.body?.getReader();
  if (!reader) return '';
  const bytes = new Uint8Array(4096); let length = 0;
  try {
    while (length < bytes.length) {
      const { done, value } = await reader.read();
      if (done) break;
      const part = value.subarray(0, bytes.length - length);
      bytes.set(part, length); length += part.length;
    }
    return new TextDecoder().decode(bytes.subarray(0, length));
  } finally { await reader.cancel().catch(() => {}); }
}

export function createEmailSender(config, fetcher = fetch, report = event => console.warn(JSON.stringify(event))) {
  // Only fixed labels and numeric status enter the server logs.
  function diagnostic(kind, status, code) {
    try { report({ event:'contact_email', kind, status, code }); } catch { /* Logging must not alter send state. */ }
  }
  const escape = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char]));
  return async (kind, payload) => {
    // Header/recipient variables retain their validated literal values; content is escaped.
    const params = Object.fromEntries(Object.entries(payload).map(([k,v]) => [k, k === 'from_email' ? v : escape(v)]));
    let response;
    try { response = await fetcher('https://api.emailjs.com/api/v1.0/email/send', {
      method:'POST', headers:{'Content-Type':'application/json'}, signal:AbortSignal.timeout(10000),
      body:JSON.stringify({ service_id:config.serviceId, template_id:kind === 'notification' ? config.templateId : config.replyTemplateId,
        user_id:config.emailPublicKey, accessToken:config.emailPrivateKey, template_params:params })
    }); } catch {
      diagnostic(kind, 0, 'network_unknown');
      throw Error('email_unconfirmed');
    }
    if (response.status !== 200) {
      let text = '';
      try { text = await readDiagnostic(response); } catch { /* Status remains authoritative. */ }
      diagnostic(kind, response.status, classifyEmailFailure(response.status, text));
    }
    return { status: response.status };
  };
}

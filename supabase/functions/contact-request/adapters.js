// No third-party SDK, retries or console logging. URLs and credentials come only from Edge environment.
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
export function createEmailSender(config, fetcher = fetch) {
  const escape = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char]));
  return async (kind, payload) => {
    // Header/recipient variables retain their validated literal values; content is escaped.
    const params = Object.fromEntries(Object.entries(payload).map(([k,v]) => [k, k === 'from_email' ? v : escape(v)]));
    return fetcher('https://api.emailjs.com/api/v1.0/email/send', {
      method:'POST', headers:{'Content-Type':'application/json'}, signal:AbortSignal.timeout(10000),
      body:JSON.stringify({ service_id:config.serviceId, template_id:kind === 'notification' ? config.templateId : config.replyTemplateId,
        user_id:config.emailPublicKey, accessToken:config.emailPrivateKey, template_params:params })
    });
  };
}

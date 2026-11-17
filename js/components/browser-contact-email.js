// EmailJS browser SDK: public credentials only. Server reservations bound our sends.
export function createBrowserContactSender(config, sdk = () => globalThis.emailjs) {
  const ready = kind => Boolean(sdk()?.send && config.publicKey && config.serviceId &&
    (kind === 'notification' ? config.templateId : config.autoReplyTemplateId && config.autoReplyTemplateId !== config.templateId));
  const send = async (kind, payload) => {
    const template = kind === 'notification' ? config.templateId : config.autoReplyTemplateId;
    if (!sdk()?.send || !config.publicKey || !config.serviceId || !template ||
      (kind === 'reply' && template === config.templateId)) throw Error('email_configuration');
    return sdk().send(config.serviceId, template, payload, {
      publicKey:config.publicKey,
      limitRate:{ id:'agritech-contact-emails', throttle:1100 }
    });
  };
  send.canSend = ready;
  return send;
}

export async function sendReservedContactEmails(result, payload, call, sendEmail, pause = ms => new Promise(r => setTimeout(r, ms))) {
  // Missing transport means old server function: sending here would duplicate its emails.
  if (result.transport !== 'browser' || typeof sendEmail !== 'function') return result;
  let current = result;
  async function attempt(kind) {
    if (sendEmail.canSend && !sendEmail.canSend(kind)) return;
    let claim;
    try { claim = await call('claim_' + kind); } catch { return; }
    if (claim?.stored !== true || claim.transport !== 'browser' || claim.id !== result.id || claim.claimed !== true) return;
    current = { ...current, [kind]:'attempting' };
    let state;
    try {
      const response = await sendEmail(kind, { ...payload, request_id:result.id });
      state = response?.status === 200 ? 'accepted' : 'unknown';
    } catch (error) {
      state = Number.isInteger(error?.status) && error.status >= 400 && error.status < 500 ? 'failed' : 'unknown';
    }
    // A lost finish acknowledgement is uncertain; never resend the email.
    try {
      const finished = await call('finish_' + kind, state);
      current[kind] = finished?.id === result.id && finished.transport === 'browser' && finished.confirmed === true ? state : 'unknown';
    } catch { current[kind] = 'unknown'; }
  }
  if (current.notification === 'pending') await attempt('notification');
  if (current.notification === 'accepted' && current.reply === 'pending' && (!sendEmail.canSend || sendEmail.canSend('reply'))) {
    await pause(1100);
    await attempt('reply');
  }
  return current;
}

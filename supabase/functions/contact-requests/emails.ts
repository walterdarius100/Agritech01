const ENTITY: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escape = (text: string) => text.replace(/[&<>"']/g, char => ENTITY[char]);

export type Contact = {
  id: string;
  name: string;
  email: string;
  phone: string;
  request_type: string;
  need: string;
  message: string;
  source: string;
  received_at: string;
};

function clientReceipt(contact: Contact) {
  const title = 'Nous avons bien reçu votre demande';
  const subject = `${title} — Agri-tech`;
  const typeLabels = new Map([
    ['service', 'Service'],
    ['formation', 'Formation'],
    ['partenariat', 'Partenariat']
  ]);
  const need = `${typeLabels.get(contact.request_type) ?? contact.request_type} – ${contact.need}`;
  const introduction = "Nous vous remercions d'avoir contacté Agri-tech.";
  const confirmation = 'Nous confirmons la bonne réception de votre demande :';
  const received = 'Notre équipe a bien enregistré votre demande et en prendra connaissance très prochainement.';
  const followUp = 'Nous reviendrons vers vous dans les plus brefs délais pour discuter de votre besoin et des prochaines étapes.';
  const thanks = 'Merci pour votre confiance.';
  const name = 'Walter Darius';
  const role = "Directeur général d'Agri-tech";
  const footer = 'Cet e-mail transactionnel vous a été envoyé pour confirmer la réception de votre demande adressée à Agri-tech.';
  const paragraph = 'margin:0 0 16px;overflow-wrap:anywhere;word-wrap:break-word';

  return {
    subject,
    text: [
      `Bonjour ${contact.name},`, introduction, `${confirmation} ${need}.`,
      received, followUp, thanks, `${name}\n${role}`, `---\n\n${footer}`
    ].join('\n\n'),
    html: `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${subject}</title></head>
<body style="margin:0;padding:0;background:#f3f6f3">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#f3f6f3" style="background:#f3f6f3">
<tr><td align="center" style="padding:24px 12px">
<!--[if mso]><table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0"><tr><td><![endif]-->
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px;border-radius:8px;border-collapse:separate;font-family:Arial,sans-serif">
<tr><td bgcolor="#0f3d2e" style="background:#0f3d2e;border-radius:8px 8px 0 0;padding:20px 24px;color:#ffffff;font-size:22px;font-weight:bold">Agri-tech</td></tr>
<tr><td bgcolor="#ffffff" style="background:#ffffff;border-radius:0 0 8px 8px;padding:24px;color:#162f26;font-size:16px;line-height:1.6">
<h1 style="margin:0 0 20px;color:#0f3d2e;font-size:26px;line-height:1.25">${title}</h1>
<p style="${paragraph}">Bonjour <strong>${escape(contact.name)}</strong>,</p>
<p style="${paragraph}">${introduction}</p>
<p style="${paragraph}">${confirmation} <strong style="color:#0f3d2e">${escape(need)}</strong>.</p>
<p style="${paragraph}">${received}</p>
<p style="${paragraph}">${followUp}</p>
<p style="${paragraph}">${thanks}</p>
<p style="margin:0"><strong>${name}</strong><br><em>${role}</em></p>
<p style="margin:22px 0 0;padding-top:16px;border-top:1px solid #dce4df;color:#5b6962;font-size:13px;line-height:1.5"><em>${footer}</em></p>
</td></tr></table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr></table></body></html>`
  };
}

export function contactEmail(contact: Contact, admin: boolean) {
  if (!admin) return clientReceipt(contact);

  const subject = 'Nouvelle demande reçue — Agri-tech';
  const paragraphs = [
    `Identifiant : ${contact.id}`,
    `Nom : ${contact.name}`,
    `E-mail : ${contact.email}`,
    `Téléphone : ${contact.phone}`,
    `Type et besoin : ${contact.request_type} — ${contact.need}`,
    `Message : ${contact.message || 'Aucun (formation)'}`,
    `Date de réception (Haïti) : ${new Intl.DateTimeFormat('fr-HT', {
      timeZone: 'America/Port-au-Prince', dateStyle: 'long', timeStyle: 'short'
    }).format(new Date(contact.received_at))}`
  ];

  const content = paragraphs.map(text => `<p style="margin:0 0 16px;overflow-wrap:anywhere">${escape(text).replace(/\n/g, '<br>')}</p>`).join('');
  return {
    subject,
    text: paragraphs.join('\n\n'),
    html: `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escape(subject)}</title></head>
<body style="margin:0;background:#f3f6f3;color:#162f26;font:16px/1.6 Arial,sans-serif">
<div style="max-width:600px;margin:0 auto;padding:20px">
<div style="background:#0f3d2e;color:white;padding:22px;font-size:22px;font-weight:bold">Agri-tech</div>
<div style="background:white;padding:22px"><h1 style="font-size:22px;margin:0 0 20px">${escape(subject)}</h1>${content}</div>
</div></body></html>`
  };
}

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

export function contactEmail(contact: Contact, admin: boolean) {
  const subject = admin ? 'Nouvelle demande reçue — Agri-tech' : 'Nous avons bien reçu votre demande — Agri-tech';
  const paragraphs = admin ? [
    `Identifiant : ${contact.id}`,
    `Nom : ${contact.name}`,
    `E-mail : ${contact.email}`,
    `Téléphone : ${contact.phone}`,
    `Type et besoin : ${contact.request_type} — ${contact.need}`,
    `Message : ${contact.message || 'Aucun (formation)'}`,
    `Date de réception (Haïti) : ${new Intl.DateTimeFormat('fr-HT', {
      timeZone: 'America/Port-au-Prince', dateStyle: 'long', timeStyle: 'short'
    }).format(new Date(contact.received_at))}`
  ] : [
    'Bonjour,',
    'Nous vous remercions d’avoir contacté Agri-tech.',
    'Votre demande a bien été reçue et enregistrée. Notre équipe prendra connaissance des informations transmises et vous contactera pour discuter de votre besoin.',
    'Merci pour l’intérêt que vous portez à nos services.',
    'Cordialement,\nL’équipe Agri-tech'
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

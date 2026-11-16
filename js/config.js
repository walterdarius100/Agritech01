// Agri-Tech shared configuration.
export const EMAILJS_CONFIG = {
  publicKey: 'FIM6Dgp1FXsfD9fJf',
  serviceId: 'service_z856n3l',
  templateId: 'template_pzsnmea',
  autoReplyTemplateId: '',
  autoReplyVerified: false, // Enable only after verifying the external template and recipients.
  sheetEndpoint: 'https://script.google.com/macros/s/AKfycbw6LvUrYSGt7pyWOK9E4UY_bJpAP9FbhyvfSK5clxBfDSQUPuBVa750vS5y59ybFApJ/exec'
};

export const PARTNERSHIP_NEED = 'Partenariat';
export const FORM_STATUS_DURATION = 10000;
export const FORM_SUCCESS_MESSAGE = 'Votre message a bien été envoyé. Agri-tech vous répondra dès que possible.';
export const FORM_ERROR_MESSAGE = 'Le message n’a pas pu être envoyé pour le moment. Réessayez dans quelques minutes.';
export const NEWSLETTER_SUCCESS_MESSAGE = 'Votre demande a été transmise. L’inscription reste non confirmée.';
export const NEWSLETTER_ERROR_MESSAGE = 'Le message n’a pas pu être envoyé pour le moment. Réessayez dans quelques minutes.';

// Contact uses confirmed Supabase storage after this change is published.
// Never fall back to the legacy email-first path on a storage error.
export const CONTACT_STORAGE_CONFIG = {
  enabled: true,
  endpoint: 'https://lxvegipzhkkujibexnkl.supabase.co/functions/v1/contact-request'
};

export async function storeLead(emailConfig, payload) {
  if (!emailConfig.sheetEndpoint) return;

  try {
    const formData = new URLSearchParams();

    Object.entries(payload).forEach(([key, value]) => {
      formData.append(key, value);
    });

    await fetch(emailConfig.sheetEndpoint, {
      method: 'POST',
      mode: 'no-cors',
      body: formData
    });
  } catch (error) {
    console.warn('Stockage du lead non confirmé:', error);
  }
}

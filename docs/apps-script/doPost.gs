/**
 * Dans le projet Apps Script lié au classeur AgriTech Leads, remplacez
 * le doPost existant par celui-ci et ajoutez normalizeNewsletterValue_.
 * Conservez les constantes et les autres fonctions du projet.
 */
function doPost(e) {
  if (!e || !e.parameter) {
    return ContentService
      .createTextOutput("error: aucune donnée reçue")
      .setMimeType(ContentService.MimeType.TEXT);
  }

  const leadsSS = SpreadsheetApp.getActiveSpreadsheet();
  const leadsSheet = getSheetByNameClean_(leadsSS, LEADS_SHEET_NAME);
  if (!leadsSheet) {
    throw new Error("Onglet '" + LEADS_SHEET_NAME + "' introuvable dans le classeur AgriTech Leads.");
  }

  const data = e.parameter;
  const isNewsletter = normalizeNewsletterValue_(data.need) === "newsletter";
  const newsletterEmail = isNewsletter ? normalizeNewsletterValue_(data.from_email) : "";
  if (isNewsletter && !/^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(newsletterEmail)) {
    return ContentService
      .createTextOutput("error: adresse newsletter invalide")
      .setMimeType(ContentService.MimeType.TEXT);
  }

  const success = ContentService.createTextOutput("success").setMimeType(ContentService.MimeType.TEXT);
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    ensureLeadsControlColumns_(leadsSheet);
    const row = [
      new Date(),
      data.from_name || "",
      isNewsletter ? newsletterEmail : data.from_email || "",
      data.phone || "",
      isNewsletter ? "Newsletter" : data.need || "",
      data.message || "",
      data.consent || "",
      data.source || "Site web",
      data.date || "",
      "",
      "",
      "",
      ""
    ];

    if (isNewsletter) {
      const [headers, ...leads] = leadsSheet.getDataRange().getValues();
      const col = buildColumnMap_(headers);
      if (col["Email"] === undefined || col["Domaine"] === undefined) {
        throw new Error("Colonnes Email et Domaine introuvables dans Leads site web.");
      }
      const alreadySubscribed = leads.some(function(lead) {
        return normalizeNewsletterValue_(lead[col["Domaine"]]) === "newsletter"
          && normalizeNewsletterValue_(lead[col["Email"]]) === newsletterEmail;
      });
      if (alreadySubscribed) {
        return success;
      }
      row[col["Statut import pipeline"]] = "Hors pipeline";
    }

    leadsSheet.appendRow(row);
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }

  if (isNewsletter) {
    try {
      MailApp.sendEmail({
        to: newsletterEmail,
        name: "Agri-tech",
        replyTo: "contact@agritech509ht.com",
        subject: "Votre inscription à la newsletter Agri-tech",
        body: "Bonjour, votre inscription à la newsletter Agri-tech est confirmée. Merci de nous lire et à bientôt ! L’équipe Agri-tech."
      });
    } catch (error) {
      console.error("Échec de l’envoi du bienvenue newsletter : " + error.name);
    }
  }

  return success;
}

function normalizeNewsletterValue_(value) {
  return String(value == null ? "" : value).trim().toLowerCase();
}

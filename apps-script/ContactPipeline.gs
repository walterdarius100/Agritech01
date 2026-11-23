// Enable the Advanced Google Sheets service (identifier "Sheets", version v4).
const PIPELINE_TAB = 'Pipeline clients';
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const DOSSIER_ID = /^AGR-\d{4,}$/;
const PIPELINE_HEADERS = [
  'ID dossier', 'Date 1er contact', 'Nom client / Organisation', 'Contact principal',
  'Téléphone', 'Email', 'Type de projet', 'Localisation', 'Source', 'Canal principal',
  'Niveau intérêt', 'Priorité', 'Statut', 'Prochaine action', 'Responsable',
  'Date réunion prévue', 'Heure réunion prévue', 'Réunion confirmée ?', 'Décision après réunion',
  'Date proposition envoyée', 'Montant proposé USD', 'Date relance 1', 'Date relance 2',
  'Date clôture prévue', 'Décision attendue', 'Dernière interaction', 'Jours sans interaction',
  'Alerte suivi', 'Issue', 'Date prochaine action', 'Notes', 'ID demande Supabase'
];
const UUID_COLUMN = PIPELINE_HEADERS.length - 1;

function doPost(e) {
  const respond = result => ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
  try {
    const body = e && e.postData && e.postData.contents;
    if (!body || body.length > 32768) return respond({ status: 'error', code: 'invalid' });
    const envelope = JSON.parse(body);
    const props = PropertiesService.getScriptProperties();
    const secret = props.getProperty('CONTACT_PIPELINE_SECRET');
    if (!verifyContactSignature_(envelope, secret, Date.now())) {
      return respond({ status: 'error', code: 'unauthorized' });
    }

    const contact = JSON.parse(envelope.payload);
    if (!validContact_(contact)) return respond({ status: 'error', code: 'invalid' });

    const lock = LockService.getScriptLock();
    if (!lock.tryLock(10000)) return respond({ status: 'error', code: 'busy' });
    try {
      return respond(syncContact_(props.getProperty('PIPELINE_SPREADSHEET_ID'), contact, props));
    } finally {
      lock.releaseLock();
    }
  } catch (error) {
    // The provider exception may contain submitted values. Return only fixed codes.
    return respond({ status: 'error', code: 'unconfirmed' });
  }
}

function verifyContactSignature_(envelope, secret, now) {
  if (!secret || !envelope || typeof envelope.timestamp !== 'string' ||
      !/^\d{10}$/.test(envelope.timestamp) || typeof envelope.payload !== 'string' ||
      typeof envelope.signature !== 'string' || !/^[a-f0-9]{64}$/.test(envelope.signature) ||
      Math.abs(now - Number(envelope.timestamp) * 1000) > 120000) return false;
  const input = 'v1\n' + envelope.timestamp + '\n' + envelope.payload;
  const expected = Utilities.computeHmacSha256Signature(input, secret, Utilities.Charset.UTF_8)
    .map(byte => (byte & 255).toString(16).padStart(2, '0')).join('');
  let difference = 0;
  for (let i = 0; i < expected.length; i++) {
    difference |= expected.charCodeAt(i) ^ envelope.signature.charCodeAt(i);
  }
  return difference === 0;
}

function validContact_(contact) {
  return contact && typeof contact.id === 'string' && UUID_V4.test(contact.id) &&
    ['name', 'email', 'phone', 'need', 'message', 'source', 'received_at'].every(key => typeof contact[key] === 'string') &&
    contact.name.length <= 120 && contact.email.length <= 254 && contact.phone.length <= 40 &&
    contact.need.length <= 200 && contact.message.length <= 1200 && contact.source === 'Site Agri-Tech' &&
    Number.isFinite(Date.parse(contact.received_at));
}

function pipelineSheet_(spreadsheetId) {
  if (!spreadsheetId) return null;
  const ss = SpreadsheetApp.openById(spreadsheetId);
  const sheet = ss.getSheets().find(candidate => candidate.getName().trim() === PIPELINE_TAB);
  if (!sheet || sheet.getMaxColumns() < PIPELINE_HEADERS.length) return null;
  const header = sheet.getRange(1, 1, 1, PIPELINE_HEADERS.length).getDisplayValues()[0];
  return header.every((value, index) => value.trim() === PIPELINE_HEADERS[index]) ? sheet : null;
}

function syncContact_(spreadsheetId, contact, props) {
  const sheet = pipelineSheet_(spreadsheetId);
  if (!sheet) return { status: 'error', code: 'layout' };

  const lastRow = sheet.getLastRow();
  const width = Math.max(PIPELINE_HEADERS.length, sheet.getLastColumn());
  // Include one blank row after the used range if the reviewed grid already contains it.
  const scanEnd = Math.min(sheet.getMaxRows(), lastRow + 1);
  if (scanEnd < 2) return { status: 'error', code: 'layout' };
  const range = sheet.getRange(2, 1, scanEnd - 1, width);
  const rows = range.getValues();
  const formulas = range.getFormulas();

  const matches = rows.flatMap((row, index) => row[UUID_COLUMN] === contact.id ? [index] : []);
  if (matches.length) {
    const index = matches[0];
    const id = String(rows[index][0]).trim();
    if (matches.length !== 1 || !DOSSIER_ID.test(id) || formulas[index][0] || formulas[index][UUID_COLUMN]) {
      return { status: 'error', code: 'layout' };
    }
    const note = sheet.getRange(index + 2, UUID_COLUMN + 1).getNote();
    return synced_(contact.id, id, DOSSIER_ID.test(note) ? note : '');
  }

  const sequenceProperty = 'CONTACT_SEQUENCE_' + spreadsheetId;
  let max = Number(props.getProperty(sequenceProperty) || 0);
  let lastOccupied = -1;
  let possibleDuplicate = '';
  rows.forEach((row, index) => {
    const id = String(row[0]).trim();
    if (row.some((value, column) => value !== '' && !formulas[index][column]) || id || row[UUID_COLUMN]) {
      lastOccupied = index;
    }
    if (!DOSSIER_ID.test(id)) return;
    max = Math.max(max, Number(id.slice(4)));
    if (!possibleDuplicate && normalizeText_(row[6]) === normalizeText_(contact.need) &&
        ((normalizePhone_(row[4]) && normalizePhone_(row[4]) === normalizePhone_(contact.phone)) ||
        (normalizeText_(row[5]) && normalizeText_(row[5]) === normalizeText_(contact.email)))) {
      possibleDuplicate = id;
    }
  });
  if (!Number.isSafeInteger(max + 1)) return { status: 'error', code: 'layout' };

  const id = 'AGR-' + String(max + 1).padStart(4, '0');
  const date = sheetDate_(contact.received_at, sheet.getParent().getSpreadsheetTimeZone());
  const notes = [
    'Origine : formulaire du site web',
    'Message : ' + (contact.message || 'Aucun (formation)'),
    'Consentement à être recontacté : Oui',
    possibleDuplicate ? 'Doublon potentiel avec ' + possibleDuplicate + ' (à examiner)' : ''
  ].filter(Boolean).join('\n');
  // Only supplied fields are updated. A:AE blanks, formulas and validation stay in place.
  const cells = {
    0: id, 1: date, 2: contact.name, 3: contact.name, 4: contact.phone, 5: contact.email,
    6: contact.need, 8: contact.source, 9: 'WhatsApp', 10: 'Tiède', 11: 'Moyenne',
    12: 'Nouveau prospect', 13: 'Appel de qualification', 14: 'À assigner',
    17: 'Non', 18: 'À qualifier après réunion', 24: 'Qualifier le besoin du prospect',
    25: date, 27: 'À qualifier', 28: 'En cours', 30: notes, [UUID_COLUMN]: contact.id
  };
  const columns = Object.keys(cells).map(Number);
  const index = lastOccupied + 1;
  if (index >= rows.length || columns.some(column => rows[index][column] !== '' || formulas[index][column])) {
    return { status: 'error', code: 'layout' };
  }

  // Typed stringValue is always literal. The Sheets batch commits all cells or none.
  const requests = columns.map(column => {
    const value = cells[column];
    const cell = { userEnteredValue: typeof value === 'number' ? { numberValue: value } : { stringValue: value } };
    if (column === UUID_COLUMN) cell.note = possibleDuplicate;
    return { updateCells: {
      start: { sheetId: sheet.getSheetId(), rowIndex: index + 1, columnIndex: column },
      rows: [{ values: [cell] }],
      fields: column === UUID_COLUMN ? 'userEnteredValue,note' : 'userEnteredValue'
    } };
  });
  // Persist before committing so a transport failure can leave a gap, never reuse a number.
  props.setProperty(sequenceProperty, String(max + 1));
  Sheets.Spreadsheets.batchUpdate({ requests }, spreadsheetId);
  return synced_(contact.id, id, possibleDuplicate);
}

function synced_(id, dossierId, possibleDuplicateId) {
  return { status: 'synced', id, dossierId, possibleDuplicateId };
}

function normalizeText_(value) {
  return String(value).trim().toLowerCase();
}

function normalizePhone_(value) {
  return String(value).replace(/\D/g, '');
}

function sheetDate_(iso, timezone) {
  const parts = Utilities.formatDate(new Date(iso), timezone, 'yyyy,MM,dd,HH,mm,ss').split(',').map(Number);
  return Date.UTC(parts[0], parts[1] - 1, parts[2], parts[3], parts[4], parts[5]) / 86400000 + 25569;
}

// Run manually after configuring the workbook. Reports layout only, never lead values.
function auditContactPipelineLayout() {
  const id = PropertiesService.getScriptProperties().getProperty('PIPELINE_SPREADSHEET_ID');
  const sheet = pipelineSheet_(id);
  if (!sheet) throw new Error('Vérifier A:AF et le nom de l’onglet.');
  const dataRows = Math.max(0, sheet.getLastRow() - 1);
  const formulaCounts = PIPELINE_HEADERS.map(() => 0);
  if (dataRows) {
    sheet.getRange(2, 1, dataRows, PIPELINE_HEADERS.length).getFormulas()
      .forEach(row => row.forEach((formula, index) => { if (formula) formulaCounts[index]++; }));
  }
  console.log(JSON.stringify({ dataRows, gridRows: sheet.getMaxRows(), formulaCounts }));
}

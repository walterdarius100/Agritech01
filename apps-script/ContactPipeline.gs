// Enable the Advanced Google Sheets service (identifier "Sheets", version v4).
const AGRI_PIPELINE_TAB = 'Pipeline clients';
const AGRI_UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const AGRI_DOSSIER_ID = /^AGR-\d{4,}$/;
const AGRI_PIPELINE_HEADERS = [
  'ID dossier', 'Date 1er contact', 'Nom client / Organisation', 'Contact principal',
  'Téléphone', 'Email', 'Type de projet', 'Localisation', 'Source', 'Canal principal',
  'Niveau intérêt', 'Priorité', 'Statut', 'Prochaine action', 'Responsable',
  'Date réunion prévue', 'Heure réunion prévue', 'Réunion confirmée ?', 'Décision après réunion',
  'Date proposition envoyée', 'Montant proposé USD', 'Date relance 1', 'Date relance 2',
  'Date clôture prévue', 'Décision attendue', 'Dernière interaction', 'Jours sans interaction',
  'Alerte suivi', 'Issue', 'Date prochaine action', 'Notes', 'ID demande Supabase'
];
const AGRI_UUID_COLUMN = AGRI_PIPELINE_HEADERS.length - 1;

function handleAgriContactPost_(e) {
  const respond = result => ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
  try {
    const body = e && e.postData && e.postData.contents;
    if (!body || body.length > 32768) return respond({ status: 'error', code: 'invalid' });
    const envelope = JSON.parse(body);
    const props = PropertiesService.getScriptProperties();
    const secret = props.getProperty('CONTACT_PIPELINE_SECRET');
    if (!agriVerifyContactSignature_(envelope, secret, Date.now())) {
      return respond({ status: 'error', code: 'unauthorized' });
    }

    const contact = JSON.parse(envelope.payload);
    if (props.getProperty('CONTACT_PIPELINE_SHARED_WRITER') !== 'verified') {
      return respond({ status: 'error', code: 'writer_not_ready' });
    }
    if (contact && contact.operation === 'probe') {
      return respond({ status: 'ready', protocol: 'agri-contact-v12-pipeline-2' });
    }
    if (!agriValidContact_(contact)) return respond({ status: 'error', code: 'invalid' });
    return respond(withAgriPipelineLock_(
      () => agriSyncContact_(props.getProperty('PIPELINE_SPREADSHEET_ID'), contact, props),
      () => ({ status: 'error', code: 'busy' })
    ));
  } catch (error) {
    // The provider exception may contain submitted values. Return only fixed codes.
    return respond({ status: 'error', code: 'unconfirmed' });
  }
}

function agriVerifyContactSignature_(envelope, secret, now) {
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

function agriValidContact_(contact) {
  return contact && typeof contact.id === 'string' && AGRI_UUID_V4.test(contact.id) &&
    ['name', 'email', 'phone', 'need', 'message', 'source', 'received_at'].every(key => typeof contact[key] === 'string') &&
    contact.name.length <= 120 && contact.email.length <= 254 && contact.phone.length <= 40 &&
    contact.need.length <= 200 && contact.message.length <= 1200 && contact.source === 'Site Agri-Tech' &&
    Number.isFinite(Date.parse(contact.received_at));
}

function agriPipelineSheet_(spreadsheetId) {
  if (!spreadsheetId) return null;
  const ss = SpreadsheetApp.openById(spreadsheetId);
  const sheet = ss.getSheets().find(candidate => candidate.getName().trim() === AGRI_PIPELINE_TAB);
  if (!sheet || sheet.getMaxColumns() < AGRI_PIPELINE_HEADERS.length) return null;
  const header = sheet.getRange(1, 1, 1, AGRI_PIPELINE_HEADERS.length).getDisplayValues()[0];
  return header.every((value, index) => value.trim() === AGRI_PIPELINE_HEADERS[index]) ? sheet : null;
}

function agriSyncContact_(spreadsheetId, contact, props) {
  let sheet;
  try {
    sheet = agriPipelineSheet_(spreadsheetId);
  } catch {
    return { status: 'error', code: 'sheet_access' };
  }
  if (!sheet) return { status: 'error', code: 'layout' };

  const { rows, formulas, nextIndex } = readAgriPipelineRows_(sheet);

  const matches = rows.flatMap((row, index) => row[AGRI_UUID_COLUMN] === contact.id ? [index] : []);
  if (matches.length) {
    const index = matches[0];
    const id = String(rows[index][0]).trim();
    if (matches.length !== 1 || !AGRI_DOSSIER_ID.test(id) || formulas[index][0] || formulas[index][AGRI_UUID_COLUMN]) {
      return { status: 'error', code: 'layout' };
    }
    const note = sheet.getRange(index + 2, AGRI_UUID_COLUMN + 1).getNote();
    return agriSynced_(contact.id, id, AGRI_DOSSIER_ID.test(note) ? note : '');
  }

  let possibleDuplicate = '';
  rows.forEach(row => {
    const id = String(row[0]).trim();
    if (!AGRI_DOSSIER_ID.test(id)) return;
    if (!possibleDuplicate && agriNormalizeText_(row[6]) === agriNormalizeText_(contact.need) &&
        ((agriNormalizePhone_(row[4]) && agriNormalizePhone_(row[4]) === agriNormalizePhone_(contact.phone)) ||
        (agriNormalizeText_(row[5]) && agriNormalizeText_(row[5]) === agriNormalizeText_(contact.email)))) {
      possibleDuplicate = id;
    }
  });
  const date = agriSheetDate_(contact.received_at, sheet.getParent().getSpreadsheetTimeZone());
  const notes = [
    'Origine : formulaire du site web',
    'Message : ' + (contact.message || 'Aucun (formation)'),
    'Consentement à être recontacté : Oui',
    possibleDuplicate ? 'Doublon potentiel avec ' + possibleDuplicate + ' (à examiner)' : ''
  ].filter(Boolean).join('\n');
  const cells = agriSitePipelineCells_(contact, date, notes);
  if (!agriPipelineTargetIsFree_(sheet, rows, formulas, nextIndex, cells)) {
    return { status: 'error', code: 'layout' };
  }
  const copies = agriPipelineFormulaCopies_(sheet, props, rows, formulas, nextIndex);
  if (!copies) return { status: 'error', code: 'formula_template' };
  const id = reserveAgriPipelineId_(spreadsheetId, props, rows.map(row => row[0]));
  cells[0] = id;
  try {
    writeAgriPipelineCells_(sheet, spreadsheetId, nextIndex, cells, possibleDuplicate, copies);
  } catch {
    return { status: 'error', code: 'sheet_write' };
  }
  return agriSynced_(contact.id, id, possibleDuplicate);
}

function agriSitePipelineCells_(contact, date, notes) {
  // Only supplied fields are updated. A:AE blanks, formulas and validation stay in place.
  return {
    0: '',
    1: date, 2: contact.name, 3: contact.name, 4: contact.phone, 5: contact.email,
    6: contact.need, 8: contact.source, 9: 'WhatsApp', 10: 'Tiède', 11: 'Moyenne',
    12: 'Nouveau prospect', 13: 'Appel de qualification', 14: 'À assigner',
    17: 'Non', 18: 'À qualifier après réunion', 24: 'Qualifier le besoin du prospect',
    25: date, 28: 'En cours', 30: notes, [AGRI_UUID_COLUMN]: contact.id
  };
}

function withAgriPipelineLock_(work, onBusy, waitMs = 10000) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(waitMs)) {
    if (onBusy) return onBusy();
    throw new Error('Pipeline occupé. Conserver la réponse source pour rapprochement.');
  }
  try {
    return work();
  } finally {
    try {
      SpreadsheetApp.flush();
    } finally {
      lock.releaseLock();
    }
  }
}

const AGRI_PIPELINE_FORMULA_COLUMNS = [21, 22, 23, 26, 27];

function readAgriPipelineRows_(sheet) {
  const lastRow = sheet.getLastRow();
  const width = Math.max(AGRI_PIPELINE_HEADERS.length, sheet.getLastColumn());
  // Include one blank row after the used range if the reviewed grid already contains it.
  const scanEnd = Math.min(sheet.getMaxRows(), lastRow + 1);
  if (scanEnd < 2) throw new Error('Grille du pipeline insuffisante.');
  const range = sheet.getRange(2, 1, scanEnd - 1, width);
  const rows = range.getValues();
  const formulas = range.getFormulas();

  let nextIndex = 0;
  rows.forEach((row, index) => {
    const occupied = row.some((value, column) => {
      if (column === 0 || column === AGRI_UUID_COLUMN) return value !== '' || Boolean(formulas[index][column]);
      return value !== '' && !formulas[index][column];
    });
    if (occupied) nextIndex = index + 1;
  });
  return { rows, formulas, nextIndex };
}

function reserveAgriPipelineId_(spreadsheetId, props, ids) {
  const key = 'CONTACT_SEQUENCE_' + spreadsheetId;
  let max = Number(props.getProperty(key) || 0);
  if (!Number.isSafeInteger(max) || max < 0) throw new Error('Séquence AGR invalide.');
  const used = new Set();
  ids.forEach(value => {
    const id = String(value).trim();
    if (!AGRI_DOSSIER_ID.test(id)) return;
    const number = Number(id.slice(4));
    if (used.has(number)) throw new Error('Numérotation AGR existante ambiguë.');
    used.add(number);
    max = Math.max(max, number);
  });
  if (!Number.isSafeInteger(max + 1)) throw new Error('Séquence AGR épuisée.');
  props.setProperty(key, String(max + 1));
  return 'AGR-' + String(max + 1).padStart(4, '0');
}

// Call once inside the Google Form handler wrapped by withAgriPipelineLock_.
function nextAgriPipelineFormId_(sheet) {
  const ss = sheet.getParent();
  const ids = sheet.getLastRow() < 2 ? [] : sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues().flat();
  return reserveAgriPipelineId_(ss.getId(), PropertiesService.getScriptProperties(), ids);
}

// Replace only the final rectangular row write. Keep the Form's qualification/mapping.
function writeAgriPipelineFormRow_(sheet, row) {
  const spreadsheetId = sheet.getParent().getId();
  const props = PropertiesService.getScriptProperties();
  if (spreadsheetId !== props.getProperty('PIPELINE_SPREADSHEET_ID') ||
      !agriPipelineSheet_(spreadsheetId) || sheet.getName().trim() !== AGRI_PIPELINE_TAB ||
      !Array.isArray(row) || row.length !== AGRI_UUID_COLUMN || !AGRI_DOSSIER_ID.test(row[0])) {
    throw new Error('Structure de la ligne Google Form à vérifier.');
  }
  const { rows, formulas, nextIndex } = readAgriPipelineRows_(sheet);
  if (rows.some(existing => String(existing[0]).trim() === row[0])) {
    throw new Error('Identifiant Google Form déjà présent.');
  }
  const cells = {};
  row.forEach((value, column) => {
    if (value !== '' && value != null && !AGRI_PIPELINE_FORMULA_COLUMNS.includes(column)) {
      cells[column] = value instanceof Date ? agriSheetDate_(value, sheet.getParent().getSpreadsheetTimeZone()) : value;
    }
  });
  if (!agriPipelineTargetIsFree_(sheet, rows, formulas, nextIndex, cells)) {
    throw new Error('Aucune ligne préparée et disponible pour Google Form.');
  }
  const rowNumber = nextIndex + 2;
  const copies = agriPipelineFormulaCopies_(sheet, props, rows, formulas, nextIndex);
  if (!copies) throw new Error('Modèle de formules du pipeline absent ou incomplet.');
  writeAgriPipelineCells_(sheet, spreadsheetId, nextIndex, cells, '', copies);
  return rowNumber;
}

function agriPipelineTargetIsFree_(sheet, rows, formulas, index, cells) {
  return index < rows.length && Object.keys(cells).every(
    column => rows[index][column] === '' && !formulas[index][column]
  ) && (!Object.prototype.hasOwnProperty.call(cells, AGRI_UUID_COLUMN) || !sheet.getRange(index + 2, AGRI_UUID_COLUMN + 1).getNote());
}

function agriPipelineFormulaPlan_(props, rows, formulas, index) {
  const raw = props.getProperty('CONTACT_PIPELINE_FORMULA_TEMPLATE_ROW');
  const parsed = raw && /^\d+$/.test(raw.trim()) ? Number(raw.trim()) : null;
  const modelRow = Number.isSafeInteger(parsed) ? parsed : null;
  const source = modelRow === null ? null : modelRow - 2;
  const targetExists = Boolean(rows[index] && formulas[index]);
  const modelIndexValid = source !== null && source >= 0 && source < formulas.length;
  const columns = AGRI_PIPELINE_FORMULA_COLUMNS.map(column => ({
    column: column + 1,
    modelHasFormula: modelIndexValid && Boolean(formulas[source][column]),
    targetHasFormula: targetExists && Boolean(formulas[index][column]),
    targetHasValue: targetExists && rows[index][column] !== ''
  }));
  const missing = columns.filter(column => !column.targetHasFormula);
  const reasons = [];
  if (!targetExists) reasons.push('target_out_of_grid');
  else if (missing.length) {
    if (!raw || !raw.trim()) reasons.push('model_property_missing');
    else if (modelRow === null || modelRow < 2) reasons.push('model_row_invalid');
    else if (!modelIndexValid) reasons.push('model_out_of_scan');
    else if (source >= index) reasons.push('model_not_before_target');
    else if (missing.some(column => !column.modelHasFormula)) reasons.push('model_formula_missing');
    if (missing.some(column => column.targetHasValue)) reasons.push('target_formula_cell_occupied');
  }
  return { modelRow, source, modelIndexValid, targetExists, columns, missing, reasons };
}

function agriPipelineFormulaCopies_(sheet, props, rows, formulas, index) {
  const plan = agriPipelineFormulaPlan_(props, rows, formulas, index);
  if (plan.reasons.length) return null;
  const range = (row, column) => ({
    sheetId: sheet.getSheetId(), startRowIndex: row + 1, endRowIndex: row + 2,
    startColumnIndex: column, endColumnIndex: column + 1
  });
  // Sheets adjusts relative references. Copy each formula without values or formatting.
  return plan.missing.map(({ column }) => ({ copyPaste: {
    source: range(plan.source, column - 1), destination: range(index, column - 1),
    pasteType: 'PASTE_FORMULA', pasteOrientation: 'NORMAL'
  } }));
}

function writeAgriPipelineCells_(sheet, spreadsheetId, index, cells, possibleDuplicate, copies) {
  const requests = Object.keys(cells).map(Number).map(column => {
    const value = cells[column];
    const typed = typeof value === 'number' ? { numberValue: value } :
      typeof value === 'boolean' ? { boolValue: value } : { stringValue: String(value) };
    const cell = { userEnteredValue: typed };
    if (column === AGRI_UUID_COLUMN) cell.note = possibleDuplicate;
    return { updateCells: {
      start: { sheetId: sheet.getSheetId(), rowIndex: index + 1, columnIndex: column },
      rows: [{ values: [cell] }],
      fields: column === AGRI_UUID_COLUMN ? 'userEnteredValue,note' : 'userEnteredValue'
    } };
  });
  Sheets.Spreadsheets.batchUpdate({ requests: [...requests, ...copies] }, spreadsheetId);
}

function agriSynced_(id, dossierId, possibleDuplicateId) {
  return { status: 'synced', id, dossierId, possibleDuplicateId };
}

function agriNormalizeText_(value) {
  return String(value).trim().toLowerCase();
}

function agriNormalizePhone_(value) {
  return String(value).replace(/\D/g, '');
}

function agriSheetDate_(iso, timezone) {
  const parts = Utilities.formatDate(new Date(iso), timezone, 'yyyy,MM,dd,HH,mm,ss').split(',').map(Number);
  return Date.UTC(parts[0], parts[1] - 1, parts[2], parts[3], parts[4], parts[5]) / 86400000 + 25569;
}

// Run manually after configuring the workbook. Reports layout only, never lead values.
function auditContactPipelineLayout() {
  const props = PropertiesService.getScriptProperties();
  const sheet = agriPipelineSheet_(props.getProperty('PIPELINE_SPREADSHEET_ID'));
  if (!sheet) throw new Error('Vérifier A:AF et le nom de l’onglet.');
  const { rows, formulas, nextIndex } = readAgriPipelineRows_(sheet);
  const plan = agriPipelineFormulaPlan_(props, rows, formulas, nextIndex);
  const formulaCounts = AGRI_PIPELINE_HEADERS.map((_, column) =>
    formulas.reduce((count, row) => count + Number(Boolean(row[column])), 0)
  );
  const writeColumns = Object.keys(agriSitePipelineCells_({}, '', '')).map(Number);
  const targetCells = AGRI_PIPELINE_HEADERS.map((_, column) => ({
    column: column + 1,
    hasFormula: plan.targetExists && Boolean(formulas[nextIndex][column]),
    hasValue: plan.targetExists && rows[nextIndex][column] !== ''
  }));
  const siteWriteBlockedColumns = targetCells
    .filter(cell => writeColumns.includes(cell.column - 1) && (cell.hasFormula || cell.hasValue))
    .map(cell => cell.column);
  const targetAfHasNote = plan.targetExists && Boolean(sheet.getRange(nextIndex + 2, AGRI_UUID_COLUMN + 1).getNote());
  if (targetAfHasNote && !siteWriteBlockedColumns.includes(AGRI_UUID_COLUMN + 1)) {
    siteWriteBlockedColumns.push(AGRI_UUID_COLUMN + 1);
  }

  let suggestedModelRow = null;
  for (let index = Math.min(nextIndex, rows.length) - 1; index >= 0; index--) {
    if (AGRI_PIPELINE_FORMULA_COLUMNS.every(column => Boolean(formulas[index][column]))) {
      suggestedModelRow = index + 2;
      break;
    }
  }
  const formulaRowsBelowTarget = formulas.slice(nextIndex + 1).filter(row => row.some(Boolean)).length;
  const report = {
    dataRows: Math.max(0, sheet.getLastRow() - 1),
    gridRows: sheet.getMaxRows(),
    scannedThroughRow: rows.length + 1,
    lastOccupiedRow: nextIndex ? nextIndex + 1 : null,
    formulaRowsBelowTarget,
    formulaCounts,
    nextRow: plan.targetExists ? nextIndex + 2 : null,
    nextRowFormulaColumns: plan.columns.filter(column => column.targetHasFormula).map(column => column.column),
    modelRow: plan.modelRow,
    modelIndexValid: plan.modelIndexValid,
    suggestedModelRow,
    formulaColumns: plan.columns,
    targetCells,
    targetAfHasNote,
    siteWriteBlockedColumns,
    reasons: [...(siteWriteBlockedColumns.length ? ['target_write_cells_occupied'] : []), ...plan.reasons],
    readyForSite: plan.targetExists && !siteWriteBlockedColumns.length && !plan.reasons.length
  };
  console.log(JSON.stringify(report));
  return report;
}

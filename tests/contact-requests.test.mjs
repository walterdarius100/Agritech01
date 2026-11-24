import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { createContactSubmission } from '../js/components/contact-form.js';
import { ACADEMY_NEED, PARTNERSHIP_NEED, contactRequestType, courseNeeds, serviceNeeds } from '../js/config/contact-needs.js';
import { needs } from '../supabase/functions/contact-requests/needs.ts';

test('le catalogue Edge accepte exactement les choix du site, dont Academy', () => {
  const options = [...serviceNeeds, ...courseNeeds, ACADEMY_NEED, PARTNERSHIP_NEED];
  assert.deepEqual(Object.entries(needs), options.map(need => [need, contactRequestType(need)]));
});

test('une réponse perdue survit au rechargement de la page et une demande confirmée libère la clé', async () => {
  const map = new Map();
  const storage = { getItem: key => map.get(key), setItem: (key, value) => map.set(key, value), removeItem: key => map.delete(key) };
  const ids = [];
  const form = { name: 'Marie', email: 'marie@example.test', phone: '12345678', message: 'Test', consent: true, website: '', need: serviceNeeds[0] };
  const fetcher = async (_url, request) => {
    const { id } = JSON.parse(request.body);
    ids.push(id);
    if (ids.length === 1) throw new TypeError('Network error');
    return Response.json({ status: 'recorded', id });
  };
  assert.equal(await createContactSubmission({ storage, fetcher })(form), 'uncertain');
  assert.equal(await createContactSubmission({ storage, fetcher })(form), 'recorded');
  assert.equal(await createContactSubmission({ storage, fetcher })(form), 'recorded');
  assert.equal(ids[0], ids[1]);
  assert.notEqual(ids[1], ids[2]);
  assert.equal(map.size, 0);
});

function pipeline() {
  const requests = [];
  const notes = new Map();
  const props = new Map([['CONTACT_PIPELINE_SECRET', 'fixture'], ['PIPELINE_SPREADSHEET_ID', 'copy'], ['CONTACT_PIPELINE_SHARED_WRITER', 'verified']]);
  const lock = {
    held: false,
    tryLock() {
      if (this.held) return false;
      this.held = true;
      return true;
    },
    releaseLock() { this.held = false; }
  };
  const rows = Array.from({ length: 6 }, () => Array(32).fill(''));
  const formulas = Array.from({ length: 6 }, () => Array(32).fill(''));
  const sheet = {
    getName: () => 'Pipeline clients ',
    getMaxColumns: () => 32,
    getLastColumn: () => 32,
    getMaxRows: () => rows.length,
    getLastRow: () => 5,
    getParent: () => ({ getId: () => 'copy', getSpreadsheetTimeZone: () => 'America/Port-au-Prince' }),
    getSheetId: () => 11,
    getRange(row, column, count, width) {
      if (row === 1) return { getDisplayValues: () => [rows[0]] };
      return {
        getValues: () => rows.slice(row - 1, row - 1 + count).map(cells => cells.slice(column - 1, column - 1 + width)),
        getFormulas: () => formulas.slice(row - 1, row - 1 + count),
        getNote: () => notes.get(row) || ''
      };
    }
  };
  let networkFailure = false;
  const ctx = vm.createContext({
    ContentService: {
      MimeType: { JSON: 'json' },
      createTextOutput: body => ({ setMimeType: () => JSON.parse(body) })
    },
    Utilities: {
      Charset: { UTF_8: 'utf8' },
      computeHmacSha256Signature: (input, secret) => [...createHmac('sha256', secret).update(input).digest()],
      formatDate: () => '2026,11,23,08,00,00'
    },
    PropertiesService: { getScriptProperties: () => ({
      getProperty: key => props.get(key),
      setProperty: (key, value) => props.set(key, value)
    }) },
    LockService: { getScriptLock: () => lock },
    SpreadsheetApp: { flush() { assert.equal(lock.held, true); }, openById: id => {
      assert.equal(id, 'copy');
      assert.equal(lock.held, true);
      return { getSheets: () => [sheet] };
    } },
    Sheets: { Spreadsheets: { batchUpdate({ requests: batch }) {
      assert.equal(lock.held, true);
      requests.push(batch);
      for (const { updateCells, copyPaste } of batch) {
        if (copyPaste) {
          assert.equal(copyPaste.pasteType, 'PASTE_FORMULA');
          const { source, destination } = copyPaste;
          formulas[destination.startRowIndex][destination.startColumnIndex] =
            formulas[source.startRowIndex][source.startColumnIndex];
          continue;
        }
        const { rowIndex, columnIndex } = updateCells.start;
        const cell = updateCells.rows[0].values[0];
        rows[rowIndex][columnIndex] = cell.userEnteredValue.stringValue ?? cell.userEnteredValue.numberValue;
        if (cell.note) notes.set(rowIndex + 1, cell.note);
      }
      if (networkFailure) throw new Error('response lost after writing the batch');
    } } }
  });
  vm.runInContext(readFileSync(new URL('../apps-script/ContactPipeline.gs', import.meta.url), 'utf8'), ctx);
  rows[0] = vm.runInContext('AGRI_PIPELINE_HEADERS.slice()', ctx);
  rows[1][0] = 'AGR-0012';
  rows[1][4] = '509-12345678';
  rows[1][6] = serviceNeeds[0];
  rows[1][12] = 'Dossier en cours';
  for (let index = 2; index <= 4; index++) {
    for (const column of [21, 22, 23, 26, 27]) {
      rows[index][column] = 0;
      formulas[index][column] = '=IF(A1="",0,1)';
    }
  }
  const contact = {
    id: crypto.randomUUID(), name: '=1+2', email: 'marie@example.test', phone: '+50912345678',
    need: serviceNeeds[0], message: '<script>test</script>', source: 'Site Agri-Tech', received_at: '2026-11-23T13:00:00Z'
  };
  const invoke = (data = contact, { valid = true, age = 0 } = {}) => {
    const payload = JSON.stringify(data);
    const timestamp = String(Math.floor(Date.now() / 1000) - age);
    const signature = createHmac('sha256', valid ? 'fixture' : 'other').update(`v1\n${timestamp}\n${payload}`).digest('hex');
    return ctx.handleAgriContactPost_({ postData: { contents: JSON.stringify({ payload, timestamp, signature }) } });
  };
  function invokeGoogleForm(duringWrite) {
    return ctx.withAgriPipelineLock_(() => {
      const row = Array(31).fill('');
      row[0] = ctx.nextAgriPipelineFormId_(sheet);
      if (duringWrite) duringWrite();
      row[2] = 'Consultation Google Form';
      row[12] = 'Qualification historique';
      row[27] = 'Alerte héritée';
      ctx.writeAgriPipelineFormRow_(sheet, row);
      return row[0];
    });
  }
  return { invoke, invokeGoogleForm, props, rows, formulas, requests, contact, loseAck: value => { networkFailure = value; } };
}

test('Apps Script refuse signatures invalides et anciennes, sans accéder au classeur', () => {
  const p = pipeline();
  assert.equal(p.invoke(undefined, { valid: false }).code, 'unauthorized');
  assert.equal(p.invoke(undefined, { age: 121 }).code, 'unauthorized');
  assert.equal(p.requests.length, 0);
});

test('Apps Script conserve les AGR et formules, distingue doublon commercial et rejeu, écrit des chaînes littérales', () => {
  const p = pipeline();
  p.loseAck(true);
  assert.equal(p.invoke().code, 'sheet_write');
  assert.deepEqual(p.invoke(), { status: 'synced', id: p.contact.id, dossierId: 'AGR-0013', possibleDuplicateId: 'AGR-0012' });
  p.loseAck(false);
  const other = { ...p.contact, id: crypto.randomUUID() };
  assert.equal(p.invoke(other).dossierId, 'AGR-0014');
  assert.equal(p.requests.length, 2);
  assert.equal(p.rows[1][12], 'Dossier en cours');
  assert.equal(p.rows[2][2], '=1+2');
  assert.equal(p.rows[2][26], 0);
  assert.equal(p.rows[2][31], p.contact.id);
  assert.match(p.rows[2][30], /Doublon potentiel avec AGR-0012/);
  assert.ok(p.requests.every(batch => batch.every(({ updateCells }) => updateCells.start.columnIndex !== 26)));
  assert.equal(p.requests[0].find(({ updateCells }) => updateCells.start.columnIndex === 2)
    .updateCells.rows[0].values[0].userEnteredValue.formulaValue, undefined);
  assert.equal(p.rows[0][30], 'Notes');
});

test('Apps Script refuse de déplacer des colonnes ou de remplacer une formule cible', () => {
  const p = pipeline();
  p.formulas[2][30] = '=IF(A3="","",1)';
  assert.equal(p.invoke().code, 'layout');
  p.formulas[2][30] = '';
  p.rows[0][30] = 'Autre colonne';
  assert.equal(p.invoke().code, 'layout');
  assert.equal(p.requests.length, 0);
});

test('site et Google Form réservent des AGR distincts sous le même verrou et préservent V, W, X, AA, AB', () => {
  const p = pipeline();
  p.props.delete('CONTACT_PIPELINE_SHARED_WRITER');
  assert.equal(p.invoke().code, 'writer_not_ready');
  assert.equal(p.requests.length, 0);
  assert.equal(p.invokeGoogleForm(), 'AGR-0013');
  p.props.set('CONTACT_PIPELINE_SHARED_WRITER', 'verified');
  assert.equal(p.invoke().dossierId, 'AGR-0014');
  assert.equal(p.invoke().dossierId, 'AGR-0014');
  assert.equal(p.invokeGoogleForm(() => {
    const concurrentSite = { ...p.contact, id: crypto.randomUUID() };
    assert.equal(p.invoke(concurrentSite).code, 'busy');
  }), 'AGR-0015');
  assert.equal(p.rows[2][12], 'Qualification historique');
  assert.equal(p.rows[2][31], '');
  assert.equal(p.rows[3][31], p.contact.id);
  assert.equal(p.requests.length, 3);
  assert.ok(p.requests.every(batch => batch.every(({ updateCells }) =>
    ![21, 22, 23, 26, 27].includes(updateCells.start.columnIndex))));
});

test('un dossier sans formules bénéficie du modèle approuvé dans le même lot atomique', () => {
  const p = pipeline();
  const columns = [21, 22, 23, 26, 27];
  for (const column of columns) {
    p.formulas[1][column] = '=IF(A2="","",0)';
    p.formulas[2][column] = '';
    p.rows[2][column] = '';
  }
  p.formulas[2][27] = '=EXISTING()';
  assert.equal(p.invoke({ operation: 'probe' }).protocol, 'agri-contact-v12-pipeline-2');
  assert.equal(p.invoke().code, 'formula_template');
  assert.equal(p.requests.length, 0);
  p.props.set('CONTACT_PIPELINE_FORMULA_TEMPLATE_ROW', '2');
  assert.equal(p.invoke().dossierId, 'AGR-0013');
  const copies = p.requests[0].filter(request => request.copyPaste);
  assert.deepEqual(Array.from(copies, request => request.copyPaste.destination.startColumnIndex), [21, 22, 23, 26]);
  assert.ok(columns.every(column => p.formulas[2][column]));
  assert.equal(p.formulas[2][27], '=EXISTING()');
  assert.equal(p.rows[2][31], p.contact.id);
  assert.equal(p.invoke().dossierId, 'AGR-0013');
  assert.equal(p.requests.length, 1);
});

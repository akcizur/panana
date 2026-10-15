/** Centralized spreadsheet access. Only Apps Script writes operational data. */
function spreadsheet_() {
  const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (id) return SpreadsheetApp.openById(id);
  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (!active) throw appError_('Není připojen cílový spreadsheet. Nastavte Script Property SPREADSHEET_ID.', 'CONFIG_ERROR');
  return active;
}

function sheet_(name) {
  if (!Object.prototype.hasOwnProperty.call(SHEET_HEADERS, name)) throw appError_('Neznámý list: ' + name, 'SCHEMA_ERROR');
  const sh = spreadsheet_().getSheetByName(name);
  if (!sh) throw appError_('Chybí list ' + name + '. Spusťte initializeWorkbook().', 'SCHEMA_ERROR');
  return sh;
}

function records_(name) {
  const sh = sheet_(name);
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return [];
  const headers = SHEET_HEADERS[name];
  const values = sh.getRange(2, 1, lastRow - 1, headers.length).getValues();
  return values.map(function(row, i) {
    const rec = { _rowNumber: i + 2 };
    headers.forEach(function(h, col) { rec[h] = row[col]; });
    return rec;
  }).filter(function(rec) {
    return SHEET_HEADERS[name].some(function(h) { return rec[h] !== '' && rec[h] !== null; });
  });
}

function findRecord_(name, field, value) {
  const found = records_(name).find(function(rec) { return String(rec[field] == null ? '' : rec[field]) === String(value == null ? '' : value); });
  return found || null;
}

function appendRecord_(name, record) {
  const sh = sheet_(name);
  const headers = SHEET_HEADERS[name];
  const row = headers.map(function(header) { return Object.prototype.hasOwnProperty.call(record, header) && record[header] != null ? record[header] : ''; });
  sh.appendRow(row);
  return sh.getLastRow();
}

function updateRecord_(name, keyField, keyValue, patch) {
  if (APPEND_ONLY_SHEETS.indexOf(name) !== -1) throw appError_('Auditní list ' + name + ' je append-only.', 'APPEND_ONLY');
  const rec = findRecord_(name, keyField, keyValue);
  if (!rec) throw appError_('Záznam nebyl nalezen: ' + name + ' / ' + keyValue, 'NOT_FOUND');
  const headers = SHEET_HEADERS[name];
  Object.keys(patch).forEach(function(field) {
    if (headers.indexOf(field) === -1) throw appError_('Neznámý sloupec ' + field + ' v ' + name, 'SCHEMA_ERROR');
    if (field === keyField) throw appError_('Primární ID nelze změnit.', 'VALIDATION_ERROR');
  });
  const next = Object.assign({}, rec, patch);
  const row = headers.map(function(header) { return next[header] == null ? '' : next[header]; });
  sheet_(name).getRange(rec._rowNumber, 1, 1, headers.length).setValues([row]);
  return next;
}

function configValue_(key) {
  const rec = findRecord_('CONFIG', 'Key', key);
  return rec ? String(rec.Value == null ? '' : rec.Value).trim() : '';
}

function setConfigValue_(key, value) {
  const rec = findRecord_('CONFIG', 'Key', key);
  if (rec) return updateRecord_('CONFIG', 'Key', key, { Value: value });
  appendRecord_('CONFIG', { Key: key, Value: value });
  return { Key: key, Value: value };
}

function boolValue_(value) {
  return value === true || String(value).toUpperCase() === 'TRUE' || String(value) === '1';
}

function asIso_(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  return isNaN(date.getTime()) ? String(value) : Utilities.formatDate(date, APP_CONFIG.TIMEZONE, "yyyy-MM-dd'T'HH:mm:ssXXX");
}

function publicRecord_(record) {
  const out = {};
  Object.keys(record || {}).forEach(function(key) {
    if (key.charAt(0) === '_') return;
    const value = record[key];
    out[key] = value instanceof Date ? asIso_(value) : value;
  });
  return out;
}

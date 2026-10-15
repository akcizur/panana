/** Canonical Google Sheets schema. Existing data is never reset or silently migrated. */
const APP_CONFIG = Object.freeze({
  NAME: 'Sklad a výroba',
  TIMEZONE: 'Europe/Prague',
  QR_MODE: 'DEEPLINK',
  DEFAULT_LABEL_FORMAT: '50x30mm',
  DEFAULT_CAMERA_SCANNER: 'FALSE',
  POSITION_GRID: 'A1:D10',
  DEFAULT_LABEL_REQUIRED: 'FALSE',
  PACK_STATUS_VALUES: 'NOVY,OTEVRENY,VYPRAZDNENY'
});

const SHEET_HEADERS = Object.freeze({
  CONFIG: ['Key', 'Value'],
  DB_UZIVATELE: ['Email', 'Role', 'Aktivni', 'Created_At', 'Updated_At'],
  ID_COUNTERS: ['Entity_Type', 'Year_YY', 'Last_Sequence', 'Updated_At'],
  DB_SUROVINY: ['Surovina_ID', 'Nazev_Suroviny', 'Aktivni', 'Created_At', 'Updated_At'],
  DB_POZICE: ['Pozice_ID', 'Pozice', 'Aktivni'],
  SKLAD_SUROVIN: ['Pack_ID', 'Surovina_ID', 'Lot', 'Expirace_MMYY', 'Pocatecni_Hmotnost', 'Jednotka_Hmotnosti', 'Stav_Packu', 'Box_Number', 'Pozice', 'Received_At', 'Opened_At', 'Emptied_At', 'Created_At', 'Updated_At', 'Created_By', 'Updated_By'],
  FRONTEND_SKLAD: ['Pack_ID', 'Nazev_Suroviny', 'Lot', 'Expirace_MMYY', 'Stav_Packu', 'Box_Number', 'Pozice', 'Pocatecni_Hmotnost', 'Jednotka_Hmotnosti', 'Updated_At', 'FIFO_Upozorneni'],
  DB_PRODUKTY: ['Produkt_ID', 'Nazev_Produktu', 'Forma_Vystupu', 'Typ_Vstupu', 'Kapsli_na_Baleni', 'Etiketa_Povinna', 'Aktivni', 'Created_At', 'Updated_At'],
  DB_RECEPTURY: ['Receptura_ID', 'Nazev_Receptury', 'Verze', 'Forma_Vystupu', 'Aktivni', 'Poznamka', 'Created_At', 'Created_By'],
  DB_RECEPTURY_SUROVINY: ['Receptura_Polozka_ID', 'Receptura_ID', 'Poradi', 'Surovina_ID', 'Poznamka'],
  PLAN_VYROBY: ['Plan_Vyroby_ID', 'Cislo_Planu', 'Produkt_ID', 'Vstupni_Typ', 'Receptura_ID', 'Vyrobni_Lot', 'Datum_Planu', 'Priorita', 'Planovany_Pocet_Kapsli', 'Skutecny_Pocet_Kapsli', 'Stav', 'Datum_Zahajeni', 'Datum_Dokonceni', 'Operator', 'Poznamka', 'Created_At', 'Updated_At'],
  PLAN_VYROBY_SUROVINY: ['Plan_Polozka_ID', 'Plan_Vyroby_ID', 'Pack_ID', 'Role', 'Stav_Pouziti', 'Pouzito_At', 'Operator', 'Poznamka'],
  PLAN_VYROBY_OPERACE: ['Operace_ID', 'Plan_Vyroby_ID', 'Poradi', 'Typ_Operace', 'Stav', 'Planovany_Zacatek', 'Skutecny_Zacatek', 'Skutecny_Konec', 'Operator', 'Pocet_Kapsli_Plan', 'Pocet_Kapsli_Skutecnost', 'Poznamka'],
  SKLAD_POLOTOVARU: ['Polotovar_ID', 'Plan_Vyroby_ID', 'Produkt_ID', 'Typ_Polotovaru', 'Vyrobni_Lot', 'Pocet_Kapsli_Aktualne', 'Stav_Polotovaru', 'Box_Number', 'Pozice', 'Created_At', 'Updated_At', 'Poznamka'],
  DB_BALICI_MATERIALY: ['Material_ID', 'Nazev_Materialu', 'Typ_Materialu', 'Jednotka', 'Aktivni', 'Created_At', 'Updated_At'],
  SKLAD_BALICIHO_MATERIALU: ['Stock_Material_ID', 'Material_ID', 'Lot', 'Box_Number', 'Pozice', 'Mnozstvi_Aktualni', 'Jednotka', 'Created_At', 'Updated_At'],
  PLAN_BALENI: ['Plan_Baleni_ID', 'Cislo_Planu', 'Plan_Vyroby_ID', 'Produkt_ID', 'Zdroj_Typ', 'Zdroj_ID', 'Vyrobni_Lot', 'Kapsli_na_Baleni', 'Planovany_Pocet_Baleni', 'Skutecny_Pocet_Baleni', 'Stav', 'Datum_Zahajeni', 'Datum_Dokonceni', 'Operator', 'Poznamka', 'Created_At', 'Updated_At'],
  PLAN_BALENI_MATERIAL: ['Plan_Baleni_Polozka_ID', 'Plan_Baleni_ID', 'Material_ID', 'Stock_Material_ID', 'Mnozstvi_Plan', 'Mnozstvi_Skutecnost', 'Jednotka', 'Poznamka'],
  SKLAD_HOTOVYCH_VYROBKU: ['Hotovy_Stock_ID', 'Plan_Baleni_ID', 'Produkt_ID', 'Vyrobni_Lot', 'Pocet_Baleni_Aktualne', 'Stav_Zpracovani', 'Box_Number', 'Pozice', 'Created_At', 'Updated_At'],
  PLAN_ETYKETOVANI: ['Plan_Etiketovani_ID', 'Cislo_Planu', 'Plan_Baleni_ID', 'Hotovy_Stock_ID', 'Produkt_ID', 'Vyrobni_Lot', 'Pocet_Kusu_Plan', 'Pocet_Kusu_Skutecnost', 'Stav', 'Datum_Zahajeni', 'Datum_Dokonceni', 'Operator', 'Poznamka', 'Created_At', 'Updated_At'],
  PLAN_ETYKETOVANI_MATERIAL: ['Plan_Etiketovani_Polozka_ID', 'Plan_Etiketovani_ID', 'Material_ID', 'Stock_Material_ID', 'Mnozstvi_Plan', 'Mnozstvi_Skutecnost', 'Jednotka'],
  PREDANI_EXPEDICI: ['Predani_ID', 'Timestamp', 'Predal', 'Prevzal', 'Reference_Expedice', 'Poznamka'],
  PREDANI_EXPEDICI_POLOZKY: ['Predani_Polozka_ID', 'Predani_ID', 'Hotovy_Stock_ID', 'Produkt_ID', 'Vyrobni_Lot', 'Pocet_Baleni', 'Jednotka_Baleni', 'Poznamka'],
  POHYBY_LOG: ['Movement_ID', 'Timestamp', 'Entita_Typ', 'Entita_ID', 'Action', 'Delta_Mnozstvi', 'Jednotka', 'From_Box_Number', 'From_Position', 'To_Box_Number', 'To_Position', 'Reference_Type', 'Reference_ID', 'Operation_ID', 'User', 'Note'],
  QR_LABEL_LOG: ['Label_Event_ID', 'Timestamp', 'Pack_ID', 'Action', 'Payload_Mode', 'Payload_Version', 'App_Base_URL', 'Label_Format', 'User', 'Note'],
  OPERATIONS_LOG: ['Operation_ID', 'Idempotency_Key', 'Operation_Type', 'Entity_ID', 'Requested_By', 'Started_At', 'Completed_At', 'Status', 'Payload_Hash', 'Error_Code', 'Error_Message']
});

const APPEND_ONLY_SHEETS = Object.freeze(['POHYBY_LOG', 'QR_LABEL_LOG']);
const CONFIG_DEFAULTS = Object.freeze({
  APP_NAME: APP_CONFIG.NAME,
  TIMEZONE: APP_CONFIG.TIMEZONE,
  APP_BASE_URL: '',
  QR_PAYLOAD_MODE: APP_CONFIG.QR_MODE,
  QR_LABEL_FORMAT_DEFAULT: APP_CONFIG.DEFAULT_LABEL_FORMAT,
  QR_ENABLE_CAMERA_SCANNER: APP_CONFIG.DEFAULT_CAMERA_SCANNER,
  POSITION_GRID: APP_CONFIG.POSITION_GRID,
  DEFAULT_LABEL_REQUIRED: APP_CONFIG.DEFAULT_LABEL_REQUIRED,
  PACK_STATUS_VALUES: APP_CONFIG.PACK_STATUS_VALUES
});

/** Run manually from the bound spreadsheet's Apps Script editor. Creates missing sheets only. */
function initializeWorkbook() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('Otevřete Apps Script z cílového Google Sheetu: Rozšíření → Apps Script.');
  ss.setSpreadsheetTimeZone(APP_CONFIG.TIMEZONE);
  const created = [];
  const initialized = [];
  Object.keys(SHEET_HEADERS).forEach(function(name) {
    let sheet = ss.getSheetByName(name);
    if (!sheet) {
      sheet = ss.insertSheet(name);
      created.push(name);
    }
    const headers = SHEET_HEADERS[name];
    const lastColumn = sheet.getLastColumn();
    const existing = lastColumn ? sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0] : [];
    if (existing.every(function(value) { return value === ''; })) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.setFrozenRows(1);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
      initialized.push(name);
    } else if (existing.length !== headers.length || headers.some(function(h, i) { return existing[i] !== h; })) {
      throw new Error('Nesoulad hlavičky listu ' + name + '. Data nebyla změněna. Opravte hlavičku podle SHEET_HEADERS a spusťte inicializaci znovu.');
    }
  });
  seedConfig_(ss);
  seedPositions_(ss);
  seedCounters_(ss);
  return { spreadsheetId: ss.getId(), created: created, initialized: initialized, message: 'Schéma ověřeno. Existující provozní řádky nebyly smazány ani přepsány.' };
}

function seedConfig_(ss) {
  const sheet = ss.getSheetByName('CONFIG');
  const rows = sheet.getDataRange().getValues();
  const existing = {};
  rows.slice(1).forEach(function(row) { if (row[0]) existing[String(row[0])] = true; });
  Object.keys(CONFIG_DEFAULTS).forEach(function(key) {
    if (!existing[key]) sheet.appendRow([key, CONFIG_DEFAULTS[key]]);
  });
}

function seedPositions_(ss) {
  const sheet = ss.getSheetByName('DB_POZICE');
  const rows = sheet.getDataRange().getDisplayValues();
  const existing = {};
  rows.slice(1).forEach(function(row) { if (row[1]) existing[String(row[1])] = true; });
  ['A', 'B', 'C', 'D'].forEach(function(box) {
    for (let n = 1; n <= 10; n++) {
      const pos = box + n;
      if (!existing[pos]) sheet.appendRow(['POS-' + pos, pos, true]);
    }
  });
}

function seedCounters_(ss) {
  const sheet = ss.getSheetByName('ID_COUNTERS');
  const rows = sheet.getDataRange().getDisplayValues();
  const currentYear = Number(Utilities.formatDate(new Date(), APP_CONFIG.TIMEZONE, 'yy'));
  const types = ['PACK', 'VYROBNI_PLAN', 'PLAN_BALENI', 'ETIKETOVANI', 'PREDANI'];
  types.forEach(function(type) {
    const found = rows.slice(1).some(function(row) { return row[0] === type && Number(row[1]) === currentYear; });
    if (!found) sheet.appendRow([type, currentYear, 0, new Date()]);
  });
}

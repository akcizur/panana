import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const appDir = path.join(root, 'apps-script');

async function walk(dir) {
  const result = [];
  for (const item of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, item.name);
    if (item.isDirectory()) result.push(...await walk(full));
    else result.push(full);
  }
  return result;
}
function fail(message) { throw new Error(message); }
function extractScripts(html, file) {
  const matches = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script\s*>/gi)];
  if (!matches.length) fail(file + ' neobsahuje očekávaný inline <script>.');
  return matches.map((match, index) => ({ file: file + '#script-' + (index + 1), source: match[1] }));
}
function expectThrow(fn, description) {
  let threw = false;
  try { fn(); } catch { threw = true; }
  assert.equal(threw, true, description + ' musí být odmítnuto.');
}

const files = (await walk(appDir)).sort();
const gsFiles = files.filter(file => file.endsWith('.gs'));
assert.ok(gsFiles.length >= 12, 'Chybí serverové Apps Script soubory.');
const serverSources = await Promise.all(gsFiles.map(file => readFile(file, 'utf8')));
const combinedServer = serverSources.join('\n\n');
new vm.Script(combinedServer, { filename: 'apps-script/server-bundle.gs' });
console.log('✓ Serverové .gs soubory lze parsovat společně (' + gsFiles.length + ' souborů).');

const manifest = JSON.parse(await readFile(path.join(appDir, 'appsscript.json'), 'utf8'));
assert.equal(manifest.timeZone, 'Europe/Prague');
assert.equal(manifest.runtimeVersion, 'V8');
console.log('✓ appsscript.json je platný a používá Europe/Prague + V8.');

const htmlFiles = ['App.html', 'QrVendor.html', 'Index.html'];
const inlineScripts = [];
for (const name of htmlFiles) {
  let html = await readFile(path.join(appDir, name), 'utf8');
  if (name === 'Index.html') {
    html = html
      .replace(/<\?!=\s*JSON\.stringify\(initialView\)\s*\?>/g, '"dashboard"')
      .replace(/<\?!=\s*JSON\.stringify\(initialPackId\)\s*\?>/g, '""');
  }
  inlineScripts.push(...extractScripts(html, name));
}
for (const item of inlineScripts) new vm.Script(item.source, { filename: item.file });
console.log('✓ Inline JavaScript v HTML partials lze parsovat (' + inlineScripts.length + ' bloků).');

const sandbox = {};
vm.runInNewContext(combinedServer, sandbox, { filename: 'apps-script/server-runtime.js' });
assert.equal(sandbox.validatePackId_('P-26-000123'), 'P-26-000123');
expectThrow(() => sandbox.validatePackId_('P-26-123'), 'Neplatné Pack_ID');
assert.equal(sandbox.validateExpiry_('04/28'), '04/28');
expectThrow(() => sandbox.validateExpiry_('13/28'), 'Neplatná expirace');
assert.equal(sandbox.validateWeightUnit_('G'), 'g');
expectThrow(() => sandbox.validateWeightUnit_('lb'), 'Nepovolená jednotka hmotnosti');
assert.equal(sandbox.validateAppBaseUrl_('https://script.google.com/macros/s/AbC_123-xyz/exec'), 'https://script.google.com/macros/s/AbC_123-xyz/exec');
expectThrow(() => sandbox.validateAppBaseUrl_('https://script.google.com/macros/s/AbC_123-xyz/dev'), 'Vývojová /dev URL');
expectThrow(() => sandbox.validateAppBaseUrl_('https://example.com/exec'), 'Externí host QR URL');
assert.equal(sandbox.requireNumber_('2.5', 'test', 0, 5), 2.5);
expectThrow(() => sandbox.requireNumber_('-1', 'test', 0, 5), 'Záporné množství');
assert.equal(sandbox.requireInteger_('12', 'ks', 1, 100), 12);
expectThrow(() => sandbox.requireInteger_('12.5', 'ks', 1, 100), 'Desetinný počet kusů');
assert.equal(sandbox.validateDateOnly_('2026-10-15'), '2026-10-15');
expectThrow(() => sandbox.validateDateOnly_('2026-02-30'), 'Neplatné kalendářní datum');
expectThrow(() => sandbox.validateDateOnly_('15/10/2026'), 'Neplatný formát data');
console.log('✓ Validační testy Pack_ID, expirace, jednotek, URL, celých počtů a dat prošly.');

const config = await readFile(path.join(appDir, 'Config.gs'), 'utf8');
for (const required of [
  'SKLAD_SUROVIN','FRONTEND_SKLAD','PLAN_VYROBY','PLAN_VYROBY_SUROVINY','PLAN_VYROBY_OPERACE',
  'SKLAD_POLOTOVARU','DB_BALICI_MATERIALY','SKLAD_BALICIHO_MATERIALU','PLAN_BALENI','PLAN_BALENI_MATERIAL',
  'SKLAD_HOTOVYCH_VYROBKU','PLAN_ETYKETOVANI','PLAN_ETYKETOVANI_MATERIAL','PREDANI_EXPEDICI',
  'PREDANI_EXPEDICI_POLOZKY','POHYBY_LOG','QR_LABEL_LOG','OPERATIONS_LOG'
]) assert.ok(config.includes(required), 'Chybí povinný list: ' + required);
assert.ok(config.includes("APPEND_ONLY_SHEETS = Object.freeze(['POHYBY_LOG', 'QR_LABEL_LOG'])"), 'Auditní listy musí být append-only.');
const qrVendor = await readFile(path.join(appDir, 'QrVendor.html'), 'utf8');
assert.ok(!/<script\s+src=/i.test(qrVendor), 'QR generátor nesmí být závislý na externím script src.');
assert.ok(qrVendor.includes('993e88f396640f881b69f98db7a4d17401ef83ca'), 'QR vendor bundle nemá připnutý zdrojový SHA.');
console.log('✓ Kritická schémata, append-only logy a lokální QR bundle jsou přítomné.');

console.log('Apps Script validation passed.');

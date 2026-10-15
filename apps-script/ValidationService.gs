function appError_(message, code) {
  const err = new Error(message);
  err.code = code || 'APP_ERROR';
  return err;
}

function requiredText_(value, label, maxLength) {
  const text = String(value == null ? '' : value).trim();
  if (!text) throw appError_(label + ' je povinné.', 'VALIDATION_ERROR');
  if (text.length > (maxLength || 200)) throw appError_(label + ' je příliš dlouhé.', 'VALIDATION_ERROR');
  return text;
}

function optionalText_(value, maxLength) {
  const text = String(value == null ? '' : value).trim();
  if (text.length > (maxLength || 500)) throw appError_('Text překračuje povolenou délku.', 'VALIDATION_ERROR');
  return text;
}

function requireNumber_(value, label, min, max) {
  const n = Number(value);
  if (!isFinite(n) || n < min || (max != null && n > max)) {
    throw appError_(label + ' musí být číslo v povoleném rozsahu.', 'VALIDATION_ERROR');
  }
  return n;
}

function requireEnum_(value, allowed, label) {
  if (allowed.indexOf(value) === -1) throw appError_(label + ' má nepovolenou hodnotu.', 'VALIDATION_ERROR');
  return value;
}

function validatePackId_(value) {
  const id = String(value == null ? '' : value).trim().toUpperCase();
  if (!/^P-\d{2}-\d{6}$/.test(id)) throw appError_('Neplatné Pack_ID.', 'VALIDATION_ERROR');
  return id;
}

function validateExpiry_(value) {
  const exp = String(value == null ? '' : value).trim();
  if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(exp)) throw appError_('Expirace musí být ve formátu MM/YY.', 'VALIDATION_ERROR');
  return exp;
}

function validateWeightUnit_(value) {
  return requireEnum_(String(value || 'g').trim().toLowerCase(), ['g', 'kg'], 'Jednotka hmotnosti');
}

function activePosition_(position) {
  const p = requiredText_(position, 'Pozice', 8).toUpperCase();
  const rec = records_('DB_POZICE').find(function(row) { return row.Pozice === p && boolValue_(row.Aktivni); });
  if (!rec) throw appError_('Pozice ' + p + ' neexistuje nebo není aktivní.', 'VALIDATION_ERROR');
  return p;
}

function activeMaterialStock_(stockId) {
  const stock = findRecord_('SKLAD_BALICIHO_MATERIALU', 'Stock_Material_ID', stockId);
  if (!stock || Number(stock.Mnozstvi_Aktualni) < 0) throw appError_('Skladová položka obalového materiálu neexistuje nebo je neplatná.', 'VALIDATION_ERROR');
  return stock;
}

function requireInteger_(value,label,min,max){
  const n=requireNumber_(value,label,min,max);
  if(!Number.isSafeInteger(n))throw appError_(label+' musí být celé číslo.','VALIDATION_ERROR');
  return n;
}
function validateDateOnly_(value){
  const text=String(value==null?'':value).trim();
  if(!/^\d{4}-\d{2}-\d{2}$/.test(text))throw appError_('Datum musí být ve formátu YYYY-MM-DD.','VALIDATION_ERROR');
  const parts=text.split('-').map(Number);
  const date=new Date(Date.UTC(parts[0],parts[1]-1,parts[2]));
  if(date.getUTCFullYear()!==parts[0]||date.getUTCMonth()!==parts[1]-1||date.getUTCDate()!==parts[2])throw appError_('Datum není platné.','VALIDATION_ERROR');
  return text;
}
function requireStockQuantity_(value,label,unit,min,max){
  const n=requireNumber_(value,label,min==null?0:min,max==null?1000000000:max);
  if(String(unit||'').toLowerCase()==='ks'&&!Number.isSafeInteger(n))throw appError_(label+' musí být celé číslo pro jednotku ks.','VALIDATION_ERROR');
  return n;
}

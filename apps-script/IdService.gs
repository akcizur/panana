const ID_ENTITY_SPECS = Object.freeze({
  PACK: { prefix:'P', sheet:'SKLAD_SUROVIN', key:'Pack_ID' },
  VYROBNI_PLAN: { prefix:'VY', sheet:'PLAN_VYROBY', key:'Plan_Vyroby_ID' },
  PLAN_BALENI: { prefix:'PB', sheet:'PLAN_BALENI', key:'Plan_Baleni_ID' },
  ETIKETOVANI: { prefix:'ET', sheet:'PLAN_ETYKETOVANI', key:'Plan_Etiketovani_ID' },
  PREDANI: { prefix:'EXP', sheet:'PREDANI_EXPEDICI', key:'Predani_ID' },
  SUROVINA: { prefix:'S', sheet:'DB_SUROVINY', key:'Surovina_ID' },
  PRODUKT: { prefix:'PR', sheet:'DB_PRODUKTY', key:'Produkt_ID' },
  MATERIAL: { prefix:'MAT', sheet:'DB_BALICI_MATERIALY', key:'Material_ID' },
  MATERIAL_STOCK: { prefix:'MS', sheet:'SKLAD_BALICIHO_MATERIALU', key:'Stock_Material_ID' },
  RECEPTURA: { prefix:'R', sheet:'DB_RECEPTURY', key:'Receptura_ID' },
  POLOTOVAR: { prefix:'PO', sheet:'SKLAD_POLOTOVARU', key:'Polotovar_ID' }
});

/** Sequence IDs can only be reserved while the enclosing operation holds ScriptLock. */
function nextIdLocked_(entityType, prefix) {
  const spec = ID_ENTITY_SPECS[entityType];
  if (!spec || spec.prefix !== prefix) throw appError_('Neznámý typ ID nebo prefix: ' + entityType, 'CONFIG_ERROR');
  const yy = Number(Utilities.formatDate(new Date(), APP_CONFIG.TIMEZONE, 'yy'));
  let counter = findRecordByYear_(entityType, yy);
  if (!counter) {
    const maxExisting = maxExistingSequence_(entityType, yy);
    appendRecord_('ID_COUNTERS', { Entity_Type:entityType, Year_YY:yy, Last_Sequence:maxExisting, Updated_At:new Date() });
    counter = findRecordByYear_(entityType, yy);
  }
  const maxSeq = maxExistingSequence_(entityType, yy);
  const last = Number(counter.Last_Sequence || 0);
  if (last < maxSeq) {
    throw appError_('ID_COUNTERS pro ' + entityType + ' zaostává za existujícími ID (čítač ' + last + ', nejvyšší ID ' + maxSeq + '). Opravte čítač správcem; zápis byl zablokován.', 'ID_COLLISION');
  }
  const next = last + 1;
  const id = prefix + '-' + String(yy).padStart(2, '0') + '-' + String(next).padStart(6, '0');
  if (findRecord_(spec.sheet, spec.key, id)) throw appError_('Generované ID již existuje. Opravte ID_COUNTERS; zápis byl zablokován.', 'ID_COLLISION');
  const values = SHEET_HEADERS.ID_COUNTERS.map(function(header) {
    if (header === 'Entity_Type') return entityType;
    if (header === 'Year_YY') return yy;
    if (header === 'Last_Sequence') return next;
    if (header === 'Updated_At') return new Date();
    return '';
  });
  sheet_('ID_COUNTERS').getRange(counter._rowNumber, 1, 1, SHEET_HEADERS.ID_COUNTERS.length).setValues([values]);
  return id;
}

function maxExistingSequence_(entityType, yy) {
  const spec = ID_ENTITY_SPECS[entityType];
  if (!spec) throw appError_('Neznámý typ ID: ' + entityType, 'CONFIG_ERROR');
  const pattern = new RegExp('^' + spec.prefix + '-' + String(yy).padStart(2,'0') + '-(\\d{6})$');
  return records_(spec.sheet).reduce(function(max, row) {
    const match = pattern.exec(String(row[spec.key] || '').trim());
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
}

function findRecordByYear_(entityType, yy) {
  return records_('ID_COUNTERS').find(function(row) {
    return row.Entity_Type === entityType && Number(row.Year_YY) === Number(yy);
  }) || null;
}

function uuid_() { return Utilities.getUuid(); }

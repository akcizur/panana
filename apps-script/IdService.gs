/** Sequence IDs can only be reserved while the enclosing operation holds ScriptLock. */
function nextIdLocked_(entityType, prefix) {
  const yy = Number(Utilities.formatDate(new Date(), APP_CONFIG.TIMEZONE, 'yy'));
  let counter = findRecordByYear_(entityType, yy);
  if (!counter) {
    appendRecord_('ID_COUNTERS', { Entity_Type:entityType, Year_YY:yy, Last_Sequence:0, Updated_At:new Date() });
    counter = findRecordByYear_(entityType, yy);
  }
  const next = Number(counter.Last_Sequence || 0) + 1;
  const id = prefix + '-' + String(yy).padStart(2, '0') + '-' + String(next).padStart(6, '0');
  const mapping = {
    PACK:['SKLAD_SUROVIN','Pack_ID'],
    VYROBNI_PLAN:['PLAN_VYROBY','Plan_Vyroby_ID'],
    PLAN_BALENI:['PLAN_BALENI','Plan_Baleni_ID'],
    ETIKETOVANI:['PLAN_ETYKETOVANI','Plan_Etiketovani_ID'],
    PREDANI:['PREDANI_EXPEDICI','Predani_ID']
  };
  if (mapping[entityType] && findRecord_(mapping[entityType][0], mapping[entityType][1], id)) {
    throw appError_('ID_COUNTERS je nižší než existující ID. Automatické přepsání sekvence bylo zablokováno.', 'ID_COLLISION');
  }
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

function findRecordByYear_(entityType, yy) {
  return records_('ID_COUNTERS').find(function(row) {
    return row.Entity_Type === entityType && Number(row.Year_YY) === Number(yy);
  }) || null;
}

function uuid_() { return Utilities.getUuid(); }

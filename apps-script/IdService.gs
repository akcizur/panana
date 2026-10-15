/** Must be called while the script lock is held by the enclosing operation. */
function nextIdLocked_(entityType, prefix) {
  const yy = Number(Utilities.formatDate(new Date(), APP_CONFIG.TIMEZONE, 'yy'));
  let counter = findRecord_('ID_COUNTERS', 'Entity_Type', entityType);
  if (counter && Number(counter.Year_YY) !== yy) counter = findRecordByYear_(entityType, yy);
  if (!counter) {
    appendRecord_('ID_COUNTERS', { Entity_Type: entityType, Year_YY: yy, Last_Sequence: 0, Updated_At: new Date() });
    counter = findRecordByYear_(entityType, yy);
  }
  const next = Number(counter.Last_Sequence || 0) + 1;
  updateRecord_('ID_COUNTERS', 'Entity_Type', entityType + '|' + yy, {});
  return formatReservedId_(entityType, yy, next, prefix, counter);
}

function findRecordByYear_(entityType, yy) {
  return records_('ID_COUNTERS').find(function(row) { return row.Entity_Type === entityType && Number(row.Year_YY) === Number(yy); }) || null;
}

function formatReservedId_(entityType, yy, next, prefix, counter) {
  const key = entityType + '|' + yy;
  const sheet = sheet_('ID_COUNTERS');
  const rowNumber = counter._rowNumber;
  const headers = SHEET_HEADERS.ID_COUNTERS;
  const nextRow = {
    Entity_Type: entityType, Year_YY: yy, Last_Sequence: next, Updated_At: new Date()
  };
  sheet.getRange(rowNumber, 1, 1, headers.length).setValues([headers.map(function(h) { return nextRow[h] == null ? '' : nextRow[h]; })]);
  return prefix + '-' + String(yy).padStart(2, '0') + '-' + String(next).padStart(6, '0');
}

function uuid_() { return Utilities.getUuid(); }

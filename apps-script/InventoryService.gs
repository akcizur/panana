function surovinaName_(id) {
  const item = findRecord_('DB_SUROVINY', 'Surovina_ID', id);
  return item ? String(item.Nazev_Suroviny || '') : 'Neznámá surovina';
}

function listPacks_(filters) {
  const f = filters || {};
  const needle = String(f.query || '').trim().toLowerCase();
  const status = String(f.status || '').trim();
  const box = String(f.box || '').trim().toLowerCase();
  const position = String(f.position || '').trim().toUpperCase();
  return records_('SKLAD_SUROVIN').map(function(pack) {
    const result = publicRecord_(pack);
    result.Nazev_Suroviny = surovinaName_(pack.Surovina_ID);
    return result;
  }).filter(function(pack) {
    const matchesQuery = !needle || [pack.Pack_ID, pack.Nazev_Suroviny, pack.Lot, pack.Expirace_MMYY].some(function(v) { return String(v || '').toLowerCase().indexOf(needle) >= 0; });
    return matchesQuery && (!status || pack.Stav_Packu === status) && (!box || String(pack.Box_Number || '').toLowerCase().indexOf(box) >= 0) && (!position || String(pack.Pozice || '').toUpperCase() === position);
  }).sort(function(a, b) { return String(b.Received_At).localeCompare(String(a.Received_At)); });
}

function packDetail_(packId) {
  const id = validatePackId_(packId);
  const record = findRecord_('SKLAD_SUROVIN', 'Pack_ID', id);
  if (!record) throw appError_('Pack ' + id + ' nebyl nalezen.', 'NOT_FOUND');
  const movements = records_('POHYBY_LOG').filter(function(m) { return m.Entita_Typ === 'PACK' && m.Entita_ID === id; })
    .sort(function(a,b) { return new Date(b.Timestamp).getTime() - new Date(a.Timestamp).getTime(); }).slice(0, 100).map(publicRecord_);
  const uses = records_('PLAN_VYROBY_SUROVINY').filter(function(row) { return row.Pack_ID === id; }).map(publicRecord_);
  return { pack: publicRecord_(record), surovinaName: surovinaName_(record.Surovina_ID), qrPayload: safeQrPayload_(id), movements: movements, uses: uses };
}

function safeQrPayload_(id) {
  try { return buildPackQrPayload_(id); } catch (e) { return ''; }
}

function receivePack_(input, operationKey) {
  // Do not create a pack that cannot receive a stable QR deeplink.
  validateAppBaseUrl_(configValue_('APP_BASE_URL'));
  const data = {
    Surovina_ID: requiredText_(input && input.surovinaId, 'Surovina', 100),
    Lot: requiredText_(input && input.lot, 'Lot', 100),
    Expirace_MMYY: validateExpiry_(input && input.expiry),
    Pocatecni_Hmotnost: requireNumber_(input && input.weight, 'Počáteční hmotnost', 0.000001, 100000000),
    Jednotka_Hmotnosti: validateWeightUnit_(input && input.unit),
    Box_Number: requiredText_(input && input.box, 'Box_Number', 80),
    Pozice: activePosition_(input && input.position)
  };
  const material = findRecord_('DB_SUROVINY', 'Surovina_ID', data.Surovina_ID);
  if (!material || !boolValue_(material.Aktivni)) throw appError_('Surovina neexistuje nebo není aktivní.', 'VALIDATION_ERROR');
  return withOperation_('PRIJEM_PACKU', operationKey, data, function(ctx) {
    const packId = reservePackIdLocked_();
    const now = new Date();
    const pack = {
      Pack_ID: packId, Surovina_ID: data.Surovina_ID, Lot: data.Lot, Expirace_MMYY: data.Expirace_MMYY,
      Pocatecni_Hmotnost: data.Pocatecni_Hmotnost, Jednotka_Hmotnosti: data.Jednotka_Hmotnosti,
      Stav_Packu: 'NOVY', Box_Number: data.Box_Number, Pozice: data.Pozice,
      Received_At: now, Opened_At: '', Emptied_At: '', Created_At: now, Updated_At: now,
      Created_By: ctx.actor.email, Updated_By: ctx.actor.email
    };
    appendRecord_('SKLAD_SUROVIN', pack);
    logMovement_({ type:'PACK', id:packId, action:'PRIJEM_PACKU', toBox:data.Box_Number, toPosition:data.Pozice, operationId:ctx.operationId, user:ctx.actor.email, note:'Příjem packu; počáteční hmotnost je evidována bez dalšího výpočtu spotřeby.' });
    let qrPayload = '';
    try { qrPayload = buildPackQrPayload_(packId); } catch (ignored) {}
    return { entityId: packId, data: { pack: publicRecord_(pack), qrPayload: qrPayload, qrConfigured: !!qrPayload } };
  });
}

function reservePackIdLocked_() {
  const yy = Number(Utilities.formatDate(new Date(), APP_CONFIG.TIMEZONE, 'yy'));
  let counter = findRecordByYear_('PACK', yy);
  if (!counter) {
    appendRecord_('ID_COUNTERS', { Entity_Type:'PACK', Year_YY:yy, Last_Sequence:0, Updated_At:new Date() });
    counter = findRecordByYear_('PACK', yy);
  }
  const next = Number(counter.Last_Sequence || 0) + 1;
  const id = 'P-' + String(yy).padStart(2, '0') + '-' + String(next).padStart(6, '0');
  if (findRecord_('SKLAD_SUROVIN', 'Pack_ID', id)) throw appError_('ID_COUNTERS koliduje s existujícím Pack_ID. Je nutná kontrola správce.', 'ID_COLLISION');
  const headers = SHEET_HEADERS.ID_COUNTERS;
  const values = headers.map(function(h) { return h === 'Entity_Type' ? 'PACK' : h === 'Year_YY' ? yy : h === 'Last_Sequence' ? next : h === 'Updated_At' ? new Date() : ''; });
  sheet_('ID_COUNTERS').getRange(counter._rowNumber, 1, 1, headers.length).setValues([values]);
  return id;
}

function movePack_(packId, input, operationKey, actor) {
  const id = validatePackId_(packId);
  const target = {
    box: requiredText_(input && input.box, 'Cílový box', 80),
    position: activePosition_(input && input.position),
    note: optionalText_(input && input.note, 500)
  };
  return withOperation_('PRESUN_PACKU', operationKey, { packId:id, target:target }, function(ctx) {
    const pack = findRecord_('SKLAD_SUROVIN', 'Pack_ID', id);
    if (!pack) throw appError_('Pack nebyl nalezen.', 'NOT_FOUND');
    if (pack.Box_Number === target.box && pack.Pozice === target.position) throw appError_('Cílové umístění je stejné jako současné.', 'VALIDATION_ERROR');
    updateRecord_('SKLAD_SUROVIN', 'Pack_ID', id, { Box_Number:target.box, Pozice:target.position, Updated_At:new Date(), Updated_By:ctx.actor.email });
    logMovement_({ type:'PACK', id:id, action:'PRESUN_PACKU', fromBox:pack.Box_Number, fromPosition:pack.Pozice, toBox:target.box, toPosition:target.position, operationId:ctx.operationId, user:ctx.actor.email, note:target.note });
    return { entityId:id, data:{ packId:id, fromBox:pack.Box_Number, fromPosition:pack.Pozice, toBox:target.box, toPosition:target.position } };
  });
}

function markPackUsed_(packId, planId, operationKey) {
  const id = validatePackId_(packId);
  const plan = requiredText_(planId, 'Plan_Vyroby_ID', 100);
  return withOperation_('POUZITI_PACKU', operationKey, { packId:id, planId:plan }, function(ctx) {
    const pack = findRecord_('SKLAD_SUROVIN', 'Pack_ID', id);
    if (!pack) throw appError_('Pack nebyl nalezen.', 'NOT_FOUND');
    if (pack.Stav_Packu === 'VYPRAZDNENY') throw appError_('Vyprázdněný pack nelze použít.', 'VALIDATION_ERROR');
    const productionPlan = findRecord_('PLAN_VYROBY', 'Plan_Vyroby_ID', plan);
    if (!productionPlan || ['DOKONCENO','ZRUSENO'].indexOf(productionPlan.Stav) >= 0) throw appError_('Výrobní plán neexistuje nebo je uzavřen.', 'VALIDATION_ERROR');
    const existing = records_('PLAN_VYROBY_SUROVINY').find(function(row) { return row.Plan_Vyroby_ID === plan && row.Pack_ID === id && row.Stav_Pouziti === 'POUZITO'; });
    if (existing) throw appError_('Pack už je do tohoto plánu potvrzen jako použitý.', 'VALIDATION_ERROR');
    const now = new Date();
    appendRecord_('PLAN_VYROBY_SUROVINY', { Plan_Polozka_ID:uuid_(), Plan_Vyroby_ID:plan, Pack_ID:id, Role:productionPlan.Vstupni_Typ === 'RECEPTURA' ? 'SLOZKA_RECEPTURY' : 'VSTUP_PRIMY', Stav_Pouziti:'POUZITO', Pouzito_At:now, Operator:ctx.actor.email, Poznamka:'Obsluha potvrdila fyzickou dostupnost materiálu; žádná spotřebovaná hmotnost se nepočítá.' });
    if (pack.Stav_Packu === 'NOVY') {
      updateRecord_('SKLAD_SUROVIN', 'Pack_ID', id, { Stav_Packu:'OTEVRENY', Opened_At:now, Updated_At:now, Updated_By:ctx.actor.email });
      logMovement_({ type:'PACK', id:id, action:'OTEVRENI_PACKU', fromBox:pack.Box_Number, fromPosition:pack.Pozice, toBox:pack.Box_Number, toPosition:pack.Pozice, referenceType:'PLAN_VYROBY', referenceId:plan, operationId:ctx.operationId, user:ctx.actor.email });
    }
    logMovement_({ type:'PACK', id:id, action:'POUZITI_PACKU', referenceType:'PLAN_VYROBY', referenceId:plan, operationId:ctx.operationId, user:ctx.actor.email, note:'Bez hmotnostní bilance.' });
    return { entityId:id, data:{ packId:id, planId:plan, opened:pack.Stav_Packu === 'NOVY' } };
  });
}

function emptyPack_(packId, operationKey, actor) {
  const id = validatePackId_(packId);
  return withOperation_('VYPRAZDNENI_PACKU', operationKey, { packId:id }, function(ctx) {
    const pack = findRecord_('SKLAD_SUROVIN', 'Pack_ID', id);
    if (!pack) throw appError_('Pack nebyl nalezen.', 'NOT_FOUND');
    if (pack.Stav_Packu !== 'OTEVRENY') throw appError_('Vyprázdnění lze potvrdit pouze u otevřeného packu.', 'VALIDATION_ERROR');
    const now = new Date();
    updateRecord_('SKLAD_SUROVIN', 'Pack_ID', id, { Stav_Packu:'VYPRAZDNENY', Emptied_At:now, Updated_At:now, Updated_By:ctx.actor.email });
    logMovement_({ type:'PACK', id:id, action:'VYPRAZDNENI_PACKU', fromBox:pack.Box_Number, fromPosition:pack.Pozice, toBox:pack.Box_Number, toPosition:pack.Pozice, operationId:ctx.operationId, user:ctx.actor.email, note:'Vyprázdnění výslovně potvrdila obsluha. Hmotnostní bilance se nepočítá.' });
    return { entityId:id, data:{ packId:id, emptiedAt:asIso_(now) } };
  });
}

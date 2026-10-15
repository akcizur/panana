/** Public Apps Script RPC surface. Every method rechecks identity and role on the server. */
function apiBootstrap() {
  const actor = requireAction_('dashboard');
  const allPacks = records_('SKLAD_SUROVIN');
  const suroviny = records_('DB_SUROVINY').filter(function(row) { return boolValue_(row.Aktivni); }).map(function(row) {
    return { id:String(row.Surovina_ID), name:String(row.Nazev_Suroviny) };
  });
  const positions = records_('DB_POZICE').filter(function(row) { return boolValue_(row.Aktivni); }).map(function(row) {
    return { id:String(row.Pozice_ID), position:String(row.Pozice) };
  }).sort(function(a,b) { return a.position.localeCompare(b.position); });
  const products = records_('DB_PRODUKTY').map(function(row) {
    const out=publicRecord_(row);
    out.Active=boolValue_(row.Aktivni);
    out.Label_Required=boolValue_(row.Etiketa_Povinna);
    return out;
  });
  const materials = records_('DB_BALICI_MATERIALY').map(function(row) {
    const out=publicRecord_(row);
    out.Active=boolValue_(row.Aktivni);
    return out;
  });
  const materialStocks = records_('SKLAD_BALICIHO_MATERIALU').map(function(row) {
    const out=publicRecord_(row);
    const material=findRecord_('DB_BALICI_MATERIALY','Material_ID',row.Material_ID);
    out.Material_Name=material?String(material.Nazev_Materialu):String(row.Material_ID);
    out.Material_Type=material?String(material.Typ_Materialu):'';
    return out;
  });
  const semiFinished = records_('SKLAD_POLOTOVARU').map(function(row) {
    const out=publicRecord_(row);
    const product=findRecord_('DB_PRODUKTY','Produkt_ID',row.Produkt_ID);
    out.Product_Name=product?String(product.Nazev_Produktu):String(row.Produkt_ID);
    return out;
  });
  const plans = records_('PLAN_VYROBY');
  const finished = listFinishedStock_();
  const active = allPacks.filter(function(p) { return p.Stav_Packu !== 'VYPRAZDNENY'; });
  const currentMonth = Number(Utilities.formatDate(new Date(), APP_CONFIG.TIMEZONE, 'M'));
  const currentYear = Number(Utilities.formatDate(new Date(), APP_CONFIG.TIMEZONE, 'yy'));
  const nowKey = currentYear * 12 + currentMonth;
  const expiring = active.filter(function(p) {
    const key = expiryKey_(p.Expirace_MMYY);
    return key !== null && key >= nowKey && key <= nowKey + 2;
  }).length;
  return {
    ok:true,
    actor:{ email:actor.email, role:actor.role },
    stats:{
      packsTotal:allPacks.length,
      packsNew:allPacks.filter(function(p) { return p.Stav_Packu === 'NOVY'; }).length,
      packsOpen:allPacks.filter(function(p) { return p.Stav_Packu === 'OTEVRENY'; }).length,
      packsEmpty:allPacks.filter(function(p) { return p.Stav_Packu === 'VYPRAZDNENY'; }).length,
      plansActive:plans.filter(function(p) { return ['NAPLANOVANO','PRIPRAVENO','PROBIHA','POZASTAVENO'].indexOf(p.Stav) >= 0; }).length,
      plansRunning:plans.filter(function(p) { return p.Stav === 'PROBIHA'; }).length,
      waitingLabel:finished.filter(function(p) { return p.Stav_Zpracovani === 'CEKA_ETYKETU'; }).length,
      readyHandover:finished.filter(function(p) { return p.Stav_Zpracovani === 'PRIPRAVENO_K_PREDANI'; }).length,
      expiring:expiring
    },
    suroviny:suroviny,
    positions:positions,
    products:products,
    recipes:listRecipes_(),
    materials:materials,
    materialStocks:materialStocks,
    productionPlans:listProductionPlans_(),
    packagingPlans:listPackagingPlans_(),
    labelingPlans:listLabelingPlans_(),
    semiFinished:semiFinished,
    finishedStock:finished,
    handovers:listHandovers_(),
    users:actor.role==='ADMIN'?records_('DB_UZIVATELE').map(function(user){return {Email:String(user.Email),Role:String(user.Role),Aktivni:boolValue_(user.Aktivni),Created_At:asIso_(user.Created_At),Updated_At:asIso_(user.Updated_At)};}):[],
    qr:publicQrConfig_()
  };
}

function apiSearchPacks(filters) {
  requireAction_('pack_read');
  return { ok:true, packs:listPacks_(filters || {}).slice(0,500) };
}

function apiGetPackDetail(packId) {
  requireAction_('pack_read');
  return { ok:true, detail:packDetail_(packId) };
}

function apiReceivePack(input, idempotencyKey) {
  requireAction_('pack_receive');
  const result = receivePack_(input || {}, idempotencyKey);
  if (result.duplicate && result.entityId) {
    const payload=safeQrPayload_(result.entityId);
    result.data = { pack:packDetail_(result.entityId).pack, qrPayload:payload, qrConfigured:!!payload };
  }
  return result;
}

function apiMovePack(packId, input, idempotencyKey) {
  requireAction_('pack_move');
  return movePack_(packId, input || {}, idempotencyKey);
}

function apiPlanPackForProduction(packId, planId, idempotencyKey) {
  requireAction_('pack_use');
  return planPackForProduction_(packId, planId, idempotencyKey);
}

function apiMarkPackUsed(packId, planId, idempotencyKey) {
  requireAction_('pack_use');
  return markPackUsed_(packId, planId, idempotencyKey);
}

function apiEmptyPack(packId, idempotencyKey) {
  requireAction_('pack_empty');
  return emptyPack_(packId, idempotencyKey);
}

function apiRequestPackLabel(packId, isReprint) {
  const actor = requireAction_('qr_print');
  try { return { ok:true, label:requestPackLabel_(packId,Boolean(isReprint),actor) }; }
  catch (err) { return { ok:false,error:String(err.message||err),code:err.code||'ERROR' }; }
}

function apiCreateSurovina(input,idempotencyKey) {
  requireAction_('master_data');
  return createSurovina_(input||{},idempotencyKey);
}
function apiCreateProduct(input,idempotencyKey) {
  requireAction_('master_data');
  return createProduct_(input||{},idempotencyKey);
}
function apiCreatePackagingMaterial(input,idempotencyKey) {
  requireAction_('master_data');
  return createPackagingMaterial_(input||{},idempotencyKey);
}
function apiReceivePackagingMaterialStock(input,idempotencyKey) {
  requireAction_('master_data');
  return receivePackagingMaterialStock_(input||{},idempotencyKey);
}
function apiCreateRecipeVersion(input,idempotencyKey) {
  requireAction_('master_data');
  return createRecipeVersion_(input||{},idempotencyKey);
}
function apiCreateProductionPlan(input,idempotencyKey) {
  requireAction_('vyroba');
  return createProductionPlan_(input||{},idempotencyKey);
}
function apiUpdateProductionPlanStatus(planId,status,idempotencyKey) {
  requireAction_('vyroba');
  return updateProductionPlanStatus_(planId,status,idempotencyKey);
}
function apiCompleteProductionPlan(input,idempotencyKey) {
  requireAction_('vyroba');
  return completeProductionPlan_(input||{},idempotencyKey);
}
function apiCompleteProductionOperation(input,idempotencyKey) {
  requireAction_('vyroba');
  return completeProductionOperation_(input||{},idempotencyKey);
}
function apiCreatePackagingPlan(input,idempotencyKey) {
  requireAction_('baleni');
  return createPackagingPlan_(input||{},idempotencyKey);
}
function apiUpdatePackagingPlanStatus(planId,status,idempotencyKey) {
  requireAction_('baleni');
  return updatePackagingPlanStatus_(planId,status,idempotencyKey);
}
function apiCompletePackagingPlan(input,idempotencyKey) {
  requireAction_('baleni');
  return completePackagingPlan_(input||{},idempotencyKey);
}
function apiCreateLabelingPlan(input,idempotencyKey) {
  requireAction_('labeling');
  return createLabelingPlan_(input||{},idempotencyKey);
}
function apiUpdateLabelingPlanStatus(planId,status,idempotencyKey) {
  requireAction_('labeling');
  return updateLabelingPlanStatus_(planId,status,idempotencyKey);
}
function apiCompleteLabelingPlan(input,idempotencyKey) {
  requireAction_('labeling');
  return completeLabelingPlan_(input||{},idempotencyKey);
}
function apiCreateHandover(input,idempotencyKey) {
  requireAction_('handover');
  return createHandover_(input||{},idempotencyKey);
}

function apiGetHistory(filters) {
  requireAction_('history');
  const f=filters||{};
  const needle=String(f.query||'').trim().toLowerCase();
  const limit=Math.max(1,Math.min(250,Number(f.limit)||100));
  const movements=records_('POHYBY_LOG').filter(function(r){
    return !needle||[r.Entita_ID,r.Action,r.User,r.Reference_ID,r.Note].some(function(v){return String(v||'').toLowerCase().indexOf(needle)>=0;});
  }).sort(function(a,b){return new Date(b.Timestamp).getTime()-new Date(a.Timestamp).getTime();}).slice(0,limit).map(publicRecord_);
  const labels=records_('QR_LABEL_LOG').filter(function(r){
    return !needle||[r.Pack_ID,r.Action,r.User,r.Note].some(function(v){return String(v||'').toLowerCase().indexOf(needle)>=0;});
  }).sort(function(a,b){return new Date(b.Timestamp).getTime()-new Date(a.Timestamp).getTime();}).slice(0,limit).map(publicRecord_);
  const operations=records_('OPERATIONS_LOG').filter(function(r){
    return !needle||[r.Operation_ID,r.Operation_Type,r.Entity_ID,r.Requested_By,r.Status,r.Error_Message].some(function(v){return String(v||'').toLowerCase().indexOf(needle)>=0;});
  }).sort(function(a,b){return new Date(b.Started_At).getTime()-new Date(a.Started_At).getTime();}).slice(0,limit).map(publicRecord_);
  return {ok:true,movements:movements,labels:labels,operations:operations};
}

function apiUpdateConfig(input,idempotencyKey) {
  requireAction_('config');
  const key=requiredText_(input&&input.key,'Konfigurační klíč',80);
  const value=String(input&&input.value!=null?input.value:'').trim();
  const editable=['APP_BASE_URL','QR_LABEL_FORMAT_DEFAULT','QR_ENABLE_CAMERA_SCANNER'];
  if(editable.indexOf(key)<0)throw appError_('Tento konfigurační klíč nelze upravit přes rozhraní.','VALIDATION_ERROR');
  if(key==='APP_BASE_URL'&&value)validateAppBaseUrl_(value);
  if(key==='QR_LABEL_FORMAT_DEFAULT')requireEnum_(value,['50x30mm','60x40mm'],key);
  if(key==='QR_ENABLE_CAMERA_SCANNER')requireEnum_(value,['TRUE','FALSE'],key);
  return withOperation_('ZMENA_KONFIGURACE',idempotencyKey,{key:key,value:value},function(ctx){
    setConfigValue_(key,value);
    return {entityId:key,data:{key:key,value:value}};
  });
}

function expiryKey_(text) {
  const match=/^(0[1-9]|1[0-2])\/(\d{2})$/.exec(String(text||'').trim());
  return match?Number(match[2])*12+Number(match[1]):null;
}

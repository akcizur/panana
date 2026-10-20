function createSurovina_(input, operationKey) {
  const name = requiredText_(input && input.name, 'Název suroviny', 200);
  return withOperation_('VYTVORENI_SUROVINY', operationKey, { name:name }, function(ctx) {
    if (records_('DB_SUROVINY').some(function(row) { return String(row.Nazev_Suroviny).trim().toLowerCase() === name.toLowerCase(); })) throw appError_('Surovina s tímto názvem už existuje.', 'VALIDATION_ERROR');
    const id = nextIdLocked_('SUROVINA', 'S');
    const now = new Date();
    appendRecord_('DB_SUROVINY', { Surovina_ID:id, Nazev_Suroviny:name, Aktivni:true, Created_At:now, Updated_At:now });
    return { entityId:id, data:{ id:id, name:name } };
  });
}

function createProduct_(input, operationKey) {
  const name = requiredText_(input && input.name, 'Název produktu', 200);
  const form = requireEnum_(String(input && input.form || ''), ['SYPKA','KAPSLE'], 'Forma výstupu');
  const inputType = requireEnum_(String(input && input.inputType || ''), ['JEDNA_SUROVINA','RECEPTURA'], 'Typ vstupu');
  const capsuleCount = form === 'KAPSLE' ? requireInteger_(input && input.capsulesPerPackage, 'Kapslí na balení', 1, 100000) : '';
  const labelRequired = Boolean(input && input.labelRequired);
  return withOperation_('VYTVORENI_PRODUKTU', operationKey, { name:name, form:form, inputType:inputType, capsuleCount:capsuleCount, labelRequired:labelRequired }, function(ctx) {
    if (records_('DB_PRODUKTY').some(function(row) { return String(row.Nazev_Produktu).trim().toLowerCase() === name.toLowerCase() && boolValue_(row.Aktivni); })) throw appError_('Aktivní produkt s tímto názvem už existuje.', 'VALIDATION_ERROR');
    const id = nextIdLocked_('PRODUKT', 'PR');
    const now = new Date();
    appendRecord_('DB_PRODUKTY', { Produkt_ID:id, Nazev_Produktu:name, Forma_Vystupu:form, Typ_Vstupu:inputType, Kapsli_na_Baleni:capsuleCount, Etiketa_Povinna:labelRequired, Aktivni:true, Created_At:now, Updated_At:now });
    return { entityId:id, data:{ id:id, name:name } };
  });
}

function createPackagingMaterial_(input, operationKey) {
  const name = requiredText_(input && input.name, 'Název materiálu', 200);
  const type = requireEnum_(String(input && input.type || ''), ['DOYPACK','PYTLIK','LAHEV','VICKO','KRABICKA','ETIKETA','JINY'], 'Typ materiálu');
  const unit = requiredText_(input && input.unit || 'ks', 'Jednotka', 20);
  return withOperation_('VYTVORENI_BALICIHO_MATERIALU', operationKey, { name:name, type:type, unit:unit }, function(ctx) {
    if (records_('DB_BALICI_MATERIALY').some(function(row) { return String(row.Nazev_Materialu).trim().toLowerCase() === name.toLowerCase() && boolValue_(row.Aktivni); })) throw appError_('Aktivní materiál s tímto názvem už existuje.', 'VALIDATION_ERROR');
    const id = nextIdLocked_('MATERIAL', 'MAT');
    const now = new Date();
    appendRecord_('DB_BALICI_MATERIALY', { Material_ID:id, Nazev_Materialu:name, Typ_Materialu:type, Jednotka:unit, Aktivni:true, Created_At:now, Updated_At:now });
    return { entityId:id, data:{ id:id, name:name } };
  });
}

function receivePackagingMaterialStock_(input, operationKey) {
  const materialId = requiredText_(input && input.materialId, 'Material_ID', 100);
  const lot = requiredText_(input && input.lot, 'Lot obalu', 100);
  const box = requiredText_(input && input.box, 'Box_Number', 80);
  const position = activePosition_(input && input.position);
  const qty = requireNumber_(input && input.quantity, 'Množství', 0.000001, 1000000000);
  const material = findRecord_('DB_BALICI_MATERIALY', 'Material_ID', materialId);
  if (!material || !boolValue_(material.Aktivni)) throw appError_('Obalový materiál neexistuje nebo není aktivní.', 'VALIDATION_ERROR');
  const validatedQty=requireStockQuantity_(qty,'Množství',material.Jednotka,0.000001,1000000000);
  return withOperation_('PRIJEM_BALICIHO_MATERIALU', operationKey, { materialId:materialId, lot:lot, box:box, position:position, quantity:qty }, function(ctx) {
    const id = nextIdLocked_('MATERIAL_STOCK', 'MS');
    const now = new Date();
    appendRecord_('SKLAD_BALICIHO_MATERIALU', { Stock_Material_ID:id, Material_ID:materialId, Lot:lot, Box_Number:box, Pozice:position, Mnozstvi_Aktualni:qty, Jednotka:material.Jednotka, Created_At:now, Updated_At:now });
    logMovement_({ type:'BALICI_MATERIAL', id:id, action:'PRIJEM_BALICIHO_MATERIALU', delta:qty, unit:material.Jednotka, toBox:box, toPosition:position, operationId:ctx.operationId, user:ctx.actor.email });
    return { entityId:id, data:{ stockId:id, quantity:qty } };
  });
}

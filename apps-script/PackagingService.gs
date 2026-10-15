function createPackagingPlan_(input, operationKey) {
  const productId=requiredText_(input&&input.productId,'Produkt_ID',100);
  const sourceType=requireEnum_(String(input&&input.sourceType||''),['PACK_SUROVINA','POLOTOVAR'],'Typ zdroje');
  const sourceId=requiredText_(input&&input.sourceId,'Zdroj_ID',120);
  const plannedCount=requireInteger_(input&&input.plannedCount,'Plánovaný počet balení',1,10000000);
  const box=requiredText_(input&&input.box,'Box_Number hotového výrobku',80);
  const position=activePosition_(input&&input.position);
  const product=findRecord_('DB_PRODUKTY','Produkt_ID',productId);
  if(!product||!boolValue_(product.Aktivni))throw appError_('Produkt neexistuje nebo není aktivní.','VALIDATION_ERROR');
  if(sourceType==='PACK_SUROVINA'){
    if(product.Typ_Vstupu!=='JEDNA_SUROVINA'||product.Forma_Vystupu!=='SYPKA')throw appError_('Přímé plnění raw packu je povoleno pouze pro sypký produkt s jednou surovinou.','VALIDATION_ERROR');
    const pack=findRecord_('SKLAD_SUROVIN','Pack_ID',validatePackId_(sourceId));
    if(!pack||pack.Stav_Packu==='VYPRAZDNENY')throw appError_('Zdrojový pack neexistuje nebo je vyprázdněný.','VALIDATION_ERROR');
    const packIngredient=findRecord_('DB_SUROVINY','Surovina_ID',pack.Surovina_ID);
    if(!packIngredient||!boolValue_(packIngredient.Aktivni))throw appError_('Surovina ve zdrojovém packu není aktivní.','VALIDATION_ERROR');
  } else {
    const semi=findRecord_('SKLAD_POLOTOVARU','Polotovar_ID',sourceId);
    if(!semi||semi.Stav_Polotovaru==='SPOTREBOVANY')throw appError_('Polotovar neexistuje nebo je označen jako spotřebovaný.','VALIDATION_ERROR');
    if(semi.Produkt_ID!==productId)throw appError_('Polotovar neodpovídá zvolenému produktu.','VALIDATION_ERROR');
    const expectedSemiType = product.Forma_Vystupu === 'KAPSLE' ? 'KAPSLE_NEZABALENE' : 'SYPKA_SMES';
    if (semi.Typ_Polotovaru !== expectedSemiType) throw appError_('Forma polotovaru neodpovídá produktu.','VALIDATION_ERROR');
    if(semi.Typ_Polotovaru==='KAPSLE_NEZABALENE'){
      const per=Number(product.Kapsli_na_Baleni||0);
      if(!per||per*plannedCount>Number(semi.Pocet_Kapsli_Aktualne||0))throw appError_('Plán vyžaduje více kapslí, než je evidováno v polotovaru.','VALIDATION_ERROR');
    }
  }
  const materials=Array.isArray(input&&input.materials)?input.materials:[];
  if(!materials.length)throw appError_('Přidejte alespoň jeden obalový materiál.','VALIDATION_ERROR');
  const normalized=materials.map(function(line){
    const stockId=requiredText_(line&&line.stockId,'Stock_Material_ID',100);
    const qty=requireNumber_(line&&line.plannedQuantity,'Plánovaná spotřeba materiálu',0.000001,100000000);
    const stock=activeMaterialStock_(stockId);
    const validatedQty=requireStockQuantity_(qty,'Plánovaná spotřeba materiálu',stock.Jednotka,0.000001,100000000);\n    if(validatedQty>Number(stock.Mnozstvi_Aktualni||0))throw appError_('Nedostatečná dostupnost materiálu '+stockId+'.','VALIDATION_ERROR');
    return {stockId:stockId,materialId:String(stock.Material_ID),quantity:validatedQty,unit:String(stock.Jednotka)};
  });
  if(new Set(normalized.map(function(m){return m.stockId;})).size!==normalized.length)throw appError_('Skladovou položku materiálu uveďte pouze jednou.','VALIDATION_ERROR');
  return withOperation_('VYTVORENI_PLANS_BALENI',operationKey,{productId:productId,sourceType:sourceType,sourceId:sourceId,plannedCount:plannedCount,box:box,position:position,materials:normalized},function(ctx){
    const id=nextIdLocked_('PLAN_BALENI','PB');
    const now=new Date();
    const plan=appendRecord_('PLAN_BALENI',{
      Plan_Baleni_ID:id,Cislo_Planu:id,Plan_Vyroby_ID:sourceType==='POLOTOVAR'?(findRecord_('SKLAD_POLOTOVARU','Polotovar_ID',sourceId).Plan_Vyroby_ID||''):'',
      Produkt_ID:productId,Zdroj_Typ:sourceType,Zdroj_ID:sourceId,Vyrobni_Lot:sourceType==='PACK_SUROVINA'?findRecord_('SKLAD_SUROVIN','Pack_ID',sourceId).Lot:findRecord_('SKLAD_POLOTOVARU','Polotovar_ID',sourceId).Vyrobni_Lot,
      Kapsli_na_Baleni:product.Forma_Vystupu==='KAPSLE'?Number(product.Kapsli_na_Baleni):'',Planovany_Pocet_Baleni:plannedCount,Skutecny_Pocet_Baleni:'',
      Stav:'NAPLANOVANO',Datum_Zahajeni:'',Datum_Dokonceni:'',Operator:ctx.actor.email,Poznamka:optionalText_(input&&input.note,500),Created_At:now,Updated_At:now
    });
    normalized.forEach(function(line){
      appendRecord_('PLAN_BALENI_MATERIAL',{Plan_Baleni_Polozka_ID:uuid_(),Plan_Baleni_ID:id,Material_ID:line.materialId,Stock_Material_ID:line.stockId,Mnozstvi_Plan:line.quantity,Mnozstvi_Skutecnost:'',Jednotka:line.unit,Poznamka:''});
    });
    return {entityId:id,data:{planId:id,materials:normalized.length}};
  });
}

function updatePackagingPlanStatus_(planId,nextStatus,operationKey){
  const id=requiredText_(planId,'Plan_Baleni_ID',100);
  const target=requireEnum_(nextStatus,['PRIPRAVENO','PROBIHA','POZASTAVENO','ZRUSENO'],'Stav plánu balení');
  return withOperation_('ZMENA_STAVU_PLANS_BALENI',operationKey,{planId:id,target:target},function(ctx){
    const plan=findRecord_('PLAN_BALENI','Plan_Baleni_ID',id);
    if(!plan)throw appError_('Plán balení nebyl nalezen.','NOT_FOUND');
    const allowed={NAPLANOVANO:['PRIPRAVENO','ZRUSENO'],PRIPRAVENO:['PROBIHA','ZRUSENO'],PROBIHA:['POZASTAVENO'],POZASTAVENO:['PROBIHA','ZRUSENO'],DOKONCENO:[],ZRUSENO:[]};
    if((allowed[plan.Stav]||[]).indexOf(target)<0)throw appError_('Nepovolený přechod '+plan.Stav+' → '+target+'.','VALIDATION_ERROR');
    const now=new Date(),patch={Stav:target,Updated_At:now,Operator:ctx.actor.email};
    if(target==='PROBIHA'&&!plan.Datum_Zahajeni)patch.Datum_Zahajeni=now;
    updateRecord_('PLAN_BALENI','Plan_Baleni_ID',id,patch);
    return {entityId:id,data:{planId:id,status:target}};
  });
}

function completePackagingPlan_(input,operationKey){
  const id=requiredText_(input&&input.planId,'Plan_Baleni_ID',100);
  const actualCount=requireInteger_(input&&input.actualCount,'Skutečný počet balení',1,10000000);
  const box=requiredText_(input&&input.box,'Box_Number hotového výrobku',80);
  const position=activePosition_(input&&input.position);
  const actualMaterials=Array.isArray(input&&input.materials)?input.materials:[];
  return withOperation_('DOKONCENI_BALENI',operationKey,{planId:id,actualCount:actualCount,box:box,position:position,materials:actualMaterials},function(ctx){
    const plan=findRecord_('PLAN_BALENI','Plan_Baleni_ID',id);
    if(!plan)throw appError_('Plán balení nebyl nalezen.','NOT_FOUND');
    if(plan.Stav!=='PROBIHA')throw appError_('Dokončit lze pouze plán balení ve stavu PROBIHA.','VALIDATION_ERROR');
    if(actualCount>Number(plan.Planovany_Pocet_Baleni))throw appError_('Skutečný počet balení nesmí překročit plánovaný počet.','VALIDATION_ERROR');
    const product=findRecord_('DB_PRODUKTY','Produkt_ID',plan.Produkt_ID);
    const planLines=records_('PLAN_BALENI_MATERIAL').filter(function(row){return row.Plan_Baleni_ID===id;});
    if(actualMaterials.length!==planLines.length)throw appError_('Vyplňte skutečnou spotřebu pro všechny řádky materiálu.','VALIDATION_ERROR');
    const quantities={};
    actualMaterials.forEach(function(line){
      const lineId=requiredText_(line&&line.lineId,'Plan_Baleni_Polozka_ID',100);
      if(quantities[lineId]!=null)throw appError_('Duplicitní řádek skutečné spotřeby.','VALIDATION_ERROR');
      quantities[lineId]=requireNumber_(line&&line.quantity,'Skutečná spotřeba',0,100000000);
    });
    const ready=[];
    planLines.forEach(function(line){
      if(quantities[line.Plan_Baleni_Polozka_ID]==null)throw appError_('Chybí skutečná spotřeba materiálu.','VALIDATION_ERROR');
      const stock=activeMaterialStock_(line.Stock_Material_ID);
      if(quantities[line.Plan_Baleni_Polozka_ID]>Number(stock.Mnozstvi_Aktualni||0))throw appError_('Nedostatek obalového materiálu '+line.Stock_Material_ID+'.','VALIDATION_ERROR');
      ready.push({line:line,stock:stock,actual:quantities[line.Plan_Baleni_Polozka_ID]});
    });
    if(plan.Zdroj_Typ==='PACK_SUROVINA'){
      const pack=findRecord_('SKLAD_SUROVIN','Pack_ID',plan.Zdroj_ID);
      if(!pack||pack.Stav_Packu==='VYPRAZDNENY')throw appError_('Zdrojový pack nelze použít.','VALIDATION_ERROR');
    }else{
      const semi=findRecord_('SKLAD_POLOTOVARU','Polotovar_ID',plan.Zdroj_ID);
      if(!semi||semi.Stav_Polotovaru==='SPOTREBOVANY')throw appError_('Zdrojový polotovar není dostupný.','VALIDATION_ERROR');
      if(semi.Typ_Polotovaru==='KAPSLE_NEZABALENE'){
        const requiredCaps=actualCount*Number(plan.Kapsli_na_Baleni||0);
        if(requiredCaps>Number(semi.Pocet_Kapsli_Aktualne||0))throw appError_('Nedostatek nezabalených kapslí pro skutečný počet balení.','VALIDATION_ERROR');
      }
    }
    const now=new Date();
    ready.forEach(function(item){
      const newQty=Number(item.stock.Mnozstvi_Aktualni)-item.actual;
      updateRecord_('SKLAD_BALICIHO_MATERIALU','Stock_Material_ID',item.stock.Stock_Material_ID,{Mnozstvi_Aktualni:newQty,Updated_At:now});
      updateRecord_('PLAN_BALENI_MATERIAL','Plan_Baleni_Polozka_ID',item.line.Plan_Baleni_Polozka_ID,{Mnozstvi_Skutecnost:item.actual});
      logMovement_({type:'BALICI_MATERIAL',id:item.stock.Stock_Material_ID,action:'SPOTREBA_MATERIALU',delta:-item.actual,unit:item.stock.Jednotka,fromBox:item.stock.Box_Number,fromPosition:item.stock.Pozice,referenceType:'PLAN_BALENI',referenceId:id,operationId:ctx.operationId,user:ctx.actor.email});
    });
    if(plan.Zdroj_Typ==='PACK_SUROVINA'){
      const pack=findRecord_('SKLAD_SUROVIN','Pack_ID',plan.Zdroj_ID);
      if(pack.Stav_Packu==='NOVY'){
        updateRecord_('SKLAD_SUROVIN','Pack_ID',pack.Pack_ID,{Stav_Packu:'OTEVRENY',Opened_At:now,Updated_At:now,Updated_By:ctx.actor.email});
        logMovement_({type:'PACK',id:pack.Pack_ID,action:'OTEVRENI_PACKU',fromBox:pack.Box_Number,fromPosition:pack.Pozice,toBox:pack.Box_Number,toPosition:pack.Pozice,referenceType:'PLAN_BALENI',referenceId:id,operationId:ctx.operationId,user:ctx.actor.email});
      }
      logMovement_({type:'PACK',id:pack.Pack_ID,action:'POUZITI_PACKU',referenceType:'PLAN_BALENI',referenceId:id,operationId:ctx.operationId,user:ctx.actor.email,note:'Přímé plnění; přesná hmotnostní spotřeba se neeviduje.'});
    }else{
      const semi=findRecord_('SKLAD_POLOTOVARU','Polotovar_ID',plan.Zdroj_ID);
      if(semi.Typ_Polotovaru==='KAPSLE_NEZABALENE'){
        const remaining=Number(semi.Pocet_Kapsli_Aktualne||0)-actualCount*Number(plan.Kapsli_na_Baleni||0);
        updateRecord_('SKLAD_POLOTOVARU','Polotovar_ID',semi.Polotovar_ID,{Pocet_Kapsli_Aktualne:remaining,Stav_Polotovaru:remaining===0?'SPOTREBOVANY':'OTEVRENY',Updated_At:now});
        logMovement_({type:'POLOTOVAR',id:semi.Polotovar_ID,action:'SPOTREBA_KAPSLI',delta:-actualCount*Number(plan.Kapsli_na_Baleni||0),unit:'ks',fromBox:semi.Box_Number,fromPosition:semi.Pozice,referenceType:'PLAN_BALENI',referenceId:id,operationId:ctx.operationId,user:ctx.actor.email});
      }else if(semi.Stav_Polotovaru==='PRIPRAVEN'){
        updateRecord_('SKLAD_POLOTOVARU','Polotovar_ID',semi.Polotovar_ID,{Stav_Polotovaru:'OTEVRENY',Updated_At:now});
      }
    }
    const stockId='HS-'+uuid_();
    const stockStatus=boolValue_(product.Etiketa_Povinna)?'CEKA_ETYKETU':'PRIPRAVENO_K_PREDANI';
    appendRecord_('SKLAD_HOTOVYCH_VYROBKU',{Hotovy_Stock_ID:stockId,Plan_Baleni_ID:id,Produkt_ID:plan.Produkt_ID,Vyrobni_Lot:plan.Vyrobni_Lot,Pocet_Baleni_Aktualne:actualCount,Stav_Zpracovani:stockStatus,Box_Number:box,Pozice:position,Created_At:now,Updated_At:now});
    updateRecord_('PLAN_BALENI','Plan_Baleni_ID',id,{Stav:'DOKONCENO',Skutecny_Pocet_Baleni:actualCount,Datum_Dokonceni:now,Updated_At:now,Operator:ctx.actor.email});
    logMovement_({type:'HOTOVY_VYROBEK',id:stockId,action:'DOKONCENI_BALENI',delta:actualCount,unit:'baleni',toBox:box,toPosition:position,referenceType:'PLAN_BALENI',referenceId:id,operationId:ctx.operationId,user:ctx.actor.email});
    return {entityId:stockId,data:{hotovyStockId:stockId,packages:actualCount,status:stockStatus}};
  });
}

function listPackagingPlans_(){
  return records_('PLAN_BALENI').map(function(plan){
    const out=publicRecord_(plan),product=findRecord_('DB_PRODUKTY','Produkt_ID',plan.Produkt_ID);
    out.Product_Name=product?String(product.Nazev_Produktu):'Neznámý produkt';
    out.Materials=records_('PLAN_BALENI_MATERIAL').filter(function(row){return row.Plan_Baleni_ID===plan.Plan_Baleni_ID;}).map(function(row){
      const stock=findRecord_('SKLAD_BALICIHO_MATERIALU','Stock_Material_ID',row.Stock_Material_ID);
      const material=findRecord_('DB_BALICI_MATERIALY','Material_ID',row.Material_ID);
      const item=publicRecord_(row);item.Material_Name=material?String(material.Nazev_Materialu):row.Material_ID;item.Available=stock?Number(stock.Mnozstvi_Aktualni):0;return item;
    });
    return out;
  }).sort(function(a,b){return String(b.Created_At).localeCompare(String(a.Created_At));});
}

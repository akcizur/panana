function createLabelingPlan_(input,operationKey){
  const hotId=requiredText_(input&&input.hotStockId,'Hotovy_Stock_ID',100);
  const quantity=requireNumber_(input&&input.quantity,'Počet kusů k etiketování',1,10000000);
  const materials=Array.isArray(input&&input.materials)?input.materials:[];
  const hot=findRecord_('SKLAD_HOTOVYCH_VYROBKU','Hotovy_Stock_ID',hotId);
  if(!hot||hot.Stav_Zpracovani!=='CEKA_ETYKETU')throw appError_('Vybraná zásoba nečeká na etiketu.','VALIDATION_ERROR');
  if(quantity>Number(hot.Pocet_Baleni_Aktualne||0))throw appError_('Počet kusů přesahuje dostupnou zásobu.','VALIDATION_ERROR');
  const product=findRecord_('DB_PRODUKTY','Produkt_ID',hot.Produkt_ID);
  if(!product)throw appError_('Produkt nebyl nalezen.','VALIDATION_ERROR');
  if(!materials.length)throw appError_('Přidejte skladovou položku etiket.','VALIDATION_ERROR');
  const normalized=materials.map(function(line){
    const stockId=requiredText_(line&&line.stockId,'Stock_Material_ID etikety',100);
    const planned=requireNumber_(line&&line.plannedQuantity,'Plánovaný počet etiket',1,10000000);
    const stock=activeMaterialStock_(stockId);
    const material=findRecord_('DB_BALICI_MATERIALY','Material_ID',stock.Material_ID);
    if(!material||material.Typ_Materialu!=='ETIKETA')throw appError_('Pro etiketování lze použít pouze materiál typu ETIKETA.','VALIDATION_ERROR');
    if(planned<quantity)throw appError_('Počet etiket musí pokrýt plánované množství výrobků.','VALIDATION_ERROR');
    if(planned>Number(stock.Mnozstvi_Aktualni||0))throw appError_('Nedostatečná zásoba etiket.','VALIDATION_ERROR');
    return {stockId:stockId,materialId:String(stock.Material_ID),quantity:planned,unit:String(stock.Jednotka)};
  });
  return withOperation_('VYTVORENI_PLANS_ETYKETOVANI',operationKey,{hotId:hotId,quantity:quantity,materials:normalized},function(ctx){
    const id=nextIdLocked_('ETIKETOVANI','ET');
    const now=new Date();
    appendRecord_('PLAN_ETYKETOVANI',{
      Plan_Etiketovani_ID:id,Cislo_Planu:id,Plan_Baleni_ID:hot.Plan_Baleni_ID,Hotovy_Stock_ID:hotId,Produkt_ID:hot.Produkt_ID,
      Vyrobni_Lot:hot.Vyrobni_Lot,Pocet_Kusu_Plan:quantity,Pocet_Kusu_Skutecnost:'',Stav:'NAPLANOVANO',
      Datum_Zahajeni:'',Datum_Dokonceni:'',Operator:ctx.actor.email,Poznamka:'',Created_At:now,Updated_At:now
    });
    normalized.forEach(function(line){
      appendRecord_('PLAN_ETYKETOVANI_MATERIAL',{
        Plan_Etiketovani_Polozka_ID:uuid_(),Plan_Etiketovani_ID:id,Material_ID:line.materialId,
        Stock_Material_ID:line.stockId,Mnozstvi_Plan:line.quantity,Mnozstvi_Skutecnost:'',Jednotka:line.unit
      });
    });
    return {entityId:id,data:{planId:id,hotStockId:hotId,quantity:quantity}};
  });
}

function updateLabelingPlanStatus_(planId,nextStatus,operationKey){
  const id=requiredText_(planId,'Plan_Etiketovani_ID',100);
  const target=requireEnum_(nextStatus,['PRIPRAVENO','PROBIHA','ZRUSENO'],'Stav etiketování');
  return withOperation_('ZMENA_STAVU_ETYKETOVANI',operationKey,{planId:id,target:target},function(ctx){
    const plan=findRecord_('PLAN_ETYKETOVANI','Plan_Etiketovani_ID',id);
    if(!plan)throw appError_('Plán etiketování nebyl nalezen.','NOT_FOUND');
    const allowed={NAPLANOVANO:['PRIPRAVENO','ZRUSENO'],PRIPRAVENO:['PROBIHA','ZRUSENO'],PROBIHA:[],DOKONCENO:[],ZRUSENO:[]};
    if((allowed[plan.Stav]||[]).indexOf(target)<0)throw appError_('Nepovolený přechod '+plan.Stav+' → '+target+'.','VALIDATION_ERROR');
    const patch={Stav:target,Updated_At:new Date(),Operator:ctx.actor.email};
    if(target==='PROBIHA'&&!plan.Datum_Zahajeni)patch.Datum_Zahajeni=new Date();
    updateRecord_('PLAN_ETYKETOVANI','Plan_Etiketovani_ID',id,patch);
    return {entityId:id,data:{planId:id,status:target}};
  });
}

function completeLabelingPlan_(input,operationKey){
  const id=requiredText_(input&&input.planId,'Plan_Etiketovani_ID',100);
  const actual=requireNumber_(input&&input.actualCount,'Skutečný počet etiketovaných kusů',1,10000000);
  const actualMaterials=Array.isArray(input&&input.materials)?input.materials:[];
  return withOperation_('DOKONCENI_ETYKETOVANI',operationKey,{planId:id,actual:actual,materials:actualMaterials},function(ctx){
    const plan=findRecord_('PLAN_ETYKETOVANI','Plan_Etiketovani_ID',id);
    if(!plan)throw appError_('Plán etiketování nebyl nalezen.','NOT_FOUND');
    if(plan.Stav!=='PROBIHA')throw appError_('Dokončit lze pouze plán etiketování ve stavu PROBIHA.','VALIDATION_ERROR');
    if(actual>Number(plan.Pocet_Kusu_Plan))throw appError_('Skutečný počet nesmí převýšit plánovaný počet.','VALIDATION_ERROR');
    const hot=findRecord_('SKLAD_HOTOVYCH_VYROBKU','Hotovy_Stock_ID',plan.Hotovy_Stock_ID);
    if(!hot||hot.Stav_Zpracovani!=='CEKA_ETYKETU'||actual>Number(hot.Pocet_Baleni_Aktualne))throw appError_('Zásoba pro etiketování se změnila nebo již není dostupná.','VALIDATION_ERROR');
    const lines=records_('PLAN_ETYKETOVANI_MATERIAL').filter(function(row){return row.Plan_Etiketovani_ID===id;});
    if(actualMaterials.length!==lines.length)throw appError_('Vyplňte skutečnou spotřebu pro všechny položky etiket.','VALIDATION_ERROR');
    const qtyById={};
    actualMaterials.forEach(function(line){
      const lineId=requiredText_(line&&line.lineId,'Plan_Etiketovani_Polozka_ID',100);
      if(qtyById[lineId]!=null)throw appError_('Duplicitní řádek skutečné spotřeby etiket.','VALIDATION_ERROR');
      qtyById[lineId]=requireNumber_(line&&line.quantity,'Skutečný počet spotřebovaných etiket',0,10000000);
    });
    const validated=lines.map(function(line){
      if(qtyById[line.Plan_Etiketovani_Polozka_ID]==null)throw appError_('Chybí skutečná spotřeba etiket.','VALIDATION_ERROR');
      const stock=activeMaterialStock_(line.Stock_Material_ID);
      const material=findRecord_('DB_BALICI_MATERIALY','Material_ID',line.Material_ID);
      if(!material||material.Typ_Materialu!=='ETIKETA')throw appError_('Položka již není typem ETIKETA.','VALIDATION_ERROR');
      if(qtyById[line.Plan_Etiketovani_Polozka_ID]>Number(stock.Mnozstvi_Aktualni||0))throw appError_('Nedostatek etiket '+stock.Stock_Material_ID+'.','VALIDATION_ERROR');
      return {line:line,stock:stock,qty:qtyById[line.Plan_Etiketovani_Polozka_ID]};
    });
    const now=new Date();
    validated.forEach(function(item){
      updateRecord_('SKLAD_BALICIHO_MATERIALU','Stock_Material_ID',item.stock.Stock_Material_ID,{Mnozstvi_Aktualni:Number(item.stock.Mnozstvi_Aktualni)-item.qty,Updated_At:now});
      updateRecord_('PLAN_ETYKETOVANI_MATERIAL','Plan_Etiketovani_Polozka_ID',item.line.Plan_Etiketovani_Polozka_ID,{Mnozstvi_Skutecnost:item.qty});
      logMovement_({type:'BALICI_MATERIAL',id:item.stock.Stock_Material_ID,action:'ETIKETOVANI',delta:-item.qty,unit:item.stock.Jednotka,fromBox:item.stock.Box_Number,fromPosition:item.stock.Pozice,referenceType:'PLAN_ETYKETOVANI',referenceId:id,operationId:ctx.operationId,user:ctx.actor.email});
    });
    const remaining=Number(hot.Pocet_Baleni_Aktualne)-actual;
    let readyId='';
    if(remaining===0){
      updateRecord_('SKLAD_HOTOVYCH_VYROBKU','Hotovy_Stock_ID',hot.Hotovy_Stock_ID,{Stav_Zpracovani:'PRIPRAVENO_K_PREDANI',Updated_At:now});
      readyId=hot.Hotovy_Stock_ID;
    }else{
      updateRecord_('SKLAD_HOTOVYCH_VYROBKU','Hotovy_Stock_ID',hot.Hotovy_Stock_ID,{Pocet_Baleni_Aktualne:remaining,Updated_At:now});
      readyId='HS-'+uuid_();
      appendRecord_('SKLAD_HOTOVYCH_VYROBKU',{
        Hotovy_Stock_ID:readyId,Plan_Baleni_ID:hot.Plan_Baleni_ID,Produkt_ID:hot.Produkt_ID,Vyrobni_Lot:hot.Vyrobni_Lot,
        Pocet_Baleni_Aktualne:actual,Stav_Zpracovani:'PRIPRAVENO_K_PREDANI',Box_Number:hot.Box_Number,Pozice:hot.Pozice,Created_At:now,Updated_At:now
      });
    }
    updateRecord_('PLAN_ETYKETOVANI','Plan_Etiketovani_ID',id,{Stav:'DOKONCENO',Pocet_Kusu_Skutecnost:actual,Datum_Dokonceni:now,Updated_At:now,Operator:ctx.actor.email});
    logMovement_({type:'HOTOVY_VYROBEK',id:readyId,action:'ETIKETOVANI',delta:actual,unit:'baleni',fromBox:hot.Box_Number,fromPosition:hot.Pozice,toBox:hot.Box_Number,toPosition:hot.Pozice,referenceType:'PLAN_ETYKETOVANI',referenceId:id,operationId:ctx.operationId,user:ctx.actor.email,note:remaining?'Částečné etiketování: zásoba rozdělena na oddělené stavové řádky.':'Etiketování dokončeno.'});
    return {entityId:readyId,data:{planId:id,readyStockId:readyId,labelled:actual,waiting:remaining}};
  });
}

function listLabelingPlans_(){
  return records_('PLAN_ETYKETOVANI').map(function(plan){
    const out=publicRecord_(plan),hot=findRecord_('SKLAD_HOTOVYCH_VYROBKU','Hotovy_Stock_ID',plan.Hotovy_Stock_ID);
    const product=findRecord_('DB_PRODUKTY','Produkt_ID',plan.Produkt_ID);
    out.Product_Name=product?String(product.Nazev_Produktu):plan.Produkt_ID;
    out.Available=hot?Number(hot.Pocet_Baleni_Aktualne):0;
    out.Materials=records_('PLAN_ETYKETOVANI_MATERIAL').filter(function(m){return m.Plan_Etiketovani_ID===plan.Plan_Etiketovani_ID;}).map(publicRecord_);
    return out;
  }).sort(function(a,b){return String(b.Created_At).localeCompare(String(a.Created_At));});
}

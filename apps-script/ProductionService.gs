function createProductionPlan_(input, operationKey) {
  const productId = requiredText_(input && input.productId,'Produkt_ID',100);
  const inputType = requireEnum_(String(input && input.inputType || ''),['JEDNA_SUROVINA','RECEPTURA'],'Vstupní typ');
  const recipeId = optionalText_(input && input.recipeId,100);
  const lot = requiredText_(input && input.lot,'Výrobní lot',100);
  const planDate = requiredText_(input && input.date,'Datum plánu',30);
  const priority = requireEnum_(String(input && input.priority || 'NORMALNI'),['NIZKA','NORMALNI','VYSOKA','KRITICKA'],'Priorita');
  const plannedCapsules = input && input.plannedCapsules !== '' && input.plannedCapsules != null ? requireNumber_(input.plannedCapsules,'Plánovaný počet kapslí',1,100000000) : '';
  const product = findRecord_('DB_PRODUKTY','Produkt_ID',productId);
  if (!product || !boolValue_(product.Aktivni)) throw appError_('Produkt neexistuje nebo není aktivní.', 'VALIDATION_ERROR');
  if (product.Typ_Vstupu !== inputType) throw appError_('Vstupní typ neodpovídá nastavení produktu.', 'VALIDATION_ERROR');
  if (product.Forma_Vystupu === 'KAPSLE' && !plannedCapsules) throw appError_('Kapslový plán musí mít plánovaný počet kapslí.', 'VALIDATION_ERROR');
  let recipe = null;
  if (inputType === 'RECEPTURA') {
    recipe = findRecord_('DB_RECEPTURY','Receptura_ID',recipeId);
    if (!recipe || !boolValue_(recipe.Aktivni)) throw appError_('Vyberte aktivní a neměnnou verzi receptury.', 'VALIDATION_ERROR');
    if (recipe.Forma_Vystupu !== product.Forma_Vystupu) throw appError_('Forma výstupu receptury neodpovídá produktu.', 'VALIDATION_ERROR');
  } else if (recipeId) {
    throw appError_('Plán s jednou surovinou nesmí mít Receptura_ID.', 'VALIDATION_ERROR');
  }
  return withOperation_('VYTVORENI_PLANS_VYROBY', operationKey, {productId:productId,inputType:inputType,recipeId:recipeId,lot:lot,date:planDate,priority:priority,plannedCapsules:plannedCapsules}, function(ctx) {
    const id = nextIdLocked_('VYROBNI_PLAN','VY');
    const now = new Date();
    appendRecord_('PLAN_VYROBY',{
      Plan_Vyroby_ID:id,Cislo_Planu:id,Produkt_ID:productId,Vstupni_Typ:inputType,Receptura_ID:recipeId,
      Vyrobni_Lot:lot,Datum_Planu:planDate,Priorita:priority,Planovany_Pocet_Kapsli:plannedCapsules,Skutecny_Pocet_Kapsli:'',
      Stav:'NAPLANOVANO',Datum_Zahajeni:'',Datum_Dokonceni:'',Operator:ctx.actor.email,Poznamka:optionalText_(input && input.note,500),
      Created_At:now,Updated_At:now
    });
    const operations = [];
    if (inputType === 'RECEPTURA') operations.push('NAVAZENI','MICHANI');
    else operations.push('NAVAZENI');
    if (product.Forma_Vystupu === 'KAPSLE') operations.push('KAPSLOVANI');
    operations.push('KONTROLA');
    operations.forEach(function(type,index) {
      appendRecord_('PLAN_VYROBY_OPERACE',{
        Operace_ID:uuid_(),Plan_Vyroby_ID:id,Poradi:index+1,Typ_Operace:type,Stav:'NAPLANOVANO',
        Planovany_Zacatek:'',Skutecny_Zacatek:'',Skutecny_Konec:'',Operator:ctx.actor.email,
        Pocet_Kapsli_Plan:type==='KAPSLOVANI'?plannedCapsules:'',Pocet_Kapsli_Skutecnost:'',Poznamka:''
      });
    });
    return {entityId:id,data:{planId:id,operationCount:operations.length}};
  });
}

function updateProductionPlanStatus_(planId, nextStatus, operationKey) {
  const id = requiredText_(planId,'Plan_Vyroby_ID',100);
  const target = requireEnum_(nextStatus,['PRIPRAVENO','PROBIHA','POZASTAVENO','ZRUSENO'],'Stav plánu');
  return withOperation_('ZMENA_STAVU_VYROBNIHO_PLANS',operationKey,{planId:id,target:target},function(ctx) {
    const plan = findRecord_('PLAN_VYROBY','Plan_Vyroby_ID',id);
    if (!plan) throw appError_('Výrobní plán nebyl nalezen.','NOT_FOUND');
    const allowed = {
      NAPLANOVANO:['PRIPRAVENO','ZRUSENO'],
      PRIPRAVENO:['PROBIHA','ZRUSENO'],
      PROBIHA:['POZASTAVENO'],
      POZASTAVENO:['PROBIHA','ZRUSENO'],
      DOKONCENO:[],
      ZRUSENO:[]
    };
    if ((allowed[plan.Stav]||[]).indexOf(target)<0) throw appError_('Nepovolený přechod stavu '+plan.Stav+' → '+target+'.','VALIDATION_ERROR');
    const now = new Date();
    const patch = {Stav:target,Updated_At:now,Operator:ctx.actor.email};
    if (target==='PROBIHA' && !plan.Datum_Zahajeni) patch.Datum_Zahajeni=now;
    updateRecord_('PLAN_VYROBY','Plan_Vyroby_ID',id,patch);
    records_('PLAN_VYROBY_OPERACE').filter(function(op){return op.Plan_Vyroby_ID===id && op.Stav!=='DOKONCENO' && op.Stav!=='ZRUSENO';}).forEach(function(op){
      const opState = target==='PROBIHA' ? (op.Stav==='NAPLANOVANO'?'PROBIHA':op.Stav) : target==='POZASTAVENO'?'POZASTAVENO':target==='ZRUSENO'?'ZRUSENO':op.Stav;
      if (opState!==op.Stav) {
        const p={Stav:opState,Operator:ctx.actor.email};
        if (target==='PROBIHA' && !op.Skutecny_Zacatek) p.Skutecny_Zacatek=now;
        if (target==='ZRUSENO') p.Skutecny_Konec=now;
        updateRecord_('PLAN_VYROBY_OPERACE','Operace_ID',op.Operace_ID,p);
      }
    });
    return {entityId:id,data:{planId:id,status:target}};
  });
}

function completeProductionPlan_(input, operationKey) {
  const id = requiredText_(input && input.planId,'Plan_Vyroby_ID',100);
  const box = requiredText_(input && input.box,'Box_Number',80);
  const position = activePosition_(input && input.position);
  return withOperation_('DOKONCENI_VYROBY',operationKey,{planId:id,box:box,position:position,actualCapsules:input && input.actualCapsules},function(ctx) {
    const plan = findRecord_('PLAN_VYROBY','Plan_Vyroby_ID',id);
    if (!plan) throw appError_('Výrobní plán nebyl nalezen.','NOT_FOUND');
    if (plan.Stav!=='PROBIHA') throw appError_('Dokončit lze pouze plán ve stavu PROBIHA.','VALIDATION_ERROR');
    const product = findRecord_('DB_PRODUKTY','Produkt_ID',plan.Produkt_ID);
    const usedRows = records_('PLAN_VYROBY_SUROVINY').filter(function(row){return row.Plan_Vyroby_ID===id && row.Stav_Pouziti==='POUZITO';});
    if (!usedRows.length) throw appError_('Nejdříve potvrďte skutečné použití alespoň jednoho packu.','VALIDATION_ERROR');
    if (plan.Vstupni_Typ==='RECEPTURA') {
      const recipeRows=records_('DB_RECEPTURY_SUROVINY').filter(function(r){return r.Receptura_ID===plan.Receptura_ID;});
      const usedSuroviny=usedRows.map(function(u){const p=findRecord_('SKLAD_SUROVIN','Pack_ID',u.Pack_ID);return p&&p.Surovina_ID;});
      const missing=recipeRows.filter(function(r){return usedSuroviny.indexOf(r.Surovina_ID)<0;});
      if (missing.length) throw appError_('Chybí potvrzené packy pro suroviny receptury: '+missing.map(function(r){return surovinaName_(r.Surovina_ID);}).join(', ')+'.','VALIDATION_ERROR');
    }
    let actualCapsules='';
    if (product.Forma_Vystupu==='KAPSLE') {
      actualCapsules=requireNumber_(input && input.actualCapsules,'Skutečný počet kapslí',1,100000000);
      if (Number(plan.Planovany_Pocet_Kapsli)>0 && actualCapsules>Number(plan.Planovany_Pocet_Kapsli)) throw appError_('Skutečný počet kapslí nesmí překročit plánovaný počet bez změny plánu.','VALIDATION_ERROR');
    }
    const now=new Date();
    const semiId=nextIdLocked_('POLOTOVAR','PO');
    const semiType=product.Forma_Vystupu==='KAPSLE'?'KAPSLE_NEZABALENE':'SYPKA_SMES';
    appendRecord_('SKLAD_POLOTOVARU',{
      Polotovar_ID:semiId,Plan_Vyroby_ID:id,Produkt_ID:plan.Produkt_ID,Typ_Polotovaru:semiType,
      Vyrobni_Lot:plan.Vyrobni_Lot,Pocet_Kapsli_Aktualne:actualCapsules,Stav_Polotovaru:'PRIPRAVEN',
      Box_Number:box,Pozice:position,Created_At:now,Updated_At:now,Poznamka:'Výstup potvrzen obsluhou. Neprovádí se hmotnostní bilance.'
    });
    updateRecord_('PLAN_VYROBY','Plan_Vyroby_ID',id,{Stav:'DOKONCENO',Skutecny_Pocet_Kapsli:actualCapsules,Datum_Dokonceni:now,Updated_At:now,Operator:ctx.actor.email});
    records_('PLAN_VYROBY_OPERACE').filter(function(op){return op.Plan_Vyroby_ID===id;}).forEach(function(op){
      updateRecord_('PLAN_VYROBY_OPERACE','Operace_ID',op.Operace_ID,{Stav:'DOKONCENO',Skutecny_Konec:now,Operator:ctx.actor.email,Pocet_Kapsli_Skutecnost:op.Typ_Operace==='KAPSLOVANI'?actualCapsules:op.Pocet_Kapsli_Skutecnost});
    });
    if (plan.Vstupni_Typ==='RECEPTURA') logMovement_({type:'PLAN_VYROBY',id:id,action:'MICHANI',referenceType:'RECEPTURA',referenceId:plan.Receptura_ID,operationId:ctx.operationId,user:ctx.actor.email,note:'Evidence seznamu packů bez hmotnostní bilance.'});
    if (product.Forma_Vystupu==='KAPSLE') logMovement_({type:'PLAN_VYROBY',id:id,action:'KAPSLOVANI',delta:actualCapsules,unit:'ks',referenceType:'POLOTOVAR',referenceId:semiId,operationId:ctx.operationId,user:ctx.actor.email});
    logMovement_({type:'POLOTOVAR',id:semiId,action:'VZNIK_POLOTOVARU',delta:product.Forma_Vystupu==='KAPSLE'?actualCapsules:'',unit:product.Forma_Vystupu==='KAPSLE'?'ks':'',toBox:box,toPosition:position,referenceType:'PLAN_VYROBY',referenceId:id,operationId:ctx.operationId,user:ctx.actor.email});
    return {entityId:semiId,data:{planId:id,semiId:semiId,type:semiType,actualCapsules:actualCapsules}};
  });
}

function listProductionPlans_() {
  return records_('PLAN_VYROBY').map(function(plan){
    const out=publicRecord_(plan);
    const product=findRecord_('DB_PRODUKTY','Produkt_ID',plan.Produkt_ID);
    out.Product_Name=product?String(product.Nazev_Produktu):'Neznámý produkt';
    out.Packs=records_('PLAN_VYROBY_SUROVINY').filter(function(p){return p.Plan_Vyroby_ID===plan.Plan_Vyroby_ID;}).map(publicRecord_);
    out.Operations=records_('PLAN_VYROBY_OPERACE').filter(function(p){return p.Plan_Vyroby_ID===plan.Plan_Vyroby_ID;}).map(publicRecord_);
    return out;
  }).sort(function(a,b){return String(b.Created_At).localeCompare(String(a.Created_At));});
}

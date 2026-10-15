function createHandover_(input,operationKey){
  const recipient=requiredText_(input&&input.recipient,'Převzal',200);
  const reference=optionalText_(input&&input.reference,160);
  const note=optionalText_(input&&input.note,500);
  const requested=Array.isArray(input&&input.items)?input.items:[];
  if(!requested.length)throw appError_('Předání musí obsahovat alespoň jednu položku.','VALIDATION_ERROR');
  const items=requested.map(function(item){
    const stockId=requiredText_(item&&item.stockId,'Hotovy_Stock_ID',120);
    const quantity=requireNumber_(item&&item.quantity,'Počet balení k předání',1,10000000);
    return {stockId:stockId,quantity:quantity};
  });
  if(new Set(items.map(function(item){return item.stockId;})).size!==items.length)throw appError_('Každý skladový řádek zadejte v předání pouze jednou.','VALIDATION_ERROR');
  return withOperation_('PREDANI_EXPEDICI',operationKey,{recipient:recipient,reference:reference,note:note,items:items},function(ctx){
    const ready=items.map(function(item){
      const stock=findRecord_('SKLAD_HOTOVYCH_VYROBKU','Hotovy_Stock_ID',item.stockId);
      if(!stock||stock.Stav_Zpracovani!=='PRIPRAVENO_K_PREDANI')throw appError_('Položka '+item.stockId+' není připravena k předání.','VALIDATION_ERROR');
      if(item.quantity>Number(stock.Pocet_Baleni_Aktualne))throw appError_('Předání překračuje dostupné množství pro '+item.stockId+'.','VALIDATION_ERROR');
      return {requested:item,stock:stock,product:findRecord_('DB_PRODUKTY','Produkt_ID',stock.Produkt_ID)};
    });
    const now=new Date();
    const handoverId=nextIdLocked_('PREDANI','EXP');
    appendRecord_('PREDANI_EXPEDICI',{Predani_ID:handoverId,Timestamp:now,Predal:ctx.actor.email,Prevzal:recipient,Reference_Expedice:reference,Poznamka:note});
    const resultItems=[];
    ready.forEach(function(item){
      const stock=item.stock,qty=item.requested.quantity,remaining=Number(stock.Pocet_Baleni_Aktualne)-qty;
      let handedId=stock.Hotovy_Stock_ID;
      if(remaining===0){
        updateRecord_('SKLAD_HOTOVYCH_VYROBKU','Hotovy_Stock_ID',stock.Hotovy_Stock_ID,{Stav_Zpracovani:'PREDANO_EXPEDICI',Updated_At:now});
      }else{
        updateRecord_('SKLAD_HOTOVYCH_VYROBKU','Hotovy_Stock_ID',stock.Hotovy_Stock_ID,{Pocet_Baleni_Aktualne:remaining,Updated_At:now});
        handedId='HS-'+uuid_();
        appendRecord_('SKLAD_HOTOVYCH_VYROBKU',{
          Hotovy_Stock_ID:handedId,Plan_Baleni_ID:stock.Plan_Baleni_ID,Produkt_ID:stock.Produkt_ID,Vyrobni_Lot:stock.Vyrobni_Lot,
          Pocet_Baleni_Aktualne:qty,Stav_Zpracovani:'PREDANO_EXPEDICI',Box_Number:stock.Box_Number,Pozice:stock.Pozice,Created_At:now,Updated_At:now
        });
      }
      appendRecord_('PREDANI_EXPEDICI_POLOZKY',{
        Predani_Polozka_ID:uuid_(),Predani_ID:handoverId,Hotovy_Stock_ID:handedId,Produkt_ID:stock.Produkt_ID,Vyrobni_Lot:stock.Vyrobni_Lot,
        Pocet_Baleni:qty,Jednotka_Baleni:'balení',Poznamka:''
      });
      logMovement_({type:'HOTOVY_VYROBEK',id:handedId,action:'PREDANI_EXPEDICI',delta:-qty,unit:'baleni',fromBox:stock.Box_Number,fromPosition:stock.Pozice,toBox:stock.Box_Number,toPosition:stock.Pozice,referenceType:'PREDANI_EXPEDICI',referenceId:handoverId,operationId:ctx.operationId,user:ctx.actor.email,note:remaining?'Částečné předání; nevyexpedovaný zbytek zůstal samostatnou skladovou položkou.':''});
      resultItems.push({stockId:handedId,productId:stock.Produkt_ID,lot:stock.Vyrobni_Lot,quantity:qty,remaining:remaining});
    });
    return {entityId:handoverId,data:{handoverId:handoverId,items:resultItems}};
  });
}

function listFinishedStock_(){
  const products=records_('DB_PRODUKTY');
  return records_('SKLAD_HOTOVYCH_VYROBKU').map(function(stock){
    const out=publicRecord_(stock),product=products.find(function(p){return p.Produkt_ID===stock.Produkt_ID;});
    out.Product_Name=product?String(product.Nazev_Produktu):stock.Produkt_ID;
    out.Label_Required=product?boolValue_(product.Etiketa_Povinna):false;
    return out;
  }).sort(function(a,b){return String(b.Updated_At).localeCompare(String(a.Updated_At));});
}

function listHandovers_(){
  const entries=records_('PREDANI_EXPEDICI');
  const items=records_('PREDANI_EXPEDICI_POLOZKY');
  return entries.map(function(entry){
    const out=publicRecord_(entry);
    out.Items=items.filter(function(item){return item.Predani_ID===entry.Predani_ID;}).map(function(item){
      const row=publicRecord_(item),product=findRecord_('DB_PRODUKTY','Produkt_ID',item.Produkt_ID);
      row.Product_Name=product?String(product.Nazev_Produktu):String(item.Produkt_ID);
      return row;
    });
    out.Item_Count=out.Items.reduce(function(sum,item){return sum+Number(item.Pocet_Baleni||0);},0);
    return out;
  }).sort(function(a,b){return new Date(b.Timestamp).getTime()-new Date(a.Timestamp).getTime();}).slice(0,100);
}

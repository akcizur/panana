function confirmSemiFinishedConsumed_(semiId,operationKey){
  const id=requiredText_(semiId,'Polotovar_ID',100);
  return withOperation_('POTVRZENI_SPOTREBOVANI_POLOTOVARU',operationKey,{semiId:id},function(ctx){
    const semi=findRecord_('SKLAD_POLOTOVARU','Polotovar_ID',id);
    if(!semi)throw appError_('Polotovar nebyl nalezen.','NOT_FOUND');
    if(semi.Typ_Polotovaru!=='SYPKA_SMES')throw appError_('Samostatné potvrzení je určeno pouze pro sypkou směs. Kapsle se evidují kusově.','VALIDATION_ERROR');
    if(['PRIPRAVEN','OTEVRENY'].indexOf(semi.Stav_Polotovaru)<0)throw appError_('Polotovar už není dostupný pro potvrzení spotřebování.','VALIDATION_ERROR');
    const pending=records_('PLAN_BALENI').filter(function(plan){return plan.Zdroj_Typ==='POLOTOVAR'&&plan.Zdroj_ID===id&&['NAPLANOVANO','PRIPRAVENO','PROBIHA','POZASTAVENO'].indexOf(plan.Stav)>=0;});
    if(pending.length)throw appError_('Polotovar má aktivní plán balení '+pending.map(function(plan){return plan.Plan_Baleni_ID;}).join(', ')+'. Nejprve plán dokončete nebo zrušte.','VALIDATION_ERROR');
    const now=new Date();
    updateRecord_('SKLAD_POLOTOVARU','Polotovar_ID',id,{Stav_Polotovaru:'SPOTREBOVANY',Updated_At:now,Poznamka:optionalText_((semi.Poznamka?String(semi.Poznamka)+' · ':'')+'Spotřebování fyzicky potvrdil '+ctx.actor.email,500)});
    logMovement_({type:'POLOTOVAR',id:id,action:'SPOTREBA_POLOTOVARU',referenceType:'OPERATORSKE_POTVRZENI',referenceId:id,operationId:ctx.operationId,user:ctx.actor.email,note:'Spotřebování sypké směsi explicitně potvrdila obsluha. Aplikace nepočítá zbývající hmotnost.'});
    return {entityId:id,data:{semiFinishedId:id,status:'SPOTREBOVANY'}};
  });
}

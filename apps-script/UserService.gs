function saveAuthorizedUser_(input,operationKey){
  const email=requiredText_(input&&input.email,'Google e-mail',254).toLowerCase();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw appError_('Zadejte platný Google e-mail.','VALIDATION_ERROR');
  const role=requireEnum_(String(input&&input.role||'').toUpperCase(),ROLE_VALUES,'Role');
  const active=Boolean(input&&input.active);
  return withOperation_('ZMENA_OPRAVNENI_UZIVATELE',operationKey,{email:email,role:role,active:active},function(ctx){
    const existing=findRecord_('DB_UZIVATELE','Email',email);
    const activeAdmins=records_('DB_UZIVATELE').filter(function(user){return String(user.Role).toUpperCase()==='ADMIN'&&boolValue_(user.Aktivni);});
    if(existing&&String(existing.Role).toUpperCase()==='ADMIN'&&boolValue_(existing.Aktivni)&&(!active||role!=='ADMIN')&&activeAdmins.length<=1)throw appError_('Nelze deaktivovat ani změnit roli posledního aktivního ADMIN účtu.','VALIDATION_ERROR');
    const now=new Date();
    if(existing){
      updateRecord_('DB_UZIVATELE','Email',email,{Role:role,Aktivni:active,Updated_At:now});
      return {entityId:email,data:{email:email,role:role,active:active,updated:true}};
    }
    appendRecord_('DB_UZIVATELE',{Email:email,Role:role,Aktivni:active,Created_At:now,Updated_At:now});
    return {entityId:email,data:{email:email,role:role,active:active,created:true}};
  });
}

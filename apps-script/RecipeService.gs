function createRecipeVersion_(input, operationKey) {
  const baseId = optionalText_(input && input.baseRecipeId, 100);
  const proposedName = requiredText_(input && input.name, 'Název receptury', 200);
  const form = requireEnum_(String(input && input.outputForm || ''), ['SYPKA','KAPSLE'], 'Forma výstupu');
  const ingredientIds = Array.isArray(input && input.ingredientIds) ? input.ingredientIds.map(function(id) { return requiredText_(id, 'Surovina', 100); }) : [];
  if (!ingredientIds.length) throw appError_('Receptura musí obsahovat alespoň jednu surovinu.', 'VALIDATION_ERROR');
  if (new Set(ingredientIds).size !== ingredientIds.length) throw appError_('Receptura obsahuje duplicitní surovinu.', 'VALIDATION_ERROR');
  ingredientIds.forEach(function(id) {
    const row = findRecord_('DB_SUROVINY','Surovina_ID',id);
    if (!row || !boolValue_(row.Aktivni)) throw appError_('Surovina ' + id + ' neexistuje nebo není aktivní.', 'VALIDATION_ERROR');
  });
  return withOperation_('VYTVORENI_VERZE_RECEPTURY', operationKey, { baseId:baseId, name:proposedName, form:form, ingredients:ingredientIds }, function(ctx) {
    let name = proposedName;
    let version = 1;
    if (baseId) {
      const base = findRecord_('DB_RECEPTURY','Receptura_ID',baseId);
      if (!base) throw appError_('Výchozí verze receptury nebyla nalezena.', 'NOT_FOUND');
      name = String(base.Nazev_Receptury);
      if (String(base.Forma_Vystupu) !== form) throw appError_('Nová verze musí zachovat formu výstupu. Pro jinou formu založte novou recepturu.', 'VALIDATION_ERROR');
      version = records_('DB_RECEPTURY').filter(function(row) { return String(row.Nazev_Receptury).toLowerCase() === name.toLowerCase(); }).reduce(function(max,row) { return Math.max(max,Number(row.Verze)||0); },0) + 1;
    } else if (records_('DB_RECEPTURY').some(function(row) { return String(row.Nazev_Receptury).trim().toLowerCase() === name.toLowerCase(); })) {
      throw appError_('Receptura s tímto názvem už existuje. Pro změnu založte novou verzi ze stávající receptury.', 'VALIDATION_ERROR');
    }
    const id = nextIdLocked_('RECEPTURA','R');
    appendRecord_('DB_RECEPTURY',{Receptura_ID:id,Nazev_Receptury:name,Verze:version,Forma_Vystupu:form,Aktivni:true,Poznamka:optionalText_(input && input.note,500),Created_At:new Date(),Created_By:ctx.actor.email});
    ingredientIds.forEach(function(surovinaId,index) {
      appendRecord_('DB_RECEPTURY_SUROVINY',{Receptura_Polozka_ID:uuid_(),Receptura_ID:id,Poradi:index+1,Surovina_ID:surovinaId,Poznamka:''});
    });
    return {entityId:id,data:{recipeId:id,name:name,version:version}};
  });
}

function listRecipes_() {
  const ingredients = records_('DB_RECEPTURY_SUROVINY');
  return records_('DB_RECEPTURY').map(function(recipe) {
    return Object.assign(publicRecord_(recipe),{
      ingredients:ingredients.filter(function(item){return item.Receptura_ID===recipe.Receptura_ID;}).sort(function(a,b){return Number(a.Poradi)-Number(b.Poradi);}).map(function(item){
        return {id:String(item.Surovina_ID),name:surovinaName_(item.Surovina_ID),order:Number(item.Poradi)};
      })
    });
  }).sort(function(a,b){return String(a.Nazev_Receptury).localeCompare(String(b.Nazev_Receptury),'cs')||Number(b.Verze)-Number(a.Verze);});
}

# Projektový chat log — Panana sklad a výroba

Repo: https://github.com/akcizur/panana
Produkční specifikace: [PRODUCTION-SPEC-V2.md](PRODUCTION-SPEC-V2.md)
Deployment: [apps-script/README.md](../apps-script/README.md)

Tento soubor je průběžný technický záznam viditelných projektových zpráv a rozhodnutí. Neobsahuje skryté reasoning ani interní systémové instrukce. Přiložený uživatelský dokument je přepsán do strukturované specifikace v repo.

## 2026-10-15 — Výběr repozitáře a UI směr

**Uživatel:** https://github.com/akcizur/panana

**Asistent:** Repo bylo identifikováno jako samostatný React + Vite prototyp skladu/výroby s GitHub Pages deploymentem. Stávající klientské demo přihlášení a role nejsou serverové zabezpečení.

**Uživatel:** y

**Asistent:** Potvrzeno, že Panana je aktuální repozitář pro další práci.

**Uživatel:** yes

**Asistent:** Navržen UI/UX remaster: provozní pracovní plocha skladu/výroby, silnější informační hierarchie, Pack jako hlavní objekt, responzivní rozhraní a zachování Vite/GitHub Pages pro demo.

## 2026-10-15 — Nahraná produkční specifikace v2

**Uživatel přiložil:** Vložený text.txt — „Produkční specifikace v2: sklad, výroba a QR identifikace packů“.

**Požadavky uživatele převzaté do implementace:**
- Produkční platforma Google Sheets + Google Apps Script + HTML/CSS/JavaScript; bez samostatného serveru, Vercel, Convex, externí QR API a placeného hostingu.
- Jeden fyzický raw pack = jedno neměnné Pack_ID = jeden QR štítek.
- QR obsahuje stabilní deeplink, aktuální stav a umístění se čtou z Sheets po autorizaci.
- Jen počáteční hmotnost; žádná zbytková ani přesně spotřebovaná hmotnost.
- Otevření/vyprázdnění potvrzuje obsluha, přesuny a stavové změny se auditují.
- Čtyři výrobní cesty; vazby na konkrétní Pack_ID a verzované receptury.
- Kusová evidence kapslí, obalů a hotových balení; volitelné/povinné etikety; částečné předání do expedice.
- Apps Script jako jediná vrstva pro zápis dat; přesné hlavičky listů; idempotence a audit.
- Přístup podle rolí ADMIN, VEDOUCI, SKLAD, VYROBA, READONLY. Neznámá identita znamená odmítnutí, ne anonymní fallback.
- QR generátor má být lokálně vendored, nikoli vzdálený endpoint/CDN.

## Rozhodnutí k architektuře

React/Vite v kořeni repozitáře zůstává výslovně preview/demo. GitHub Pages není autorizovaný backend pro soukromá skladová data. Nová produkční implementace je umístěna v apps-script/ a nasazení vyžaduje cílový Google Sheet, Google účet a ověření identity.

## Soubory přidané v implementační větvi

- apps-script/appsscript.json
- apps-script/Config.gs
- apps-script/SheetRepository.gs
- apps-script/ValidationService.gs
- apps-script/AuthService.gs
- apps-script/IdService.gs
- apps-script/OperationService.gs
- apps-script/MovementLogService.gs
- apps-script/QrService.gs
- apps-script/LabelService.gs
- apps-script/InventoryService.gs
- apps-script/MasterDataService.gs
- apps-script/RecipeService.gs
- apps-script/ProductionService.gs
- apps-script/PackagingService.gs
- apps-script/LabelingService.gs
- apps-script/HandoverService.gs
- apps-script/SemiFinishedService.gs
- apps-script/UserService.gs
- apps-script/Code.gs a HTML partials
- scripts/validate-apps-script.mjs
- .github/workflows/apps-script-validation.yml
- docs/PRODUCTION-SPEC-V2.md
- docs/IMPLEMENTATION-STATUS.md

## Aktuální pravdivý stav

Kód je připraven v samostatné větvi feat/apps-script-production-v2. Není sloučený do main a není nasazený do živého Google Apps Script deploymentu. Další krok je otevřít PR, počkat na zelený syntax/invariant test, opravit případné nalezené chyby a až poté řešit Google-side deployment.

## Další povinné kroky

1. Ověřit CI syntax/invariant test.
2. Zkontrolovat a sloučit změny přes PR po úspěšném testu.
3. Nasadit do kopie testovacího Sheets a ověřit inicializaci bez ztráty dat.
4. Ověřit identitu a všechny role na skutečných Google účtech.
5. Otestovat A–D výrobní cesty, QR/tisk, částečné etiketování/předání, souběh, idempotenci a obnovu.
6. Nezadávat reálné skladové údaje do GitHub Pages dema.
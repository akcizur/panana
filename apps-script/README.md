# Sklad a výroba — Google Apps Script production app

Toto je produkční implementace podle [Produkční specifikace v2](../docs/PRODUCTION-SPEC-V2.md). Datovým zdrojem pravdy je Google Sheets a jediná vrstva zapisující provozní data je Google Apps Script.

**Kořenová React/Vite aplikace a GitHub Pages jsou pouze demo/preview.** Nezadávejte do nich reálné skladové údaje.

## Co je ve zdroji

- Přesná schémata Sheets a neinvasivní inicializace.
- Whitelist uživatelů podle Google identity a role.
- Příjem packů, ID, QR deeplink, detail, vyhledávání, přesun, plánování a potvrzení použití, potvrzení vyprázdnění.
- Místně vložený QR generátor bez CDN a QR_LABEL_LOG.
- Produkty, suroviny, verzované receptury, výrobní plány a postupné operace, polotovary.
- Obalové zásoby, balení, skutečná spotřeba materiálu, hotové výrobky, částečné etiketování a předání.
- LockService, idempotency key a OPERATIONS_LOG.
- GitHub Actions syntaxní/invariantní kontrola.

## Bezpečnost

Nenasazujte anonymně. Backend očekává, že Session.getActiveUser().getEmail() vrátí skutečný Google e-mail, který je aktivní v DB_UZIVATELE. Pokud identita není dostupná, API požadavek odmítne. Před nasazením otestujte dostupnost identity pro každý typ účtu a zvolený režim web app. Pokud ji Google neposkytne, neuvádějte aplikaci do provozu a nepřecházejte na anonymní režim.

Google Sheets nemá transakce napříč listy. ScriptLock řeší souběh jen mezi běhy používajícími stejný zámek. RECOVERY_REQUIRED musí mít před produkcí otestovaný manuální postup autorizované kompenzace.

## 1. Cílový spreadsheet

1. Založte nový Google Spreadsheet pod účtem vlastníka provozu.
2. V spreadsheetu otevřete Rozšíření → Apps Script; používejte container-bound projekt.
3. Zkopírujte serverové a HTML soubory z této složky se zachováním jmen.
4. Z Apps Script editoru spusťte initializeWorkbook_ a schvalte přístup. Vytvoří chybějící listy/hlavičky, CONFIG a pozice A1–D10. Nikdy nemaže existující řádky; při nesouladu hlaviček se zastaví.
5. Z Apps Script editoru spusťte provisionFirstAdmin_ pod účtem prvního správce. Funkce je privátní a není dostupná browser RPC.
6. Ověřte řádek ADMIN v DB_UZIVATELE a přidejte ostatní uživatele.

## 2. Volitelná synchronizace přes clasp

Požaduje Node.js 22 a oprávnění k Apps Script projektu.

    npm install --global @google/clasp
    clasp login

V Apps Script Project Settings zkopírujte Script ID. Vytvořte `.clasp.json` podle `.clasp.json.example`, vložte vlastní ID a nikdy necommitujte soubor `.clasp.json`. Z kořene `apps-script/` spusťte:

    clasp status
    clasp push

`clasp push` nahraje zdrojový kód, ale není to deployment.

## 3. Nasazení webové aplikace

1. Apps Script → Deploy → New deployment → Web app.
2. Nastavte omezený přístup pouze pro zamýšlené ověřené účty/organizaci; nikdy ne anonymní veřejný přístup.
3. Ověřte, že Session.getActiveUser().getEmail() poskytuje identitu pro reálné účty a zvolený přístupový režim.
4. Zkopírujte produkční URL končící `/exec` a nastavte CONFIG.APP_BASE_URL.
5. Přihlaste se jako ADMIN, otestujte neoprávněného a neznámého uživatele.
6. Vytvořte testovací surovinu/produkt/obal a teprve pak testovací pack.
7. Fyzicky vytiskněte štítek 50×30 mm a skenujte ho nativní kamerou telefonu.

## 4. Aktualizace a QR URL

Standardní vydání aktualizuje existující deployment, aby URL zůstala stejná. Změna APP_BASE_URL po vytvoření packů je migrační událost; API ji zablokuje. Než se URL změní, musí být připraven redirect nebo plán přetisku starých štítků.

## 5. Ověření a omezení

GitHub Actions parsuje Apps Script soubory a inline JavaScript, kontroluje manifest, schéma a základní validace. Neověřuje reálná Google oprávnění, běh vůči živému Sheets, kamery, tiskárny, souběh ani zotavení z partial write. Před produkcí postupujte podle [IMPLEMENTATION-STATUS.md](../docs/IMPLEMENTATION-STATUS.md) a testů v [PRODUCTION-SPEC-V2.md](../docs/PRODUCTION-SPEC-V2.md).
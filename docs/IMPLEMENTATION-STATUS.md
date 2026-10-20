# Stav implementace — Production v2

**Datum:** 2026-10-15. **Větev:** feat/apps-script-production-v2.

## Ve zdrojovém repozitáři

- [x] Manifest Apps Script V8 a Europe/Prague.
- [x] Přesné hlavičky Google Sheets a neinvasivní inicializátor.
- [x] A1–D10 a čítače ID; detekce zaostávající sekvence.
- [x] Whitelist identity/rolí a odmítnutí, pokud identita není dostupná.
- [x] Příjem packu, neměnné Pack_ID, hledání/detail, přesun, plánované a skutečné použití, samostatné potvrzení vyprázdnění.
- [x] Append-only POHYBY_LOG a QR_LABEL_LOG.
- [x] OPERATIONS_LOG: idempotency key, hash payloadu, stav a značka RECOVERY_REQUIRED.
- [x] Lokálně vendored QR generátor bez CDN, licence a QR deep-link validace.
- [x] Žádost o tisk/opakovaný tisk s auditem a formát 50×30/60×40 mm.
- [x] Kmenová surovina/produkty/obaly a příjem obalových zásob.
- [x] Neměnné verze receptur a položky surovin.
- [x] Výrobní plán s postupnými operacemi, celé počty kapslí.
- [x] Polotovar a explicitní potvrzení spotřebování sypké směsi.
- [x] Plány balení, evidence skutečné spotřeby materiálu a vytvoření hotové zásoby.
- [x] Etiketování včetně částečného rozdělení hotové zásoby.
- [x] Vícepoložkové/částečné předání expedici.
- [x] Responzivní Apps Script UI, role-based navigation a správa uživatelů.
- [x] Blokování nebezpečné změny APP_BASE_URL po založení packů.
- [x] Markdown specifikace, deployment návod, checklist a projektový chat log.
- [x] Přidán GitHub Actions job pro syntax/invariant testy Apps Scriptu.

## Zatím NEPOTVRZENO / blokuje produkční označení

- [ ] Apps Script není nasazený v Google účtu uživatele. Zdrojový kód v GitHubu není aktivní produkční deployment.
- [ ] CI validace musí doběhnout zeleně v PR; do té doby není správné tvrdit, že syntaxe je kompletně ověřena.
- [ ] Spustit inicializátor na prázdném testovacím Sheets a na kopii se zachovanými existujícími daty.
- [ ] Vyzkoušet Session.getActiveUser().getEmail() se všemi skutečnými typy Google účtů a zvoleným deployment access mode.
- [ ] Ověřit sdílení spreadsheetu a ochranu listů proti obcházení UI přímými editacemi.
- [ ] End-to-end testovat všechny čtyři výrobní cesty na testovacích datech.
- [ ] Otestovat role, dvojité/replayed požadavky a souběh více uživatelů.
- [ ] Nacvičit částečné vícelistové selhání, autorizovanou kompenzaci a obnovu zálohy.
- [ ] Vytisknout 50×30 a 60×40 mm štítek na reálné tiskárně a skenovat cílovými telefony.
- [ ] Otestovat zálohu/restore a porovnat všechny čítače ID s existujícími záznamy.
- [ ] Ověřit limity/kvóty Apps Scriptu a výkon na očekávaném objemu provozu.
- [ ] Vyzkoušet přístupnost a mobilní UI na skutečných skladových zařízeních.

## Architektonická hranice

GitHub Pages nadále poskytuje pouze původní React/Vite prototyp. Jeho klientské demo role nejsou zabezpečení a nesmí obsahovat reálné skladové údaje. Produkční cíl dle specifikace je Google Apps Script + Google Sheets. Samotný syntaktický CI test neověřuje oprávnění Google účtů, fyzický tisk/kameru, souběh Sheets ani zotavení po částečném zápisu.

## Kritický provozní blok

Google Sheets nemá transakce napříč listy. OPERATIONS_LOG umožňuje dohledání stavu, ale samotné označení RECOVERY_REQUIRED není automatická kompenzace. Před ostrým provozem musí být otestován a zdokumentován správný postup zotavení pro každý kritický vícelistový workflow.
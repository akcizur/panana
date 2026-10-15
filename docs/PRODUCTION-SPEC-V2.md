# Produkční specifikace v2 — sklad, výroba a QR identifikace packů

**Platforma:** Google Sheets + Google Apps Script + HTML/CSS/JavaScript. **Zdroj pravdy:** tento dokument. Názvy listů, sloupců, stavů a akcí jsou kontrakt; změna schématu vyžaduje současnou úpravu backendu, UI a testů.

## 1. Návrhová pravidla

1. Jeden fyzický raw pack = jedno neměnné Pack_ID = jeden QR štítek.
2. QR identifikuje pack a odkazuje na detail. Není databází ani přístupovým tokenem. Stav a aktuální umístění se vždy načítají z Google Sheets po serverové autorizaci.
3. Eviduje se pouze počáteční hmotnost při příjmu. Žádná zbytková hmotnost ani přesná spotřebovaná hmotnost se nesmí dopočítávat.
4. Otevření packu potvrzuje skutečné použití, nikoli samotné plánování.
5. Vyprázdnění samostatně potvrzuje obsluha. Aplikace ho neodvozuje z počáteční hmotnosti ani plánů.
6. Box_Number a Pozice jsou aktuální proměnné umístění. Každý přesun se audituje. QR se po přesunu nemění.
7. Výroba musí podporovat přímé plnění jedné suroviny, kapslování jedné suroviny, recepturu s přímým balením a recepturu s následným kapslováním.
8. Etiketování je povinné jen podle DB_PRODUKTY.Etiketa_Povinna.
9. Potvrzené předání hotového výrobku do expedice je poslední operace aplikace.
10. Apps Script je jediná vrstva zapisující provozní data. Frontend Sheets nikdy neupravuje přímo.
11. POHYBY_LOG a QR_LABEL_LOG jsou append-only. Chyby se řeší autorizovanou kompenzací; audit se nemaže ani nepřepisuje.
12. Kritické operace používají LockService, idempotency key a OPERATIONS_LOG. LockService nenahrazuje zotavení po částečném vícelistovém zápisu.
13. Pokud nelze spolehlivě ověřit identitu uživatele, přístup se odmítne. Není povolen anonymní fallback.
14. Otevřený pack může být propojen s více výrobními plány. Po VYPRAZDNENY už nesmí být znovu přidán jako nový zdroj.
15. Kapsle a obalový materiál se sledují kusově. U sypké směsi se neeviduje hmotnost ani zbytkové množství.

## 2. Rozsah

### Zahrnuto
Příjem a identifikace packů, počáteční hmotnost, lot a expirace; QR generování, tisk a opakovaný tisk; sken a detail packu; přiřazení do výroby, použití, otevření, potvrzení vyprázdnění; přesuny A1–D10; kmenové suroviny, produkty a verzované receptury; výrobní plány, operace, polotovary; obalový materiál, balení, volitelné etiketování a hotové výrobky; částečné předání více výrobků a šarží; uživatelé, role, ochrana před dvojím odesláním, audit, zálohy.

### Výslovně nezahrnuto
Aktuální nebo zbytková hmotnost raw packu; automatický výpočet přesné spotřeby hmotnosti; hmotnostní bilance sypké směsi; nákupní objednávky, dodavatelská agenda, účetnictví, doprava a sledování zásilek; externí QR API, externí databáze, Node.js/AWS nebo placený hosting pro produkční backend.

> Systém dokládá konkrétní packy a šarže přiřazené k plánu, otevření, přesuny a potvrzené vyprázdnění. Nedokládá, kolik gramů bylo spotřebováno.

## 3. Výrobní cesty

- **Přímé plnění:** SKLAD_SUROVIN (Pack_ID) → PLAN_BALENI → spotřeba obalu → SKLAD_HOTOVYCH_VYROBKU → případná etiketa → PREDANI_EXPEDICI.
- **Kapslování jedné suroviny:** packy → PLAN_VYROBY → KAPSLOVANI → KAPSLE_NEZABALENE → balení → hotový výrobek → případná etiketa → předání.
- **Receptura a přímé balení:** DB_RECEPTURY + konkrétní packy → potvrzení míchání → SYPKA_SMES → přímé balení → hotový výrobek → etiketa/předání.
- **Receptura a kapslování:** receptura + konkrétní packy → míchání → SYPKA_SMES → kapslování → KAPSLE_NEZABALENE → balení → etiketa/předání.

Plánování samo nesnižuje sklad a nemění NOVY na OTEVRENY. Při skutečném použití se uloží vazba na výrobní plán a při prvním použití se nastaví OTEVRENY/Opened_At. Obsluha musí před potvrzením fyzicky ověřit dostatek materiálu; systém nesmí předstírat automatickou kontrolu zbytkové hmotnosti. Míchání uloží všechny Pack_ID a vytvoří dohledatelný polotovar bez hmotnostní bilance. Počet kapslí, materiálů a balení je kusová evidence. Částečné etiketování/předání dělí zásobu do samostatných stavových řádků.

## 4. QR integrace

### 4.1 Payload a stabilita

Příklad deeplinku: https://script.google.com/macros/s/DEPLOYMENT_ID/exec?view=pack&id=P-26-000123

QR obsahuje jen deeplink a Pack_ID. Neobsahuje stav, box, pozici, počáteční hmotnost ani osobní údaje. CONFIG.APP_BASE_URL musí být skutečná produkční URL končící /exec; /dev je nepřípustná. Standardní vydání aktualizuje existující deployment. Změna URL je migrační událost, která vyžaduje přesměrování nebo plán přetisku.

### 4.2 Příjem a tisk

1. Obsluha zadá surovinu, Lot, expiraci MM/YY, počáteční hmotnost/jednotku, počáteční box a pozici.
2. Backend ověří roli a vstupy, získá LockService, přidělí jedinečné Pack_ID, zapíše pack a audit.
3. Backend vrátí ID a QR payload; browser lokálně vykreslí QR.
4. Tisk se audituje jako PRINT_REQUESTED; opakovaný tisk jako REPRINT_REQUESTED. Prohlížeč nemůže garantovat, že tiskárna štítek fyzicky vytiskla.
5. Opakovaný tisk nikdy nezaloží nový pack; ID ani deeplink se nezmění.

### 4.3 Fyzický štítek

Výchozí formát 50 × 30 mm, alternativa 60 × 40 mm. Černobílý, vysoký kontrast: QR, velké Pack_ID, krátký název suroviny, Lot a expirace MM/YY. Aktuální box a pozice se netisknou. QR musí mít volný okraj a musí se fyzicky testovat na cílové tiskárně a telefonech.

### 4.4 Offline generování a sken

QR se generuje lokálně z knihovny uložené přímo v Apps Script projektu a připnuté na konkrétní verzi/licenci. Za provozu se nepoužívá veřejný QR endpoint ani CDN. Nativní fotoaparát telefonu otevře deeplink. Vnitřní skener je volitelný až po skutečném testu; ruční vyhledávání Pack_ID zůstává fallback. Samotné otevření QR nikdy nezmění sklad; každá změna vyžaduje explicitní potvrzení.

## 5. Architektura a bezpečnost

Prohlížeč → google.script.run → Apps Script API/validace → služby → SheetRepository → Google Sheets.

Stabilní ID jsou interní vazby, ne čísla řádků. SKLAD_SUROVIN je jediný zdroj pravdy pro raw packy; FRONTEND_SKLAD je pouze read-only pohled. Všechny kritické operace opětovně načtou aktuální stav. Cache je dovolena jen pro kmenová/pomocná data.

Role v DB_UZIVATELE: ADMIN, VEDOUCI, SKLAD, VYROBA, READONLY. Backend kontroluje identitu a roli při každém API volání. Google Apps Script musí běžet v přístupovém režimu, kde lze identitu spolehlivě ověřit. Pokud Session neposkytne e-mail, požadavek se odmítne a nasazení se nesmí otevřít anonymně.

Google Sheets nemá plnohodnotné transakce napříč listy. LockService brání souběhu mezi spolupracujícími běhy, ale neřeší částečný zápis. Operace proto ukládá Operation_ID, idempotency key, hash payloadu a stav; RECOVERY_REQUIRED vyžaduje autorizované zotavení/kompenzaci.

## 6. Přesné schéma Google Sheets

První řádek listu musí odpovídat hlavičkám přesně. ID, Lot, Box_Number a Expirace_MMYY jsou text. Časy se zobrazují podle Europe/Prague.

| List | Hlavičky v pořadí |
|---|---|
| CONFIG | Key, Value |
| DB_UZIVATELE | Email, Role, Aktivni, Created_At, Updated_At |
| ID_COUNTERS | Entity_Type, Year_YY, Last_Sequence, Updated_At |
| DB_SUROVINY | Surovina_ID, Nazev_Suroviny, Aktivni, Created_At, Updated_At |
| DB_POZICE | Pozice_ID, Pozice, Aktivni |
| SKLAD_SUROVIN | Pack_ID, Surovina_ID, Lot, Expirace_MMYY, Pocatecni_Hmotnost, Jednotka_Hmotnosti, Stav_Packu, Box_Number, Pozice, Received_At, Opened_At, Emptied_At, Created_At, Updated_At, Created_By, Updated_By |
| FRONTEND_SKLAD | Pack_ID, Nazev_Suroviny, Lot, Expirace_MMYY, Stav_Packu, Box_Number, Pozice, Pocatecni_Hmotnost, Jednotka_Hmotnosti, Updated_At, FIFO_Upozorneni |
| DB_PRODUKTY | Produkt_ID, Nazev_Produktu, Forma_Vystupu, Typ_Vstupu, Kapsli_na_Baleni, Etiketa_Povinna, Aktivni, Created_At, Updated_At |
| DB_RECEPTURY | Receptura_ID, Nazev_Receptury, Verze, Forma_Vystupu, Aktivni, Poznamka, Created_At, Created_By |
| DB_RECEPTURY_SUROVINY | Receptura_Polozka_ID, Receptura_ID, Poradi, Surovina_ID, Poznamka |
| PLAN_VYROBY | Plan_Vyroby_ID, Cislo_Planu, Produkt_ID, Vstupni_Typ, Receptura_ID, Vyrobni_Lot, Datum_Planu, Priorita, Planovany_Pocet_Kapsli, Skutecny_Pocet_Kapsli, Stav, Datum_Zahajeni, Datum_Dokonceni, Operator, Poznamka, Created_At, Updated_At |
| PLAN_VYROBY_SUROVINY | Plan_Polozka_ID, Plan_Vyroby_ID, Pack_ID, Role, Stav_Pouziti, Pouzito_At, Operator, Poznamka |
| PLAN_VYROBY_OPERACE | Operace_ID, Plan_Vyroby_ID, Poradi, Typ_Operace, Stav, Planovany_Zacatek, Skutecny_Zacatek, Skutecny_Konec, Operator, Pocet_Kapsli_Plan, Pocet_Kapsli_Skutecnost, Poznamka |
| SKLAD_POLOTOVARU | Polotovar_ID, Plan_Vyroby_ID, Produkt_ID, Typ_Polotovaru, Vyrobni_Lot, Pocet_Kapsli_Aktualne, Stav_Polotovaru, Box_Number, Pozice, Created_At, Updated_At, Poznamka |
| DB_BALICI_MATERIALY | Material_ID, Nazev_Materialu, Typ_Materialu, Jednotka, Aktivni, Created_At, Updated_At |
| SKLAD_BALICIHO_MATERIALU | Stock_Material_ID, Material_ID, Lot, Box_Number, Pozice, Mnozstvi_Aktualni, Jednotka, Created_At, Updated_At |
| PLAN_BALENI | Plan_Baleni_ID, Cislo_Planu, Plan_Vyroby_ID, Produkt_ID, Zdroj_Typ, Zdroj_ID, Vyrobni_Lot, Kapsli_na_Baleni, Planovany_Pocet_Baleni, Skutecny_Pocet_Baleni, Stav, Datum_Zahajeni, Datum_Dokonceni, Operator, Poznamka, Created_At, Updated_At |
| PLAN_BALENI_MATERIAL | Plan_Baleni_Polozka_ID, Plan_Baleni_ID, Material_ID, Stock_Material_ID, Mnozstvi_Plan, Mnozstvi_Skutecnost, Jednotka, Poznamka |
| SKLAD_HOTOVYCH_VYROBKU | Hotovy_Stock_ID, Plan_Baleni_ID, Produkt_ID, Vyrobni_Lot, Pocet_Baleni_Aktualne, Stav_Zpracovani, Box_Number, Pozice, Created_At, Updated_At |
| PLAN_ETYKETOVANI | Plan_Etiketovani_ID, Cislo_Planu, Plan_Baleni_ID, Hotovy_Stock_ID, Produkt_ID, Vyrobni_Lot, Pocet_Kusu_Plan, Pocet_Kusu_Skutecnost, Stav, Datum_Zahajeni, Datum_Dokonceni, Operator, Poznamka, Created_At, Updated_At |
| PLAN_ETYKETOVANI_MATERIAL | Plan_Etiketovani_Polozka_ID, Plan_Etiketovani_ID, Material_ID, Stock_Material_ID, Mnozstvi_Plan, Mnozstvi_Skutecnost, Jednotka |
| PREDANI_EXPEDICI | Predani_ID, Timestamp, Predal, Prevzal, Reference_Expedice, Poznamka |
| PREDANI_EXPEDICI_POLOZKY | Predani_Polozka_ID, Predani_ID, Hotovy_Stock_ID, Produkt_ID, Vyrobni_Lot, Pocet_Baleni, Jednotka_Baleni, Poznamka |
| POHYBY_LOG | Movement_ID, Timestamp, Entita_Typ, Entita_ID, Action, Delta_Mnozstvi, Jednotka, From_Box_Number, From_Position, To_Box_Number, To_Position, Reference_Type, Reference_ID, Operation_ID, User, Note |
| QR_LABEL_LOG | Label_Event_ID, Timestamp, Pack_ID, Action, Payload_Mode, Payload_Version, App_Base_URL, Label_Format, User, Note |
| OPERATIONS_LOG | Operation_ID, Idempotency_Key, Operation_Type, Entity_ID, Requested_By, Started_At, Completed_At, Status, Payload_Hash, Error_Code, Error_Message |

## 7. Stavové přechody a význam

- Raw pack: NOVY → OTEVRENY → VYPRAZDNENY. Přesun stav nemění. Otevření pouze při prvním skutečném použití; vyprázdnění je konečný stav potvrzený obsluhou.
- Výrobní plán: NAPLANOVANO → PRIPRAVENO → PROBIHA → DOKONCENO; PROBIHA může přejít do POZASTAVENO a pokračovat, z otevřených stavů může následovat ZRUSENO. Dokončený plán se běžně znovu neotevírá.
- Operace: NAVAZENI, MICHANI, KAPSLOVANI, KONTROLA. Probíhá vždy jen jedna operace v pořadí. KAPSLOVANI se v UI zobrazuje jako „Kapslování“.
- Polotovar: PRIPRAVEN → OTEVRENY → SPOTREBOVANY. U SYPKA_SMES potvrzuje spotřebování obsluha; u KAPSLE_NEZABALENE se sleduje počet kapslí.
- Hotový výrobek: CEKA_ETYKETU → PRIPRAVENO_K_PREDANI → PREDANO_EXPEDICI. Pokud etiketa není povinná, může balení přejít přímo do PRIPRAVENO_K_PREDANI.
- ID: pack P-26-000001; výrobní plán VY-26-000001; plán balení PB-26-000001. Mezera v sekvenci je přijatelná, opětovné použití ID nikoli. Při obnově zálohy se čítač porovná s existujícími ID a při zaostávání se zápis zablokuje.

## 8. FIFO a expirace

FIFO je upozornění, nikoli automatický výběr. Porovnávají se pouze nevyprázdněné packy stejné suroviny. Expirace MM/YY se ukládá jako text a porovnává přes klíč YY × 12 + MM. Chybějící nebo vadná expirace znamená „nelze porovnat“, bez hádání data.

## 9. Operace API a bezpečný zápis

Každá kritická operace: ověří uživatele/roli; získá ScriptLock s konečným timeoutem; ověří idempotency key a hash payloadu; znovu načte aktuální stav; zapíše OPERATIONS_LOG STARTED; provede dávkové změny; přidá všechny auditní události se stejným Operation_ID; ověří výsledek a označí COMPLETED. Při částečném selhání označí FAILED nebo RECOVERY_REQUIRED. Opakování klíče s jiným payloadem se odmítne.

Použití raw packu loguje OTEVRENI_PACKU/POUZITI_PACKU bez hmotnostního Delta_Mnozstvi. Přesun loguje původní a cílové umístění. Tisk není skladový pohyb. Operace předání podporuje více produktů a šarží a částečná množství; zbytková zásoba zůstává v odděleném řádku.

## 10. Obrazovky

1. Dashboard: stavy packů, výrobní plány podle stavu, čekající etikety, hotové zásoby připravené k předání, expirace.
2. Příjem packu: surovina, Lot, expirace, počáteční hmotnost/jednotka, box/pozice, ID a QR.
3. Sklad surovin: hledání podle Pack_ID, suroviny, Lot, expirace, box, pozice a stavu.
4. Detail packu: Pack_ID, QR, surovina/Lot/expirace/počáteční hmotnost, aktuální umístění/stav, auditní historie a použité výrobní plány.
5. Skenování: nativní QR deeplink, volitelná kamera uvnitř aplikace a ruční ID.
6. Přesun packu: původní/cílové umístění, explicitní potvrzení a audit.
7. Výrobní plány a operace, receptury a neměnné verze, polotovary, sklad obalů, balení, etiketování, hotové výrobky, předání expedici.
8. Historie pro POHYBY_LOG, QR_LABEL_LOG a OPERATIONS_LOG.
9. Kmenová data a nastavení: suroviny, produkty, receptury, materiály, pozice, uživatelé, APP_BASE_URL.

## 11. Nasazení

1. Vytvořit cílový Google Sheet a Apps Script projekt.
2. Spustit neinvazivní inicializaci listů/hlaviček; existující data se nemažou.
3. Prvního správce vytvořit ručně v Apps Script editoru, přidat uživatele do DB_UZIVATELE.
4. Nasadit web app s omezeným přístupem a ověřit Session.getActiveUser().getEmail() pro každý typ cílového účtu.
5. Nastavit produkční APP_BASE_URL končící /exec. Ověřit, že nové vydání aktualizuje existující deployment.
6. Vyzkoušet pack, tisk štítku, nativní sken, přesun a potvrdit, že tentýž QR otevírá aktuální pozici.
7. Testovat všechny čtyři výrobní cesty, částečné etiketování/předání, role, souběh, idempotenci, selhání, zálohu a obnovení.
8. Nikdy nepovolovat anonymní přístup k privátním skladovým datům. Pokud identita není dostupná, nasazení není připraveno.

## 12. Akceptační testy

- Každý příjem vytvoří jediné jedinečné Pack_ID a stabilní QR na /exec; chybné URL blokuje příjem.
- Sken pouze čte. Přesun/otevření/vyprázdnění vyžaduje explicitní akci a audit.
- Opakovaný tisk zachová Pack_ID; přesun mění aktuální pozici, nikoli QR.
- Plánované použití nemění stav packu; skutečné použití nastaví OTEVRENY a vyplní Opened_At jen jednou.
- VYPRAZDNENY pack nelze znovu použít. Žádná obrazovka ani API nevypočítává zbytkovou/spotřebovanou hmotnost.
- Receptura zachovává verzi a konkrétní packy; směs se eviduje bez hmotnostní bilance; kapsle jako celé kusy.
- Nedostatek obalů/etiket/kapslí blokuje dokončení. Etiketování neodečítá hotová balení dvakrát.
- Povinnou etiketu nelze přeskočit. Částečné etiketování/předání oddělí množství do samostatných řádků.
- Předání podporuje více produktů a lotů, odečte pouze potvrzené celé balíky a zbytek zachová.
- Dvojité kliknutí a opakovaný idempotency key nezpůsobí duplicitní změnu; jiný payload se stejným klíčem se odmítne.
- Souběžní uživatelé nemohou přepsat umístění podle zastaralého stavu.
- Částečné vícelistové selhání je dohledatelné a obnovitelné; auditní listy zůstávají append-only.
- Obnova zálohy je prakticky testována a ID_COUNTERS odpovídají existujícím ID.
- Fyzický štítek 50×30/60×40 mm je vytištěn a naskenován na cílových zařízeních.

## 13. Fázování

Fáze 1: schema, autentizace, ID, audit, příjem, přesun, použití a vyprázdnění.
Fáze 2: lokální QR, tisk, opakovaný tisk, nativní sken a ruční fallback.
Fáze 3: produkty/receptury, výrobní plány, operace, polotovary.
Fáze 4: obaly, balení, etikety, částečné hotové zásoby, předání.
Fáze 5: idempotence, obnova po selhání, zálohy, souběžné, mobilní a tiskové testy.

**Definice hotovo:** každý pack má jedinečné ID a funkční QR, sken otevře aktuální detail bez změny skladu, životní cyklus a umístění mají audit, aplikace nepředstírá hmotnostní bilanci a všechny výrobní/obalové/etiketovací/předávací kroky jsou dohledatelné; identita, nasazení a obnova jsou ověřeny v reálném Google účtu.
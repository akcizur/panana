# Panana — sklad a výroba

Panana má dvě oddělené části. **Produkční implementace v2** je Google Sheets + Google Apps Script. Původní React/Vite aplikace v kořeni repozitáře zůstává pouze jako vizuální demo/prototyp a není autoritativním zdrojem provozních dat.

## Produkční aplikace

- [Produkční specifikace v2](docs/PRODUCTION-SPEC-V2.md) — požadavky, přesná schémata všech listů, stavy, QR, audit a akceptační testy.
- [Stav implementace a blokery před produkcí](docs/IMPLEMENTATION-STATUS.md)
- [Projektový chat log](docs/CHAT-LOG.md) — dohledatelné požadavky a rozhodnutí.
- [Nasazení Apps Script](apps-script/README.md)

Produkční backend nevyžaduje Vercel, Convex, Clerk, externí server, externí QR API ani placený hosting. Pro provoz používá Google Sheets a autorizovaný Apps Script web deployment.

## Zásadní bezpečnostní upozornění

**Nevkládejte reálné skladové údaje do veřejného GitHub Pages dema.** Původní Vite aplikace je klientská ukázka a její role/demo stavy nejsou bezpečnostní hranicí. Produkční přístup kontroluje identitu a roli na Apps Script serveru. Pokud Google neposkytne ověřenou identitu, API musí požadavek odmítnout.

Zdroj v GitHubu se sám nepovažuje za live deployment. Produkční nasazení vyžaduje Google Sheet, autorizaci, nastavené uživatele, omezené sdílení a ověřené testy v reálném Google účtu.

## Lokální Vite preview

Požadavky: Node.js 22 a pnpm.

<pre><code>pnpm install
pnpm dev
pnpm typecheck
pnpm build</code></pre>

GitHub Pages workflow zůstává pouze pro preview. Není to server Apps Scriptu a nesynchronizuje skladová data.

## Produkční zdrojový kód

Soubory v <code>apps-script/</code> obsahují serverové služby, HTML partials a lokálně přibalený QR generátor. CI kontroluje syntaxi Apps Scriptu a JavaScriptu; kontrola syntaktické správnosti sama o sobě necertifikuje Google oprávnění, reálný tisk ani chování při částečném selhání Sheets.

# SKLAD/VÝROBA · Retro Edition 1.6.0

Skladová a výrobní demo aplikace v černobílém retro-industrial stylu s oranžovým akcentem.

## Opravy ve verzi 1.6.0

- Přidána přihlašovací obrazovka s demo účty, kontrolou přihlašovacích údajů, chybovou hláškou a odhlášením.
- Role se načte ze session a nelze ji přepínat volným selectem v navigaci nebo nastavení.
- Hmotnosti packů, příjem, detaily a pohyby jsou konzistentně v gramech. Seed hodnoty byly převedeny z kg na g; například 20 kg → 20 000 g.
- Nastavení konfigurace lze uložit pouze v rolích ADMIN a VEDOUCI; ostatní role nemají odkaz na nastavení.
- Zvětšené popisky a ovládací prvky, přehlednější tabulky a responzivní přihlášení.
- Přidána česká metadata, vlastní favicon a příkazy pro typecheck.

## Spuštění

Vyžaduje Node.js 22 a pnpm:

```bash
pnpm install
pnpm dev
```

Kontrola a produkční build:

```bash
pnpm typecheck
pnpm build
pnpm preview
```

## Demo přístupy

Na přihlašovací obrazovce otevři „Zobrazit demo účty“ a vyber roli. Přihlašovací údaje jsou pouze demonstrační.

| Role | E-mail | Heslo |
| --- | --- | --- |
| ADMIN | `admin@sklad.local` | `Retro2026!` |
| VEDOUCI | `vedouci@sklad.local` | `Vedouci2026!` |
| SKLAD | `sklad@sklad.local` | `Sklad2026!` |
| VYROBA | `vyroba@sklad.local` | `Vyroba2026!` |
| READONLY | `host@sklad.local` | `Demo2026!` |

## Bezpečnostní upozornění

Přihlášení je klientská demo funkce, nikoli zabezpečení. Hesla jsou součástí klientského kódu a lze je obejít. Pro produkční provoz je nutné použít backend, serverovou autorizaci, bezpečné ukládání hesel, session cookies a trvalé úložiště.

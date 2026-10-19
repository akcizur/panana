import { useEffect, useState, type FormEvent } from "react";
import { ROLE_USERS, StoreProvider, useStore, type Perm, type Role } from "./store";
import { Baleni, Historie, Hotove, Nastaveni, Vyroba } from "./screens2";
import { Dashboard, Detail, Prijem, Scan, Sklad } from "./screens1";

type Theme = "light" | "dark";
type NavEntry = { path: string; number: string; label: string; permission?: Perm | "config" };
const NAV: NavEntry[] = [
  { path: "#/", number: "01", label: "Přehled" },
  { path: "#/prijem", number: "02", label: "Příjem packu", permission: "sklad" },
  { path: "#/sklad", number: "03", label: "Sklad surovin", permission: "sklad" },
  { path: "#/scan", number: "05", label: "Skenovat pack", permission: "sklad" },
  { path: "#/vyroba", number: "06", label: "Výroba", permission: "vyroba" },
  { path: "#/baleni", number: "07", label: "Balení", permission: "vyroba" },
  { path: "#/hotove", number: "08", label: "Hotové výrobky", permission: "expedice" },
  { path: "#/historie", number: "09", label: "Historie" },
  { path: "#/nastaveni", number: "10", label: "Nastavení", permission: "config" },
];

const DEMO_ACCOUNTS: { role: Role; email: string; password: string }[] = [
  { role: "ADMIN", email: "admin@sklad.local", password: "Retro2026!" },
  { role: "VEDOUCI", email: "vedouci@sklad.local", password: "Vedouci2026!" },
  { role: "SKLAD", email: "sklad@sklad.local", password: "Sklad2026!" },
  { role: "VYROBA", email: "vyroba@sklad.local", password: "Vyroba2026!" },
  { role: "READONLY", email: "host@sklad.local", password: "Demo2026!" },
];

function isRole(value: string | null): value is Role {
  return !!value && Object.prototype.hasOwnProperty.call(ROLE_USERS, value);
}
function getSessionRole(): Role | null {
  try {
    const role = typeof window !== "undefined" ? window.sessionStorage.getItem("sklad-auth-role") : null;
    return isRole(role) ? role : null;
  } catch { return null; }
}

function ThemeToggle({ theme, onToggle, className = "" }: { theme: Theme; onToggle: () => void; className?: string }) {
  const nextLabel = theme === "light" ? "Zapnout tmavý režim" : "Zapnout světlý režim";
  return <button type="button" className={`theme-toggle ${className}`} onClick={onToggle} aria-label={nextLabel} title={nextLabel} aria-pressed={theme === "dark"}><span className="theme-toggle-icon" aria-hidden="true">{theme === "light" ? "☾" : "☀"}</span><span className="theme-toggle-label">{theme === "light" ? "Tmavý režim" : "Světlý režim"}</span></button>;
}

function LoginScreen({ onLogin, theme, onToggleTheme }: { onLogin: (role: Role) => void; theme: Theme; onToggleTheme: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showAccounts, setShowAccounts] = useState(false);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const found = DEMO_ACCOUNTS.find((item) => item.email === email.trim().toLowerCase() && item.password === password);
    if (!found) {
      setError("Přihlášení se nezdařilo. Zkontrolujte e-mail a heslo.");
      return;
    }
    setError("");
    onLogin(found.role);
  };

  return (
    <main className="auth-shell" data-theme={theme}>
      <div className="auth-grain" aria-hidden="true" />
      <ThemeToggle theme={theme} onToggle={onToggleTheme} className="auth-theme-toggle" />
      <section className="auth-layout">
        <div className="auth-intro">
          <div className="brand-mark"><span>SKLAD</span><b>/</b><span>VÝROBA</span><i>®</i></div>
          <div className="auth-edition"><span className="status-dot" /> RETRO WORKSPACE · EDITION 1.6</div>
          <h1>Pořádek<br />v každém<br /><em>gramu.</em></h1>
          <p>Jedno místo pro suroviny, šarže, QR štítky a výrobní proces. Přehledně, přesně a bez zbytečných kliků.</p>
          <div className="auth-stamp"><span>HMOTNOST</span><strong>VŽDY V g</strong><small>JEDNOTNÁ EVIDENCE</small></div>
          <div className="auth-coordinate mono">SKLAD / CZ · DEMO PROSTŘEDÍ · 01—10</div>
        </div>
        <div className="auth-card">
          <div className="auth-card-top"><span>01 / IDENTIFIKACE UŽIVATELE</span><span>DEMO AUTH ●</span></div>
          <div className="auth-card-body">
            <div className="auth-icon" aria-hidden="true">↗</div>
            <h2>Přihlášení</h2>
            <p className="auth-subtitle">Přihlaste se demo účtem a pokračujte do provozního přehledu.</p>
            <form onSubmit={submit} className="auth-form">
              <label className="auth-field"><span>E-mail</span><input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jmeno@sklad.local" /></label>
              <label className="auth-field"><span>Heslo</span><input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Zadejte demo heslo" /></label>
              {error && <div className="auth-error" role="alert">{error}</div>}
              <button className="auth-submit" type="submit"><span>Přihlásit se</span><b>↗</b></button>
            </form>
            <button type="button" className="demo-toggle" aria-expanded={showAccounts} onClick={() => setShowAccounts((value) => !value)}>
              <span>{showAccounts ? "−" : "+"}</span> Zobrazit demo účty <small>{showAccounts ? "SKRÝT" : "5 ÚČTŮ"}</small>
            </button>
            {showAccounts && <div className="demo-account-list">
              {DEMO_ACCOUNTS.map((account) => <button type="button" key={account.role} className="demo-account" onClick={() => { setEmail(account.email); setPassword(account.password); setError(""); }}>
                <span className="demo-role">{account.role}</span><span className="demo-identity">{ROLE_USERS[account.role]}<small>{account.email}</small></span><span className="demo-fill">VYPLNIT ↗</span>
              </button>)}
              <p className="demo-password-note">Kliknutím se vyplní přihlašovací údaje vybrané role.</p>
            </div>}
            <div className="auth-disclaimer"><b>DEMO REŽIM</b><span>Přihlášení je pouze ukázkové a ověřuje se v prohlížeči. Nechrání produkční ani citlivá data.</span></div>
          </div>
          <div className="auth-card-foot"><span>SESSION · TEMPORARY</span><span>SERVER AUTH: NOT CONNECTED</span></div>
        </div>
      </section>
    </main>
  );
}

function useHash() {
  const read = () => {
    const query = new URLSearchParams(window.location.search);
    if (query.get("view") === "pack" && query.get("id") && !window.location.hash) return `#/pack/${query.get("id")}`;
    return window.location.hash || "#/";
  };
  const [hash, setHash] = useState(read);
  useEffect(() => {
    const update = () => { setHash(read()); window.scrollTo(0, 0); };
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);
  return hash;
}

function Shell({ onLogout, theme, onToggleTheme }: { onLogout: () => void; theme: Theme; onToggleTheme: () => void }) {
  const { s, can } = useStore();
  const hash = useHash();
  const route = hash.replace(/^#/, "");
  const active = route.startsWith("/pack/") ? "#/sklad" : NAV.find((item) => item.path !== "#/" && hash.startsWith(item.path))?.path ?? "#/";
  const canSeeNav = (item: NavEntry) => {
    if (!item.permission) return true;
    if (item.permission === "config") return s.role === "ADMIN" || s.role === "VEDOUCI";
    return can(item.permission);
  };

  let page;
  const routePermission: Perm | "config" | null =
    route.startsWith("/pack/") || route.startsWith("/prijem") || route.startsWith("/sklad") || route.startsWith("/scan") ? "sklad" :
    route.startsWith("/vyroba") || route.startsWith("/baleni") ? "vyroba" :
    route.startsWith("/hotove") ? "expedice" :
    route.startsWith("/nastaveni") ? "config" : null;
  const permitted = routePermission === null || (routePermission === "config"
    ? s.role === "ADMIN" || s.role === "VEDOUCI"
    : can(routePermission));

  if (!permitted) {
    page = <section className="access-denied panel"><div className="access-denied-mark">!</div><h1>Přístup není povolen</h1><p>Účet <strong>{s.role}</strong> nemá oprávnění otevřít tuto část aplikace.</p><a className="btn btn-primary" href="#/">Zpět na přehled</a></section>;
  } else if (route.startsWith("/pack/")) page = <Detail id={decodeURIComponent(route.slice(6))} />;
  else if (route.startsWith("/prijem")) page = <Prijem />;
  else if (route.startsWith("/sklad")) page = <Sklad />;
  else if (route.startsWith("/scan")) page = <Scan />;
  else if (route.startsWith("/vyroba")) page = <Vyroba />;
  else if (route.startsWith("/baleni")) page = <Baleni />;
  else if (route.startsWith("/hotove")) page = <Hotove />;
  else if (route.startsWith("/historie")) page = <Historie />;
  else if (route.startsWith("/nastaveni")) page = <Nastaveni />;
  else page = <Dashboard />;

  return <div className="app-shell grid min-h-screen lg:grid-cols-[256px_minmax(0,1fr)]" data-theme={theme}>
    <aside className="sidebar bg-ink text-stock lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto">
      <div className="sidebar-brand px-[18px] py-4">
        <div className="brand-mark brand-mark-small"><span>SKLAD</span><b>/</b><span>VÝROBA</span></div>
        <div className="sidebar-sub mono mt-1 tracking-widest uppercase">Pack · QR · šarže</div>
        <div className="sidebar-status"><span className="status-dot" /> DEMO / RELACE AKTIVNÍ</div>
      </div>
      <nav className="nav flex overflow-x-auto py-1 lg:block lg:py-3" aria-label="Hlavní navigace">
        {NAV.filter(canSeeNav).map((item) => <a key={item.path} href={item.path} aria-current={active === item.path ? "page" : undefined} className="shrink-0"><span>{item.number}</span>{item.label}</a>)}
      </nav>
      <div className="sidebar-bottom hidden p-[18px] lg:block">
        <div className="sidebar-bottom-label mono mb-2 tracking-widest uppercase">Systémový stav</div>
        <div className="sidebar-system"><span className="status-dot" /><span>Lokální demo data</span><b>ONLINE</b></div>
        <div className="sidebar-version mono mt-3">RETRO / UI 1.6.0</div>
      </div>
    </aside>
    <main className="main-area min-w-0 px-4 py-4 sm:px-6 lg:px-8 lg:py-6">
      <div className="mx-auto max-w-[1360px]">
        <div className="account-bar">
          <div className="workspace-label"><span className="workspace-symbol">✳</span><div><strong>PROVOZNÍ PŘEHLED</strong><small>INTERNÍ SKLADOVÝ SYSTÉM</small></div></div>
          <div className="account-controls"><div className="account-avatar">{s.user.split(" ").map((part) => part[0]).slice(0, 2).join("")}</div><div className="account-label"><strong>{s.user}</strong><span>{s.role}</span></div><ThemeToggle theme={theme} onToggle={onToggleTheme} /><button onClick={onLogout} className="logout-button"><span>Odhlásit</span><b>↗</b></button></div>
        </div>
        {page}
        <footer className="app-footer mono mt-12 border-t border-line pt-4 uppercase"><span>Demo s lokálními daty · QR se generuje v prohlížeči</span><span>Hmotnost vždy v gramech (g) · Účet: {s.role}</span></footer>
      </div>
    </main>
  </div>;
}

function AuthGate() {
  const { setRole } = useStore();
  const [authenticatedRole, setAuthenticatedRole] = useState<Role | null>(getSessionRole);
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      const saved = window.localStorage.getItem("panana-theme");
      return saved === "dark" || saved === "light" ? saved : "light";
    } catch { return "light"; }
  });
  const toggleTheme = () => setTheme((current) => {
    const next: Theme = current === "light" ? "dark" : "light";
    try { window.localStorage.setItem("panana-theme", next); } catch { /* local storage is optional */ }
    return next;
  });
  const login = (role: Role) => {
    setRole(role);
    try { window.sessionStorage.setItem("sklad-auth-role", role); } catch { /* session storage is optional */ }
    setAuthenticatedRole(role);
  };
  const logout = () => {
    try { window.sessionStorage.removeItem("sklad-auth-role"); } catch { /* session storage is optional */ }
    setAuthenticatedRole(null);
    window.location.hash = "#/";
    window.scrollTo(0, 0);
  };
  return authenticatedRole ? <Shell onLogout={logout} theme={theme} onToggleTheme={toggleTheme} /> : <LoginScreen onLogin={login} theme={theme} onToggleTheme={toggleTheme} />;
}

export default function App() {
  return <StoreProvider><AuthGate /></StoreProvider>;
}

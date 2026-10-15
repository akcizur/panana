import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";

export type Role = "ADMIN" | "VEDOUCI" | "SKLAD" | "VYROBA" | "READONLY";
export type PackStav = "NOVY" | "OTEVRENY" | "VYPRAZDNENY";
export type PlanStav = "NAPLANOVANO" | "PRIPRAVENO" | "PROBIHA" | "POZASTAVENO" | "DOKONCENO" | "ZRUSENO";
export type HotovyStav = "CEKA_ETYKETU" | "PRIPRAVENO_K_PREDANI" | "PREDANO_EXPEDICI";
export type PolStav = "PRIPRAVEN" | "OTEVRENY" | "SPOTREBOVANY";

export interface Surovina { id: string; nazev: string }
export interface Pack {
  id: string; surovinaId: string; lot: string; exp: string; hm: number; jed: "g";
  stav: PackStav; box: string; poz: string;
  receivedAt: string; openedAt?: string; emptiedAt?: string;
}
export interface Produkt {
  id: string; nazev: string; forma: "SYPKA" | "KAPSLE"; vstup: "JEDNA_SUROVINA" | "RECEPTURA";
  kapsliNaBaleni?: number; etiketaPovinna: boolean; recepturaId?: string; surovinaId?: string;
  mats: { materialId: string; naBaleni: number }[]; etiketaMat?: string;
}
export interface Receptura { id: string; nazev: string; verze: number; forma: "SYPKA" | "KAPSLE"; surovinaIds: string[]; poznamka: string }
export interface Material { id: string; nazev: string; typ: string; jednotka: string; mnozstvi: number; lot: string; box: string; poz: string }
export interface Plan {
  id: string; cislo: string; produktId: string; recepturaId?: string; lot: string; datum: string;
  stav: PlanStav; planKapsli?: number; skutKapsli?: number; operator: string; zahajeni?: string; dokonceni?: string;
}
export interface PlanPack { planId: string; packId: string; role: "VSTUP_PRIMY" | "SLOZKA_RECEPTURY"; stav: "PLANOVANO" | "POUZITO" | "NEPOUZITO"; pouzitoAt?: string }
export interface Polotovar {
  id: string; planId: string; produktId: string; typ: "SYPKA_SMES" | "KAPSLE_NEZABALENE"; lot: string;
  kapsli?: number; stav: PolStav; box: string; poz: string; createdAt: string;
}
export interface PlanBaleni {
  id: string; cislo: string; planVyrobyId?: string; produktId: string; zdrojTyp: "PACK_SUROVINA" | "POLOTOVAR"; zdrojId: string;
  lot: string; kapsliNaBaleni?: number; planPocet: number; skutPocet?: number; stav: PlanStav; operator: string; dokonceni?: string;
}
export interface Hotovy { id: string; planBaleniId: string; produktId: string; lot: string; pocet: number; stav: HotovyStav; box: string; poz: string; updatedAt: string }
export interface Predani { id: string; ts: string; predal: string; prevzal: string; ref: string; polozky: { produktId: string; lot: string; pocet: number }[] }
export interface Movement {
  id: string; ts: string; entita: string; entitaId: string; action: string; delta?: number; jednotka?: string;
  from?: string; to?: string; refType?: string; refId?: string; opId: string; user: string; note?: string;
}
export interface QrLog { id: string; ts: string; packId: string; action: "PRINT_REQUESTED" | "REPRINT_REQUESTED" | "LABEL_INVALIDATION_REVIEWED"; format: string; baseUrl: string; user: string }
export interface Operation { id: string; type: string; entityId: string; by: string; started: string; status: "STARTED" | "COMPLETED" | "FAILED" | "RECOVERY_REQUIRED" | "COMPENSATED"; error?: string }

interface State {
  config: Record<string, string>;
  role: Role; user: string; seq: Record<string, number>;
  suroviny: Surovina[]; packs: Pack[]; produkty: Produkt[]; receptury: Receptura[]; materialy: Material[];
  plany: Plan[]; planPacks: PlanPack[]; polotovary: Polotovar[]; baleni: PlanBaleni[]; hotove: Hotovy[]; predani: Predani[];
  movements: Movement[]; qrLog: QrLog[]; operations: Operation[];
}

export const POZICE = ["A", "B", "C", "D"].flatMap((r) => Array.from({ length: 10 }, (_, i) => `${r}${i + 1}`));
export const NOW = new Date();

export const OP_LABEL: Record<string, string> = { NAVAZENI: "Navážení", MICHANI: "Míchání", KAPSLOVANI: "Kapslování", KONTROLA: "Kontrola" };
export const STAV_LABEL: Record<string, string> = {
  NOVY: "Nový", OTEVRENY: "Otevřený", VYPRAZDNENY: "Vyprázdněný",
  NAPLANOVANO: "Naplánováno", PRIPRAVENO: "Připraveno", PROBIHA: "Probíhá", POZASTAVENO: "Pozastaveno", DOKONCENO: "Dokončeno", ZRUSENO: "Zrušeno",
  CEKA_ETYKETU: "Čeká na etiketu", PRIPRAVENO_K_PREDANI: "Připraveno k předání", PREDANO_EXPEDICI: "Předáno expedici",
  PRIPRAVEN: "Připraven", SPOTREBOVANY: "Spotřebovaný", PLANOVANO: "Plánováno", POUZITO: "Použito", NEPOUZITO: "Nepoužito",
};

export const expKey = (e: string) => {
  const m = /^(0[1-9]|1[0-2])\/(\d{2})$/.exec(e.trim());
  return m ? Number(m[2]) * 12 + Number(m[1]) : null;
};
export const nowKey = (NOW.getFullYear() % 100) * 12 + NOW.getMonth() + 1;

export function fifoWarning(p: Pack, packs: Pack[]): string {
  if (p.stav === "VYPRAZDNENY") return "";
  const k = expKey(p.exp);
  if (k === null) return "nelze porovnat";
  const older = packs
    .filter((o) => o.id !== p.id && o.surovinaId === p.surovinaId && o.stav !== "VYPRAZDNENY")
    .map((o) => ({ o, k: expKey(o.exp) }))
    .filter((x) => x.k !== null && x.k < k)
    .sort((a, b) => a.k! - b.k!);
  return older.length ? `Starší: ${older[0].o.id} (${older[0].o.exp})` : "";
}

export function validateBaseUrl(u: string): string | null {
  const v = (u || "").trim();
  if (!v.startsWith("https://script.google.com/") || !v.endsWith("/exec"))
    return "APP_BASE_URL musí být nastavena na produkční URL končící /exec.";
  return null;
}
export function buildQrPayload(packId: string, baseUrl: string): { url?: string; error?: string } {
  if (!/^P-\d{2}-\d{6}$/.test(packId.trim())) return { error: "Neplatné Pack_ID." };
  const err = validateBaseUrl(baseUrl);
  if (err) return { error: err };
  return { url: `${baseUrl.trim()}?view=pack&id=${encodeURIComponent(packId.trim())}` };
}

const iso = (s: string) => new Date(s).toISOString();

function seed(): State {
  const suroviny: Surovina[] = [
    { id: "S-01", nazev: "Hořčík bisglycinát" }, { id: "S-02", nazev: "Ashwagandha KSM-66" }, { id: "S-03", nazev: "Rhodiola rosea 3 %" },
    { id: "S-04", nazev: "L-theanin" }, { id: "S-05", nazev: "Vitamin C (kys. askorbová)" }, { id: "S-06", nazev: "Kurkumin C3" },
  ];
  const mk = (n: number, s: string, lot: string, exp: string, hm: number, stav: PackStav, box: string, poz: string, rec: string, op?: string, em?: string): Pack => ({
    id: `P-26-${String(n).padStart(6, "0")}`, surovinaId: s, lot, exp, hm, jed: "g", stav, box, poz, receivedAt: iso(rec), openedAt: op ? iso(op) : undefined, emptiedAt: em ? iso(em) : undefined,
  });
  const packs: Pack[] = [
    mk(101, "S-01", "MG-2406", "04/28", 20000, "NOVY", "B-14", "A3", "2026-09-22T08:40:00+02:00"),
    mk(102, "S-01", "MG-2406", "04/28", 20000, "NOVY", "B-14", "A4", "2026-09-22T08:44:00+02:00"),
    mk(103, "S-01", "MG-2311", "11/27", 20000, "OTEVRENY", "B-09", "A1", "2026-06-03T10:02:00+02:00", "2026-10-07T07:31:00+02:00"),
    mk(104, "S-02", "AW-2507", "07/28", 10000, "NOVY", "B-21", "B2", "2026-09-29T13:15:00+02:00"),
    mk(105, "S-02", "AW-2412", "12/27", 10000, "OTEVRENY", "B-21", "B1", "2026-04-14T09:20:00+02:00", "2026-10-02T11:05:00+02:00"),
    mk(106, "S-03", "RH-2503", "03/28", 5000, "NOVY", "B-03", "C7", "2026-08-11T14:00:00+02:00"),
    mk(107, "S-04", "LT-2509", "09/29", 5000, "NOVY", "B-03", "C8", "2026-10-01T09:48:00+02:00"),
    mk(108, "S-04", "LT-2402", "02/27", 5000, "OTEVRENY", "B-03", "C9", "2026-03-02T09:10:00+01:00", "2026-09-18T10:12:00+02:00"),
    mk(109, "S-05", "VC-2601", "01/29", 25000, "NOVY", "B-17", "D2", "2026-09-10T08:05:00+02:00"),
    mk(110, "S-06", "KC-2508", "08/27", 2000, "NOVY", "B-17", "D3", "2026-09-10T08:12:00+02:00"),
    mk(111, "S-06", "KC-2405", "05/26", 2000, "OTEVRENY", "B-17", "D4", "2025-12-01T09:00:00+01:00", "2026-02-10T08:30:00+01:00"),
    mk(112, "S-01", "MG-2201", "06/26", 20000, "VYPRAZDNENY", "B-09", "A2", "2026-01-12T09:00:00+01:00", "2026-02-02T09:00:00+01:00", "2026-09-30T15:44:00+02:00"),
    mk(113, "S-05", "VC-2512", "12/28", 25000, "NOVY", "B-17", "D1", "2026-09-10T08:02:00+02:00"),
  ];
  const produkty: Produkt[] = [
    { id: "PR-01", nazev: "Hořčík Calm, 60 kapslí", forma: "KAPSLE", vstup: "JEDNA_SUROVINA", surovinaId: "S-01", kapsliNaBaleni: 60, etiketaPovinna: true, mats: [{ materialId: "M-01", naBaleni: 1 }, { materialId: "M-02", naBaleni: 1 }], etiketaMat: "E-01" },
    { id: "PR-02", nazev: "Ashwagandha KSM-66, prášek 100 g", forma: "SYPKA", vstup: "JEDNA_SUROVINA", surovinaId: "S-02", etiketaPovinna: false, mats: [{ materialId: "M-03", naBaleni: 1 }] },
    { id: "PR-03", nazev: "Focus Blend, 60 kapslí", forma: "KAPSLE", vstup: "RECEPTURA", recepturaId: "R-01", kapsliNaBaleni: 60, etiketaPovinna: true, mats: [{ materialId: "M-01", naBaleni: 1 }, { materialId: "M-02", naBaleni: 1 }], etiketaMat: "E-02" },
    { id: "PR-04", nazev: "Immune Daily Mix, prášek 150 g", forma: "SYPKA", vstup: "RECEPTURA", recepturaId: "R-02", etiketaPovinna: false, mats: [{ materialId: "M-04", naBaleni: 1 }] },
  ];
  const receptury: Receptura[] = [
    { id: "R-01", nazev: "Focus Blend", verze: 2, forma: "KAPSLE", surovinaIds: ["S-03", "S-04", "S-05"], poznamka: "v2: přidán Vitamin C" },
    { id: "R-02", nazev: "Immune Daily Mix", verze: 1, forma: "SYPKA", surovinaIds: ["S-05", "S-06"], poznamka: "první verze" },
  ];
  const materialy: Material[] = [
    { id: "M-01", nazev: "Lahev HDPE 120 ml, bílá", typ: "LAHEV", jednotka: "ks", mnozstvi: 1200, lot: "LH-2609", box: "B-30", poz: "D8" },
    { id: "M-02", nazev: "Víčko bezpečnostní", typ: "VICKO", jednotka: "ks", mnozstvi: 1450, lot: "VC-2609", box: "B-30", poz: "D9" },
    { id: "M-03", nazev: "Doypack 100 g, matný", typ: "DOYPACK", jednotka: "ks", mnozstvi: 2400, lot: "DP-2608", box: "B-31", poz: "D6" },
    { id: "M-04", nazev: "Doypack 150 g, matný", typ: "DOYPACK", jednotka: "ks", mnozstvi: 90, lot: "DP-2608", box: "B-31", poz: "D7" },
    { id: "E-01", nazev: "Etiketa Hořčík Calm", typ: "ETIKETA", jednotka: "ks", mnozstvi: 480, lot: "ET-2610", box: "B-32", poz: "D10" },
    { id: "E-02", nazev: "Etiketa Focus Blend", typ: "ETIKETA", jednotka: "ks", mnozstvi: 300, lot: "ET-2610", box: "B-32", poz: "D10" },
  ];
  const plany: Plan[] = [
    { id: "VY-26-000014", cislo: "VY-26-000014", produktId: "PR-01", lot: "HC-261007", datum: "2026-10-07", stav: "PROBIHA", planKapsli: 4800, operator: "Tereza Nováková", zahajeni: iso("2026-10-07T07:20:00+02:00") },
    { id: "VY-26-000015", cislo: "VY-26-000015", produktId: "PR-03", recepturaId: "R-01", lot: "FB-261015", datum: "2026-10-15", stav: "NAPLANOVANO", planKapsli: 3600, operator: "" },
    { id: "VY-26-000016", cislo: "VY-26-000016", produktId: "PR-04", recepturaId: "R-02", lot: "ID-261016", datum: "2026-10-16", stav: "PRIPRAVENO", operator: "Jakub Marek" },
    { id: "VY-26-000012", cislo: "VY-26-000012", produktId: "PR-01", lot: "HC-260930", datum: "2026-09-30", stav: "DOKONCENO", planKapsli: 4500, skutKapsli: 4320, operator: "Tereza Nováková", dokonceni: iso("2026-09-30T14:10:00+02:00") },
  ];
  const planPacks: PlanPack[] = [
    { planId: "VY-26-000014", packId: "P-26-000103", role: "VSTUP_PRIMY", stav: "POUZITO", pouzitoAt: iso("2026-10-07T07:31:00+02:00") },
    { planId: "VY-26-000016", packId: "P-26-000113", role: "SLOZKA_RECEPTURY", stav: "PLANOVANO" },
    { planId: "VY-26-000016", packId: "P-26-000110", role: "SLOZKA_RECEPTURY", stav: "PLANOVANO" },
    { planId: "VY-26-000012", packId: "P-26-000112", role: "VSTUP_PRIMY", stav: "POUZITO", pouzitoAt: iso("2026-09-30T08:02:00+02:00") },
  ];
  const polotovary: Polotovar[] = [
    { id: "PT-26-000007", planId: "VY-26-000012", produktId: "PR-01", typ: "KAPSLE_NEZABALENE", lot: "HC-260930", kapsli: 4320, stav: "PRIPRAVEN", box: "B-08", poz: "C4", createdAt: iso("2026-09-30T14:10:00+02:00") },
    { id: "PT-26-000008", planId: "VY-26-000011", produktId: "PR-04", typ: "SYPKA_SMES", lot: "ID-260922", stav: "OTEVRENY", box: "B-08", poz: "C5", createdAt: iso("2026-09-22T11:30:00+02:00") },
  ];
  const baleni: PlanBaleni[] = [
    { id: "PB-26-000021", cislo: "PB-26-000021", produktId: "PR-02", zdrojTyp: "PACK_SUROVINA", zdrojId: "P-26-000105", lot: "AW-261002", planPocet: 120, skutPocet: 120, stav: "DOKONCENO", operator: "Jakub Marek", dokonceni: iso("2026-10-02T15:40:00+02:00") },
    { id: "PB-26-000022", cislo: "PB-26-000022", produktId: "PR-01", zdrojTyp: "POLOTOVAR", zdrojId: "PT-26-000007", lot: "HC-260930", kapsliNaBaleni: 60, planPocet: 36, skutPocet: 36, stav: "DOKONCENO", operator: "Tereza Nováková", dokonceni: iso("2026-10-08T13:25:00+02:00") },
    { id: "PB-26-000023", cislo: "PB-26-000023", produktId: "PR-01", zdrojTyp: "POLOTOVAR", zdrojId: "PT-26-000007", lot: "HC-260930", kapsliNaBaleni: 60, planPocet: 40, stav: "NAPLANOVANO", operator: "" },
  ];
  const hotove: Hotovy[] = [
    { id: "HV-26-000009", planBaleniId: "PB-26-000021", produktId: "PR-02", lot: "AW-261002", pocet: 120, stav: "PRIPRAVENO_K_PREDANI", box: "B-40", poz: "A1", updatedAt: iso("2026-10-02T15:40:00+02:00") },
    { id: "HV-26-000010", planBaleniId: "PB-26-000022", produktId: "PR-01", lot: "HC-260930", pocet: 36, stav: "CEKA_ETYKETU", box: "B-40", poz: "A2", updatedAt: iso("2026-10-08T13:25:00+02:00") },
  ];
  const op = (n: number, type: string, ent: string, who: string, ts: string): Operation => ({ id: `op-${n}`, type, entityId: ent, by: who, started: iso(ts), status: "COMPLETED" });
  const mv = (n: number, ts: string, ent: string, id: string, action: string, who: string, extra: Partial<Movement> = {}): Movement => ({ id: `MV-${n}`, ts: iso(ts), entita: ent, entitaId: id, action, opId: `op-${n}`, user: who, ...extra });
  const movements: Movement[] = [
    mv(1, "2026-09-22T08:40:00+02:00", "PACK", "P-26-000101", "PRIJEM_PACKU", "Marie Kolářová", { to: "B-14 / A3", delta: 20000, jednotka: "g", note: "Počáteční hmotnost při příjmu" }),
    mv(2, "2026-10-02T11:05:00+02:00", "PACK", "P-26-000105", "OTEVRENI_PACKU", "Jakub Marek", { refType: "PLAN_BALENI", refId: "PB-26-000021" }),
    mv(3, "2026-10-07T07:31:00+02:00", "PACK", "P-26-000103", "OTEVRENI_PACKU", "Tereza Nováková", { refType: "PLAN_VYROBY", refId: "VY-26-000014" }),
    mv(4, "2026-10-08T13:25:00+02:00", "HOTOVY", "HV-26-000010", "DOKONCENI_BALENI", "Tereza Nováková", { delta: 36, jednotka: "balení", refType: "PLAN_BALENI", refId: "PB-26-000022" }),
    mv(5, "2026-10-10T10:18:00+02:00", "PACK", "P-26-000104", "PRESUN_PACKU", "Marie Kolářová", { from: "B-21 / B3", to: "B-21 / B2" }),
  ];
  const operations: Operation[] = [
    op(1, "PRIJEM_PACKU", "P-26-000101", "Marie Kolářová", "2026-09-22T08:40:00+02:00"),
    op(2, "POUZITI_PACKU", "P-26-000105", "Jakub Marek", "2026-10-02T11:05:00+02:00"),
    op(3, "POUZITI_PACKU", "P-26-000103", "Tereza Nováková", "2026-10-07T07:31:00+02:00"),
    op(4, "DOKONCENI_BALENI", "PB-26-000022", "Tereza Nováková", "2026-10-08T13:25:00+02:00"),
    op(5, "PRESUN_PACKU", "P-26-000104", "Marie Kolářová", "2026-10-10T10:18:00+02:00"),
  ];
  const qrLog: QrLog[] = [
    { id: "LB-1", ts: iso("2026-09-22T08:41:00+02:00"), packId: "P-26-000101", action: "PRINT_REQUESTED", format: "50x30mm", baseUrl: "https://script.google.com/macros/s/AKfycbxDEMO-0001/exec", user: "Marie Kolářová" },
  ];
  return {
    config: {
      APP_NAME: "Sklad a výroba", TIMEZONE: "Europe/Prague", APP_BASE_URL: "https://script.google.com/macros/s/AKfycbxDEMO-0001/exec",
      QR_PAYLOAD_MODE: "DEEPLINK", QR_LABEL_FORMAT_DEFAULT: "50x30mm", QR_ENABLE_CAMERA_SCANNER: "FALSE", POSITION_GRID: "A1:D10",
      DEFAULT_LABEL_REQUIRED: "FALSE", PACK_STATUS_VALUES: "NOVY,OTEVRENY,VYPRAZDNENY",
    },
    role: "ADMIN", user: "Marie Kolářová",
    seq: { P: 114, VY: 17, PB: 24, PT: 9, HV: 11, PR: 3, MV: 100 },
    suroviny, packs, produkty, receptury, materialy, plany, planPacks, polotovary, baleni, hotove, predani: [], movements, qrLog, operations,
  };
}

type Result<T = void> = { ok: true; value: T } | { ok: false; error: string };
const fail = (error: string): Result<never> => ({ ok: false, error });

export type Perm = "sklad" | "vyroba" | "expedice";
const PERMS: Record<Role, Perm[]> = {
  ADMIN: ["sklad", "vyroba", "expedice"], VEDOUCI: ["sklad", "vyroba", "expedice"], SKLAD: ["sklad", "expedice"], VYROBA: ["vyroba"], READONLY: [],
};
export const ROLE_USERS: Record<Role, string> = {
  ADMIN: "Marie Kolářová", VEDOUCI: "Petr Dvořák", SKLAD: "Ondřej Svoboda", VYROBA: "Tereza Nováková", READONLY: "Host (jen čtení)",
};

interface Api {
  s: State;
  can: (p: Perm) => boolean;
  setRole: (r: Role) => void;
  nameOf: (surId: string) => string;
  produkt: (id: string) => Produkt | undefined;
  qr: (packId: string) => { url?: string; error?: string };
  receivePack: (i: { surovinaId: string; lot: string; exp: string; hm: number; box: string; poz: string }) => Result<string>;
  movePack: (id: string, box: string, poz: string) => Result;
  logLabel: (packId: string, reprint: boolean) => void;
  assignPack: (planId: string, packId: string) => Result;
  confirmUse: (planId: string, packId: string) => Result;
  emptyPack: (id: string) => Result;
  createPlan: (i: { produktId: string; lot: string; datum: string; planKapsli?: number }) => Result<string>;
  setPlanStav: (id: string, st: PlanStav) => Result;
  completePlan: (id: string, skut?: number) => Result;
  setPolStav: (id: string, st: PolStav) => Result;
  createBaleni: (i: { produktId: string; zdrojTyp: "PACK_SUROVINA" | "POLOTOVAR"; zdrojId: string; pocet: number }) => Result<string>;
  confirmBaleni: (id: string, skut: number) => Result;
  labelHotove: (id: string, pocet: number) => Result;
  handover: (i: { items: { id: string; pocet: number }[]; predal: string; prevzal: string; ref: string }) => Result<string>;
  setConfig: (k: string, v: string) => Result;
}

const Ctx = createContext<Api | null>(null);
export const useStore = () => useContext(Ctx)!;

function initialState(): State {
  const initial = seed();
  try {
    const saved = typeof window !== "undefined" ? window.sessionStorage.getItem("sklad-auth-role") : null;
    if (saved && Object.prototype.hasOwnProperty.call(ROLE_USERS, saved)) {
      const role = saved as Role;
      initial.role = role;
      initial.user = ROLE_USERS[role];
    }
  } catch { /* session storage can be disabled */ }
  return initial;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [s, setState] = useState<State>(initialState);
  const ref = useRef<State>(s);
  const setS = useCallback((u: (c: State) => State) => {
    const n = u(ref.current);
    if (n !== ref.current) { ref.current = n; setState(n); }
  }, []);

  const run = useCallback(
    <T,>(perm: Perm | null, type: string, entity: string, fn: (d: State, log: (m: Omit<Movement, "id" | "ts" | "opId" | "user">) => void, nextId: (k: string, y?: boolean) => string) => Result<T>): Result<T> => {
      let out: Result<T> = fail("Neznámá chyba.");
      setS((cur) => {
        if (perm && !PERMS[cur.role].includes(perm)) { out = fail("Nemáte oprávnění k této akci."); return cur; }
        const d: State = structuredClone(cur);
        const opId = `op-${++d.seq.MV}`;
        const ts = new Date().toISOString();
        const log = (m: Omit<Movement, "id" | "ts" | "opId" | "user">) => d.movements.push({ id: `MV-${++d.seq.MV}`, ts, opId, user: d.user, ...m });
        const nextId = (k: string, y = true) => { const n = d.seq[k]++; return y ? `${k}-26-${String(n).padStart(6, "0")}` : `${k}-${String(n).padStart(2, "0")}`; };
        const r = fn(d, log, nextId);
        out = r;
        if (!r.ok) return cur;
        d.operations.push({ id: opId, type, entityId: entity, by: d.user, started: ts, status: "COMPLETED" });
        return d;
      });
      return out;
    },
    [setS],
  );

  const api = useMemo<Api>(() => {
    const ok = <T,>(value: T): Result<T> => ({ ok: true, value });
    const loc = (b: string, p: string) => `${b} / ${p}`;
    const checkLoc = (box: string, poz: string): string | null => {
      if (!box.trim()) return "Zadejte číslo boxu.";
      if (!POZICE.includes(poz)) return "Pozice musí být v rozsahu A1–D10.";
      return null;
    };
    return {
      s,
      can: (p) => PERMS[s.role].includes(p),
      setRole: (r) => setS((c) => ({ ...c, role: r, user: ROLE_USERS[r] })),
      nameOf: (id) => s.suroviny.find((x) => x.id === id)?.nazev ?? id,
      produkt: (id) => s.produkty.find((x) => x.id === id),
      qr: (id) => buildQrPayload(id, s.config.APP_BASE_URL),

      receivePack: (i) =>
        run("sklad", "PRIJEM_PACKU", "", (d, log, nid) => {
          if (!d.suroviny.some((x) => x.id === i.surovinaId)) return fail("Neznámá surovina.");
          if (!i.lot.trim()) return fail("Zadejte Lot.");
          if (expKey(i.exp) === null) return fail("Expirace musí být ve formátu MM/YY.");
          if (!(i.hm > 0) || !Number.isFinite(i.hm)) return fail("Počáteční hmotnost v gramech musí být kladné konečné číslo.");
          const le = checkLoc(i.box, i.poz); if (le) return fail(le);
          const err = validateBaseUrl(d.config.APP_BASE_URL); if (err) return fail(err);
          const id = nid("P");
          d.packs.push({ id, surovinaId: i.surovinaId, lot: i.lot.trim(), exp: i.exp.trim(), hm: i.hm, jed: "g", stav: "NOVY", box: i.box.trim(), poz: i.poz, receivedAt: new Date().toISOString() });
          log({ entita: "PACK", entitaId: id, action: "PRIJEM_PACKU", to: loc(i.box.trim(), i.poz), delta: i.hm, jednotka: "g", note: "Počáteční hmotnost při příjmu" });
          return ok(id);
        }),

      movePack: (id, box, poz) =>
        run("sklad", "PRESUN_PACKU", id, (d, log) => {
          const p = d.packs.find((x) => x.id === id); if (!p) return fail("Pack neexistuje.");
          const le = checkLoc(box, poz); if (le) return fail(le);
          if (p.box === box.trim() && p.poz === poz) return fail("Pack už v tomto umístění je.");
          const from = loc(p.box, p.poz);
          p.box = box.trim(); p.poz = poz;
          log({ entita: "PACK", entitaId: id, action: "PRESUN_PACKU", from, to: loc(p.box, p.poz) });
          return ok(undefined);
        }),

      logLabel: (packId, reprint) =>
        setS((c) => ({
          ...c,
          qrLog: [...c.qrLog, { id: `LB-${c.qrLog.length + 1}`, ts: new Date().toISOString(), packId, action: reprint ? "REPRINT_REQUESTED" : "PRINT_REQUESTED", format: c.config.QR_LABEL_FORMAT_DEFAULT, baseUrl: c.config.APP_BASE_URL, user: c.user }],
        })),

      assignPack: (planId, packId) =>
        run("vyroba", "PRIRAZENI_PACKU", planId, (d, log) => {
          const pl = d.plany.find((x) => x.id === planId); const p = d.packs.find((x) => x.id === packId);
          if (!pl || !p) return fail("Plán nebo pack neexistuje.");
          if (["DOKONCENO", "ZRUSENO"].includes(pl.stav)) return fail("Plán je uzavřen.");
          if (p.stav === "VYPRAZDNENY") return fail("Vyprázdněný pack nelze vybrat jako zdroj.");
          if (d.planPacks.some((x) => x.planId === planId && x.packId === packId)) return fail("Pack je v plánu už přiřazen.");
          const rec = pl.recepturaId ? d.receptury.find((r) => r.id === pl.recepturaId) : undefined;
          const sur = rec ? rec.surovinaIds : [d.produkty.find((x) => x.id === pl.produktId)?.surovinaId];
          if (!sur.includes(p.surovinaId)) return fail("Surovina packu nepatří do tohoto plánu.");
          d.planPacks.push({ planId, packId, role: rec ? "SLOZKA_RECEPTURY" : "VSTUP_PRIMY", stav: "PLANOVANO" });
          log({ entita: "PACK", entitaId: packId, action: "PLANOVANI_PACKU", refType: "PLAN_VYROBY", refId: planId, note: "Plánování nemění stav packu" });
          return ok(undefined);
        }),

      confirmUse: (planId, packId) =>
        run("vyroba", "POUZITI_PACKU", packId, (d, log) => {
          const pl = d.plany.find((x) => x.id === planId); const p = d.packs.find((x) => x.id === packId);
          const pp = d.planPacks.find((x) => x.planId === planId && x.packId === packId);
          if (!pl || !p || !pp) return fail("Vazba plánu a packu neexistuje.");
          if (!["PRIPRAVENO", "PROBIHA"].includes(pl.stav)) return fail("Použití lze potvrdit jen u plánu Připraveno nebo Probíhá.");
          if (p.stav === "VYPRAZDNENY") return fail("Vyprázdněný pack už nelze použít.");
          if (pp.stav === "POUZITO") return fail("Použití je už potvrzeno.");
          const now = new Date().toISOString();
          pp.stav = "POUZITO"; pp.pouzitoAt = now;
          if (p.stav === "NOVY") { p.stav = "OTEVRENY"; p.openedAt = now; log({ entita: "PACK", entitaId: packId, action: "OTEVRENI_PACKU", refType: "PLAN_VYROBY", refId: planId }); }
          log({ entita: "PACK", entitaId: packId, action: "POUZITI_PACKU", refType: "PLAN_VYROBY", refId: planId });
          if (pl.stav === "PRIPRAVENO") { pl.stav = "PROBIHA"; pl.zahajeni = now; }
          return ok(undefined);
        }),

      emptyPack: (id) =>
        run("sklad", "VYPRAZDNENI_PACKU", id, (d, log) => {
          const p = d.packs.find((x) => x.id === id); if (!p) return fail("Pack neexistuje.");
          if (p.stav === "VYPRAZDNENY") return fail("Pack je už vyprázdněný.");
          if (p.stav === "NOVY") return fail("Nový, nikdy nepoužitý pack nelze označit jako vyprázdněný.");
          p.stav = "VYPRAZDNENY"; p.emptiedAt = new Date().toISOString();
          d.planPacks.forEach((x) => { if (x.packId === id && x.stav === "PLANOVANO") x.stav = "NEPOUZITO"; });
          log({ entita: "PACK", entitaId: id, action: "VYPRAZDNENI_PACKU", note: "Potvrzeno obsluhou" });
          return ok(undefined);
        }),

      createPlan: (i) =>
        run("vyroba", "ZALOZENI_PLANU", "", (d, _l, nid) => {
          const pr = d.produkty.find((x) => x.id === i.produktId); if (!pr) return fail("Produkt neexistuje.");
          if (pr.vstup === "JEDNA_SUROVINA" && pr.forma === "SYPKA") return fail("Přímé plnění nevyžaduje výrobní plán – založte plán balení.");
          if (!i.lot.trim()) return fail("Zadejte výrobní lot.");
          if (pr.forma === "KAPSLE" && !(i.planKapsli && i.planKapsli > 0)) return fail("Zadejte plánovaný počet kapslí.");
          const id = nid("VY");
          d.plany.push({ id, cislo: id, produktId: pr.id, recepturaId: pr.recepturaId, lot: i.lot.trim(), datum: i.datum, stav: "NAPLANOVANO", planKapsli: pr.forma === "KAPSLE" ? i.planKapsli : undefined, operator: d.user });
          return ok(id);
        }),

      setPlanStav: (id, st) =>
        run("vyroba", "ZMENA_STAVU_PLANU", id, (d) => {
          const pl = d.plany.find((x) => x.id === id); if (!pl) return fail("Plán neexistuje.");
          const allowed: Record<PlanStav, PlanStav[]> = {
            NAPLANOVANO: ["PRIPRAVENO", "ZRUSENO"], PRIPRAVENO: ["PROBIHA", "ZRUSENO"], PROBIHA: ["POZASTAVENO"], POZASTAVENO: ["PROBIHA", "ZRUSENO"], DOKONCENO: [], ZRUSENO: [],
          };
          if (!allowed[pl.stav].includes(st)) return fail(`Přechod ${STAV_LABEL[pl.stav]} → ${STAV_LABEL[st]} není povolen.`);
          if (st === "PRIPRAVENO" && !d.planPacks.some((x) => x.planId === id)) return fail("Před přípravou přiřaďte alespoň jeden pack.");
          if (st === "PROBIHA" && !pl.zahajeni) pl.zahajeni = new Date().toISOString();
          pl.stav = st;
          return ok(undefined);
        }),

      completePlan: (id, skut) =>
        run("vyroba", "DOKONCENI_VYROBY", id, (d, log, nid) => {
          const pl = d.plany.find((x) => x.id === id); if (!pl) return fail("Plán neexistuje.");
          if (pl.stav !== "PROBIHA") return fail("Dokončit lze jen plán ve stavu Probíhá.");
          const pr = d.produkty.find((x) => x.id === pl.produktId)!;
          const used = d.planPacks.filter((x) => x.planId === id && x.stav === "POUZITO");
          if (!used.length) return fail("Nejsou potvrzeny žádné použité packy.");
          if (pl.recepturaId) {
            const rec = d.receptury.find((r) => r.id === pl.recepturaId)!;
            const miss = rec.surovinaIds.filter((sid) => !used.some((u) => d.packs.find((p) => p.id === u.packId)?.surovinaId === sid));
            if (miss.length) return fail(`Chybí potvrzený pack pro: ${miss.map((m) => d.suroviny.find((x) => x.id === m)?.nazev).join(", ")}.`);
          }
          if (pr.forma === "KAPSLE" && !(skut && skut > 0)) return fail("Zadejte skutečný počet vyrobených kapslí.");
          pl.stav = "DOKONCENO"; pl.dokonceni = new Date().toISOString(); if (pr.forma === "KAPSLE") pl.skutKapsli = skut;
          const ptId = nid("PT");
          d.polotovary.push({ id: ptId, planId: id, produktId: pr.id, typ: pr.forma === "KAPSLE" ? "KAPSLE_NEZABALENE" : "SYPKA_SMES", lot: pl.lot, kapsli: pr.forma === "KAPSLE" ? skut : undefined, stav: "PRIPRAVEN", box: "B-08", poz: "C1", createdAt: pl.dokonceni });
          if (pl.recepturaId) log({ entita: "PLAN_VYROBY", entitaId: id, action: "MICHANI", refType: "RECEPTURA", refId: pl.recepturaId, note: `Použité packy: ${used.map((u) => u.packId).join(", ")}` });
          if (pr.forma === "KAPSLE") log({ entita: "POLOTOVAR", entitaId: ptId, action: "KAPSLOVANI", delta: skut, jednotka: "kapslí", refType: "PLAN_VYROBY", refId: id });
          log({ entita: "POLOTOVAR", entitaId: ptId, action: "VZNIK_POLOTOVARU", refType: "PLAN_VYROBY", refId: id });
          return ok(undefined);
        }),

      setPolStav: (id, st) =>
        run("vyroba", "STAV_POLOTOVARU", id, (d, log) => {
          const p = d.polotovary.find((x) => x.id === id); if (!p) return fail("Polotovar neexistuje.");
          const order: PolStav[] = ["PRIPRAVEN", "OTEVRENY", "SPOTREBOVANY"];
          if (order.indexOf(st) !== order.indexOf(p.stav) + 1) return fail("Stav polotovaru lze posunout jen o krok vpřed.");
          p.stav = st; log({ entita: "POLOTOVAR", entitaId: id, action: `STAV_${st}`, note: "Potvrzeno obsluhou" });
          return ok(undefined);
        }),

      createBaleni: (i) =>
        run("vyroba", "ZALOZENI_PLANU_BALENI", "", (d, _l, nid) => {
          const pr = d.produkty.find((x) => x.id === i.produktId); if (!pr) return fail("Produkt neexistuje.");
          if (!(i.pocet > 0) || !Number.isInteger(i.pocet)) return fail("Počet balení musí být kladné celé číslo.");
          if (i.zdrojTyp === "PACK_SUROVINA") {
            const p = d.packs.find((x) => x.id === i.zdrojId);
            if (!p) return fail("Zdrojový pack neexistuje.");
            if (p.stav === "VYPRAZDNENY") return fail("Vyprázdněný pack nelze vybrat jako zdroj.");
            if (pr.vstup !== "JEDNA_SUROVINA" || pr.forma !== "SYPKA" || p.surovinaId !== pr.surovinaId) return fail("Pack neodpovídá produktu pro přímé plnění.");
          } else {
            const t = d.polotovary.find((x) => x.id === i.zdrojId);
            if (!t || t.produktId !== pr.id) return fail("Polotovar neodpovídá produktu.");
            if (t.stav === "SPOTREBOVANY") return fail("Polotovar je spotřebovaný.");
          }
          const id = nid("PB");
          const t = i.zdrojTyp === "POLOTOVAR" ? d.polotovary.find((x) => x.id === i.zdrojId) : undefined;
          d.baleni.push({ id, cislo: id, produktId: pr.id, zdrojTyp: i.zdrojTyp, zdrojId: i.zdrojId, lot: t?.lot ?? `${d.packs.find((x) => x.id === i.zdrojId)?.lot}-B`, kapsliNaBaleni: pr.kapsliNaBaleni, planPocet: i.pocet, stav: "NAPLANOVANO", operator: d.user });
          return ok(id);
        }),

      confirmBaleni: (id, skut) =>
        run("vyroba", "DOKONCENI_BALENI", id, (d, log, nid) => {
          const b = d.baleni.find((x) => x.id === id); if (!b) return fail("Plán balení neexistuje.");
          if (["DOKONCENO", "ZRUSENO"].includes(b.stav)) return fail("Plán balení je uzavřen.");
          if (!(skut > 0) || !Number.isInteger(skut)) return fail("Skutečný počet balení musí být kladné celé číslo.");
          const pr = d.produkty.find((x) => x.id === b.produktId)!;
          for (const m of pr.mats) {
            const mat = d.materialy.find((x) => x.id === m.materialId)!;
            if (mat.mnozstvi < m.naBaleni * skut) return fail(`Nedostatek materiálu „${mat.nazev}“: potřeba ${m.naBaleni * skut} ${mat.jednotka}, k dispozici ${mat.mnozstvi}.`);
          }
          if (b.zdrojTyp === "POLOTOVAR") {
            const t = d.polotovary.find((x) => x.id === b.zdrojId)!;
            if (t.stav === "SPOTREBOVANY") return fail("Polotovar je spotřebovaný.");
            if (t.typ === "KAPSLE_NEZABALENE") {
              const need = (b.kapsliNaBaleni ?? 0) * skut;
              if ((t.kapsli ?? 0) < need) return fail(`Nedostatek kapslí: potřeba ${need} ks, k dispozici ${t.kapsli ?? 0} ks.`);
              t.kapsli = (t.kapsli ?? 0) - need;
              log({ entita: "POLOTOVAR", entitaId: t.id, action: "SPOTREBA_KAPSLI", delta: -need, jednotka: "kapslí", refType: "PLAN_BALENI", refId: id });
              if (t.stav === "PRIPRAVEN") t.stav = "OTEVRENY";
            } else if (t.stav === "PRIPRAVEN") t.stav = "OTEVRENY";
          } else {
            const p = d.packs.find((x) => x.id === b.zdrojId)!;
            if (p.stav === "VYPRAZDNENY") return fail("Zdrojový pack je vyprázdněný.");
            if (p.stav === "NOVY") { p.stav = "OTEVRENY"; p.openedAt = new Date().toISOString(); log({ entita: "PACK", entitaId: p.id, action: "OTEVRENI_PACKU", refType: "PLAN_BALENI", refId: id }); }
            log({ entita: "PACK", entitaId: p.id, action: "POUZITI_PACKU", refType: "PLAN_BALENI", refId: id });
          }
          for (const m of pr.mats) {
            const mat = d.materialy.find((x) => x.id === m.materialId)!;
            mat.mnozstvi -= m.naBaleni * skut;
            log({ entita: "MATERIAL", entitaId: mat.id, action: "SPOTREBA_MATERIALU", delta: -(m.naBaleni * skut), jednotka: mat.jednotka, refType: "PLAN_BALENI", refId: id });
          }
          b.stav = "DOKONCENO"; b.skutPocet = skut; b.dokonceni = new Date().toISOString(); b.operator = d.user;
          const hid = nid("HV");
          const lab = pr.etiketaPovinna;
          d.hotove.push({ id: hid, planBaleniId: id, produktId: pr.id, lot: b.lot, pocet: skut, stav: lab ? "CEKA_ETYKETU" : "PRIPRAVENO_K_PREDANI", box: "B-40", poz: "A3", updatedAt: b.dokonceni });
          log({ entita: "HOTOVY", entitaId: hid, action: "DOKONCENI_BALENI", delta: skut, jednotka: "balení", refType: "PLAN_BALENI", refId: id });
          return ok(undefined);
        }),

      labelHotove: (id, pocet) =>
        run("vyroba", "ETIKETOVANI", id, (d, log, nid) => {
          const h = d.hotove.find((x) => x.id === id); if (!h) return fail("Řádek hotových výrobků neexistuje.");
          if (h.stav !== "CEKA_ETYKETU") return fail("Výrobek nečeká na etiketu.");
          if (!(pocet > 0) || !Number.isInteger(pocet) || pocet > h.pocet) return fail(`Počet musí být celé číslo 1–${h.pocet}.`);
          const pr = d.produkty.find((x) => x.id === h.produktId)!;
          const mat = pr.etiketaMat ? d.materialy.find((x) => x.id === pr.etiketaMat) : undefined;
          if (mat) {
            if (mat.mnozstvi < pocet) return fail(`Nedostatek etiket „${mat.nazev}“: potřeba ${pocet}, k dispozici ${mat.mnozstvi}.`);
            mat.mnozstvi -= pocet;
            log({ entita: "MATERIAL", entitaId: mat.id, action: "SPOTREBA_MATERIALU", delta: -pocet, jednotka: mat.jednotka, refType: "ETIKETOVANI", refId: id });
          }
          const now = new Date().toISOString();
          if (pocet === h.pocet) { h.stav = "PRIPRAVENO_K_PREDANI"; h.updatedAt = now; }
          else {
            h.pocet -= pocet; h.updatedAt = now;
            d.hotove.push({ ...h, id: nid("HV"), pocet, stav: "PRIPRAVENO_K_PREDANI" });
          }
          log({ entita: "HOTOVY", entitaId: id, action: "ETIKETOVANI", delta: pocet, jednotka: "balení", note: "Počet balení se nesnižuje" });
          return ok(undefined);
        }),

      handover: (i) =>
        run("expedice", "PREDANI_EXPEDICI", "", (d, log, nid) => {
          if (!i.predal.trim() || !i.prevzal.trim()) return fail("Vyplňte, kdo předává a kdo přebírá.");
          const items = i.items.filter((x) => x.pocet > 0);
          if (!items.length) return fail("Vyberte alespoň jednu položku.");
          const polozky: Predani["polozky"] = [];
          for (const it of items) {
            const h = d.hotove.find((x) => x.id === it.id);
            if (!h) return fail("Položka neexistuje.");
            if (h.stav !== "PRIPRAVENO_K_PREDANI") return fail(`Položka ${h.id} není připravena k předání.`);
            if (!Number.isInteger(it.pocet) || it.pocet > h.pocet) return fail(`Položka ${h.id}: počet musí být celé číslo 1–${h.pocet}.`);
          }
          const pid = `PE-26-${String(d.predani.length + 1).padStart(6, "0")}`;
          const now = new Date().toISOString();
          for (const it of items) {
            const h = d.hotove.find((x) => x.id === it.id)!;
            if (it.pocet === h.pocet) { h.stav = "PREDANO_EXPEDICI"; h.updatedAt = now; }
            else { h.pocet -= it.pocet; h.updatedAt = now; d.hotove.push({ ...h, id: nid("HV"), pocet: it.pocet, stav: "PREDANO_EXPEDICI" }); }
            polozky.push({ produktId: h.produktId, lot: h.lot, pocet: it.pocet });
            log({ entita: "HOTOVY", entitaId: h.id, action: "PREDANI_EXPEDICI", delta: -it.pocet, jednotka: "balení", refType: "PREDANI", refId: pid });
          }
          d.predani.push({ id: pid, ts: now, predal: i.predal.trim(), prevzal: i.prevzal.trim(), ref: i.ref.trim(), polozky });
          return ok(pid);
        }),

      setConfig: (k, v) => {
        let out: Result = ok(undefined);
        if (k === "APP_BASE_URL") { const e = validateBaseUrl(v); if (e) return fail(e); }
        setS((c) => {
          if (!PERMS[c.role].includes("sklad") || c.role === "SKLAD") { out = fail("Nastavení smí měnit jen ADMIN nebo VEDOUCI."); return c; }
          return { ...c, config: { ...c.config, [k]: v } };
        });
        return out;
      },
    };
  }, [s, run, setS]);

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

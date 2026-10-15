import { useEffect, useState, type ReactNode } from "react";
import QRCode from "qrcode";
import { STAV_LABEL, type Pack, useStore } from "./store";

export const go = (hash: string) => {
  window.location.hash = hash;
};

export const fmtDT = (iso?: string) =>
  iso ? new Date(iso).toLocaleString("cs-CZ", { timeZone: "Europe/Prague", day: "numeric", month: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
export const fmtD = (iso?: string) => (iso ? new Date(iso).toLocaleDateString("cs-CZ", { timeZone: "Europe/Prague" }) : "—");
export const nf = (n: number) => n.toLocaleString("cs-CZ");

const TAG: Record<string, string> = {
  NOVY: "tag-new", OTEVRENY: "tag-open", VYPRAZDNENY: "tag-done",
  NAPLANOVANO: "tag-new", PRIPRAVENO: "tag-warn", PROBIHA: "tag-open", POZASTAVENO: "tag-warn", DOKONCENO: "tag-ok", ZRUSENO: "tag-done",
  CEKA_ETYKETU: "tag-warn", PRIPRAVENO_K_PREDANI: "tag-open", PREDANO_EXPEDICI: "tag-done",
  PRIPRAVEN: "tag-new", SPOTREBOVANY: "tag-done", PLANOVANO: "tag-new", POUZITO: "tag-ok", NEPOUZITO: "tag-done",
};
export function Tag({ v }: { v: string }) {
  return <span className={`tag ${TAG[v] ?? "tag-new"}`}>{STAV_LABEL[v] ?? v}</span>;
}

export function Panel({ title, right, children, className = "" }: { title: ReactNode; right?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`panel ${className}`}>
      <div className="panel-h">
        <span>{title}</span>
        {right}
      </div>
      {children}
    </section>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="lbl mb-1 block">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-mute">{hint}</span>}
    </label>
  );
}

export function PageHead({ no, title, sub, right }: { no: string; title: string; sub?: string; right?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b-2 border-ink pb-4">
      <div>
        <div className="lbl mb-1">
          <span className="text-signal-ink">{no}</span> / Sklad a výroba
        </div>
        <h1 className="mono text-[28px] leading-none font-extrabold tracking-tight uppercase sm:text-[34px]">{title}</h1>
        {sub && <p className="mt-2 max-w-2xl text-[13px] text-mute">{sub}</p>}
      </div>
      {right}
    </header>
  );
}

export function Notice({ kind = "info", children }: { kind?: "info" | "err" | "ok"; children: ReactNode }) {
  const c = kind === "err" ? "border-signal-ink bg-[#ffe9e0] text-signal-ink" : kind === "ok" ? "border-ok bg-[#e6f3ea] text-ok" : "border-ink bg-stock hatch";
  return <div className={`border px-3 py-2 text-[13px] ${c}`}>{children}</div>;
}

export function useFlash() {
  const [m, setM] = useState<{ kind: "err" | "ok"; text: string } | null>(null);
  useEffect(() => {
    if (!m) return;
    const t = setTimeout(() => setM(null), 6000);
    return () => clearTimeout(t);
  }, [m]);
  const node = m ? <Notice kind={m.kind}>{m.text}</Notice> : null;
  return {
    node,
    err: (text: string) => setM({ kind: "err", text }),
    ok: (text: string) => setM({ kind: "ok", text }),
    handle: (r: { ok: boolean; error?: string }, okText: string) => (r.ok ? setM({ kind: "ok", text: okText }) : setM({ kind: "err", text: r.error ?? "Chyba." })),
  };
}

export function QR({ text }: { text: string }) {
  const [svg, setSvg] = useState("");
  useEffect(() => {
    let live = true;
    QRCode.toString(text, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#000000", light: "#ffffff" } }).then((s) => live && setSvg(s));
    return () => {
      live = false;
    };
  }, [text]);
  return <div className="aspect-square h-full w-full bg-white [&>svg]:block [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />;
}

export function LabelArt({ pack, scale = 1, print = false }: { pack: Pack; scale?: number; print?: boolean }) {
  const { qr, nameOf } = useStore();
  const q = qr(pack.id);
  const u = (mm: number) => `${(mm * scale).toFixed(3)}mm`;
  return (
    <div
      className={print ? "print-label" : ""}
      style={{ width: u(50), height: u(30), background: "#fff", color: "#000", padding: u(1.5), boxSizing: "border-box", display: "flex", flexDirection: "column", gap: u(0.6), outline: print ? undefined : "1px solid #111" }}
    >
      <div style={{ display: "flex", gap: u(1.6), height: u(22) }}>
        <div style={{ width: u(22), height: u(22), flex: "none", display: "grid", placeItems: "center", border: q.url ? undefined : "1px dashed #000" }}>
          {q.url ? <QR text={q.url} /> : <span style={{ fontSize: u(1.9), textAlign: "center", fontFamily: "var(--font-mono)" }}>QR ZABLOKOVÁN</span>}
        </div>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: u(2.9), lineHeight: 1.1, fontWeight: 700, fontFamily: "var(--font-sans)", overflow: "hidden" }}>{nameOf(pack.surovinaId)}</div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: u(2.2), lineHeight: 1.25 }}>
            <div>LOT {pack.lot}</div>
            <div>EXP {pack.exp}</div>
          </div>
        </div>
      </div>
      <div style={{ fontFamily: "var(--font-mono)", fontWeight: 800, fontSize: u(4.5), lineHeight: 1, letterSpacing: "0.02em", whiteSpace: "nowrap" }}>{pack.id}</div>
    </div>
  );
}

export function LabelBlock({ pack, onPrint, reprint }: { pack: Pack; onPrint: () => void; reprint: boolean }) {
  const { qr, can } = useStore();
  const q = qr(pack.id);
  return (
    <div>
      <div className="hatch grid place-items-center border-b border-ink p-5">
        <LabelArt pack={pack} scale={2.4} />
      </div>
      <LabelArt pack={pack} print />
      <div className="space-y-3 p-4">
        {q.error ? (
          <Notice kind="err">{q.error} Štítek nelze vytisknout – opravte URL v Nastavení.</Notice>
        ) : (
          <div className="mono break-all text-[11px] text-mute">{q.url}</div>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <button
            className="btn btn-primary"
            disabled={!!q.error || !can("sklad")}
            onClick={() => {
              onPrint();
              setTimeout(() => window.print(), 50);
            }}
          >
            {reprint ? "Znovu vytisknout štítek" : "Vytisknout štítek"}
          </button>
          <span className="lbl">50 × 30 mm · log: PRINT_REQUESTED</span>
        </div>
        <p className="text-[11px] text-mute">Na štítku není box ani pozice – aktuální umístění se po naskenování načte z databáze. Opakovaný tisk nikdy nezakládá nové Pack_ID.</p>
      </div>
    </div>
  );
}

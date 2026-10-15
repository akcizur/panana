import { useState } from "react";
import { OP_LABEL, fifoWarning, useStore, type Plan } from "./store";
import { Field, Notice, PageHead, Panel, Tag, fmtD, fmtDT, nf, useFlash } from "./ui";

const ROUTE = (forma: string, vstup: string) =>
  vstup === "RECEPTURA" ? (forma === "KAPSLE" ? ["MICHANI", "KAPSLOVANI"] : ["MICHANI"]) : ["KAPSLOVANI"];
const CESTA = (forma: string, vstup: string) => (vstup === "RECEPTURA" ? (forma === "KAPSLE" ? "D" : "C") : "B");

function PlanCard({ pl }: { pl: Plan }) {
  const { s, produkt, nameOf, can, assignPack, confirmUse, setPlanStav, completePlan } = useStore();
  const f = useFlash();
  const [open, setOpen] = useState(pl.stav === "PROBIHA");
  const [pick, setPick] = useState("");
  const [skut, setSkut] = useState("");
  const pr = produkt(pl.produktId)!;
  const rec = pl.recepturaId ? s.receptury.find((r) => r.id === pl.recepturaId) : undefined;
  const links = s.planPacks.filter((x) => x.planId === pl.id);
  const allowedSur = rec ? rec.surovinaIds : [pr.surovinaId!];
  const candidates = s.packs.filter((p) => p.stav !== "VYPRAZDNENY" && allowedSur.includes(p.surovinaId) && !links.some((l) => l.packId === p.id));
  const closed = ["DOKONCENO", "ZRUSENO"].includes(pl.stav);
  const nextBtn: Partial<Record<Plan["stav"], [Plan["stav"], string]>> = { NAPLANOVANO: ["PRIPRAVENO", "Označit jako připravené"], PRIPRAVENO: ["PROBIHA", "Zahájit"], POZASTAVENO: ["PROBIHA", "Obnovit"] };
  const nb = nextBtn[pl.stav];
  const steps = ROUTE(pr.forma, pr.vstup);

  return (
    <div className="panel">
      <button className="flex w-full flex-wrap items-center justify-between gap-3 p-4 text-left" onClick={() => setOpen(!open)} aria-expanded={open}>
        <div className="flex items-center gap-4">
          <span className="mono grid size-10 place-items-center border border-ink bg-ink text-[18px] font-extrabold text-signal" title="Výrobní cesta">{CESTA(pr.forma, pr.vstup)}</span>
          <div>
            <div className="mono text-[13px] font-bold">{pl.cislo} · lot {pl.lot}</div>
            <div className="text-[13px]">{pr.nazev}{rec && <span className="text-mute"> · {rec.nazev} v{rec.verze}</span>}</div>
          </div>
        </div>
        <div className="flex items-center gap-3"><span className="mono text-[11px] text-mute">{fmtD(pl.datum)}</span><Tag v={pl.stav} /></div>
      </button>
      {open && (
        <div className="space-y-4 border-t border-ink p-4">
          <div className="flex flex-wrap items-center gap-2">
            {steps.map((st, i) => <span key={st} className="mono flex items-center gap-2 text-[11px] font-bold uppercase">{i > 0 && <span className="text-mute">→</span>}<span className="border border-ink px-2 py-1">{OP_LABEL[st]}</span></span>)}
            <span className="mono text-[11px] text-mute">→ polotovar {pr.forma === "KAPSLE" ? "KAPSLE_NEZABALENE" : "SYPKA_SMES"}</span>
          </div>
          {pr.forma === "KAPSLE" && <div className="mono text-[12px]">Plán {nf(pl.planKapsli ?? 0)} kapslí{pl.skutKapsli ? ` · skutečnost ${nf(pl.skutKapsli)}` : ""}</div>}

          <div>
            <div className="lbl mb-2">Použité packy {rec && `· složky receptury: ${rec.surovinaIds.map(nameOf).join(", ")}`}</div>
            {links.length ? (
              <table className="tbl">
                <tbody>
                  {links.map((l) => {
                    const p = s.packs.find((x) => x.id === l.packId)!;
                    return (
                      <tr key={l.packId}>
                        <td className="mono font-bold"><a className="underline decoration-signal underline-offset-4" href={`#/pack/${p.id}`}>{p.id}</a></td>
                        <td>{nameOf(p.surovinaId)}</td>
                        <td className="mono">{p.lot}</td>
                        <td><Tag v={l.stav} /></td>
                        <td className="text-right">{l.stav === "PLANOVANO" && can("vyroba") && ["PRIPRAVENO", "PROBIHA"].includes(pl.stav) && <button className="btn btn-sm" onClick={() => f.handle(confirmUse(pl.id, p.id), "Použití packu potvrzeno.")}>Potvrdit použití</button>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : <p className="text-[12px] text-mute">Zatím žádný pack.</p>}
          </div>

          {!closed && can("vyroba") && (
            <div className="grid gap-4 border-t border-line pt-4 sm:grid-cols-[1fr_auto]">
              <div>
                <div className="flex gap-2">
                  <select className="input" value={pick} onChange={(e) => setPick(e.target.value)}>
                    <option value="">+ přiřadit pack…</option>
                    {candidates.map((p) => <option key={p.id} value={p.id}>{p.id} · {nameOf(p.surovinaId)} · {p.lot} · exp {p.exp}{fifoWarning(p, s.packs) ? " ⚠ FIFO" : ""}</option>)}
                  </select>
                  <button className="btn" disabled={!pick} onClick={() => { f.handle(assignPack(pl.id, pick), "Pack přiřazen."); setPick(""); }}>Přiřadit</button>
                </div>
                {pick && fifoWarning(s.packs.find((p) => p.id === pick)!, s.packs) && <p className="mt-1 text-[12px] text-warn">{fifoWarning(s.packs.find((p) => p.id === pick)!, s.packs)} – FIFO je upozornění, volba zůstává na vás.</p>}
              </div>
              <div className="flex flex-wrap gap-2">
                {nb && <button className="btn" onClick={() => f.handle(setPlanStav(pl.id, nb[0]), `Stav: ${nb[1]}.`)}>{nb[1]}</button>}
                {pl.stav === "PROBIHA" && <button className="btn" onClick={() => f.handle(setPlanStav(pl.id, "POZASTAVENO"), "Plán pozastaven.")}>Pozastavit</button>}
                {pl.stav !== "PROBIHA" && <button className="btn" onClick={() => f.handle(setPlanStav(pl.id, "ZRUSENO"), "Plán zrušen.")}>Zrušit</button>}
              </div>
            </div>
          )}

          {pl.stav === "PROBIHA" && can("vyroba") && (
            <div className="grid items-end gap-3 border-t border-line pt-4 sm:grid-cols-[1fr_auto]">
              {pr.forma === "KAPSLE" ? <Field label="Skutečný počet vyrobených kapslí (ks)"><input className="input" inputMode="numeric" value={skut} onChange={(e) => setSkut(e.target.value)} /></Field> : <p className="text-[12px] text-mute">Sypká směs – hmotnost ani zbytek se nepočítá.</p>}
              <button className="btn btn-primary" onClick={() => f.handle(completePlan(pl.id, Number(skut) || undefined), "Výroba dokončena, vznikl polotovar.")}>Dokončit a vytvořit polotovar</button>
            </div>
          )}
          {f.node}
        </div>
      )}
    </div>
  );
}

export function Vyroba() {
  const { s, createPlan, setPolStav, can, produkt, nameOf } = useStore();
  const [tab, setTab] = useState("plany");
  const f = useFlash();
  const eligible = s.produkty.filter((p) => !(p.vstup === "JEDNA_SUROVINA" && p.forma === "SYPKA"));
  const [n, setN] = useState({ produktId: eligible[0].id, lot: "", datum: "2026-10-20", planKapsli: "" });
  return (
    <>
      <PageHead no="06" title="Výroba" sub="Plánování samo nic neotevírá. Pack se mění na Otevřený až potvrzením skutečného použití." />
      <div className="panel mb-6">
        <div className="tabs" role="tablist">
          {[["plany", "Plány výroby"], ["pol", "Polotovary"], ["rec", "Receptury"]].map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{l}</button>)}
        </div>
      </div>

      {tab === "plany" && (
        <div className="grid items-start gap-6 xl:grid-cols-[1.6fr_1fr]">
          <div className="grid gap-4">{[...s.plany].sort((a, b) => b.datum.localeCompare(a.datum)).map((pl) => <PlanCard key={pl.id} pl={pl} />)}</div>
          <Panel title="Nový výrobní plán">
            <div className="space-y-3 p-4">
              <Field label="Produkt"><select className="input" value={n.produktId} onChange={(e) => setN({ ...n, produktId: e.target.value })}>{eligible.map((p) => <option key={p.id} value={p.id}>{p.nazev}</option>)}</select></Field>
              <Field label="Výrobní lot"><input className="input" value={n.lot} onChange={(e) => setN({ ...n, lot: e.target.value })} placeholder="FB-261020" /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Datum"><input type="date" className="input" value={n.datum} onChange={(e) => setN({ ...n, datum: e.target.value })} /></Field>
                <Field label="Plán kapslí"><input className="input" inputMode="numeric" value={n.planKapsli} onChange={(e) => setN({ ...n, planKapsli: e.target.value })} /></Field>
              </div>
              {f.node}
              <button className="btn btn-primary w-full" disabled={!can("vyroba")} onClick={() => f.handle(createPlan({ ...n, planKapsli: Number(n.planKapsli) || undefined }), "Plán založen.")}>Založit plán</button>
              <p className="text-[11px] text-mute">Přímé plnění jedné suroviny (cesta A) výrobní plán nepotřebuje – založte rovnou plán balení.</p>
            </div>
          </Panel>
        </div>
      )}

      {tab === "pol" && (
        <Panel title="Polotovary">
          <div className="overflow-x-auto">
            <table className="tbl min-w-[780px]">
              <thead><tr><th>ID</th><th>Produkt</th><th>Typ</th><th>Lot</th><th>Kapslí</th><th>Stav</th><th>Umístění</th><th></th></tr></thead>
              <tbody>
                {s.polotovary.map((t) => (
                  <tr key={t.id}>
                    <td className="mono font-bold">{t.id}</td><td>{produkt(t.produktId)?.nazev}</td>
                    <td className="mono text-[12px]">{t.typ}</td><td className="mono">{t.lot}</td>
                    <td className="mono">{t.kapsli != null ? nf(t.kapsli) : <span className="text-mute" title="Hmotnost se nevede">—</span>}</td>
                    <td><Tag v={t.stav} /></td><td className="mono">{t.box} / {t.poz}</td>
                    <td className="text-right">
                      {can("vyroba") && t.stav !== "SPOTREBOVANY" && <button className="btn btn-sm" onClick={() => f.handle(setPolStav(t.id, t.stav === "PRIPRAVEN" ? "OTEVRENY" : "SPOTREBOVANY"), "Stav polotovaru potvrzen.")}>{t.stav === "PRIPRAVEN" ? "Otevřít" : "Potvrdit spotřebu"}</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="space-y-2 p-4">{f.node}<p className="text-[12px] text-mute">U sypké směsi stav nevyjadřuje množství zbytku – vždy ho potvrzuje obsluha.</p></div>
        </Panel>
      )}

      {tab === "rec" && (
        <div className="grid gap-4 md:grid-cols-2">
          {s.receptury.map((r) => (
            <Panel key={r.id} title={`${r.nazev} · v${r.verze}`} right={<Tag v={r.forma === "KAPSLE" ? "PRIPRAVEN" : "PLANOVANO"} />}>
              <ol className="p-4">
                {r.surovinaIds.map((id, i) => <li key={id} className="flex gap-4 border-b border-line py-2 last:border-0"><span className="mono text-signal-ink font-bold">{String(i + 1).padStart(2, "0")}</span>{nameOf(id)}</li>)}
              </ol>
              <p className="border-t border-line px-4 py-3 text-[12px] text-mute">{r.poznamka}. Receptura eviduje složení, ne navážky ani poměry. Změna seznamu = nová verze.</p>
            </Panel>
          ))}
        </div>
      )}
    </>
  );
}

export function Baleni() {
  const { s, produkt, nameOf, createBaleni, confirmBaleni, can } = useStore();
  const f = useFlash();
  const [n, setN] = useState({ produktId: s.produkty[0].id, zdrojId: "", pocet: "" });
  const [skut, setSkut] = useState<Record<string, string>>({});
  const pr = s.produkty.find((p) => p.id === n.produktId)!;
  const direct = pr.vstup === "JEDNA_SUROVINA" && pr.forma === "SYPKA";
  const zdroje = direct
    ? s.packs.filter((p) => p.stav !== "VYPRAZDNENY" && p.surovinaId === pr.surovinaId).map((p) => ({ id: p.id, l: `${p.id} · lot ${p.lot} · exp ${p.exp}` }))
    : s.polotovary.filter((t) => t.produktId === pr.id && t.stav !== "SPOTREBOVANY").map((t) => ({ id: t.id, l: `${t.id} · lot ${t.lot}${t.kapsli != null ? ` · ${nf(t.kapsli)} kapslí` : ""}` }));
  const matNeed = (pocet: number) => pr.mats.map((m) => ({ ...m, mat: s.materialy.find((x) => x.id === m.materialId)!, need: m.naBaleni * pocet }));
  const cnt = Number(n.pocet) || 0;

  return (
    <>
      <PageHead no="07" title="Balení" sub="Kusově se sledují obaly, kapsle a počet dokončených balení. Nedostatek čehokoli blokuje potvrzení." />
      <div className="grid items-start gap-6 xl:grid-cols-[1.5fr_1fr]">
        <div className="grid gap-6">
          <Panel title="Plány balení">
            <div className="overflow-x-auto">
              <table className="tbl min-w-[780px]">
                <thead><tr><th>Plán</th><th>Produkt</th><th>Zdroj</th><th>Plán</th><th>Skut.</th><th>Stav</th><th></th></tr></thead>
                <tbody>
                  {[...s.baleni].reverse().map((b) => {
                    const done = b.stav === "DOKONCENO";
                    return (
                      <tr key={b.id}>
                        <td className="mono font-bold">{b.cislo}</td>
                        <td>{produkt(b.produktId)?.nazev}<div className="mono text-[11px] text-mute">lot {b.lot}</div></td>
                        <td className="mono text-[12px]">{b.zdrojId}</td>
                        <td className="mono">{b.planPocet}</td><td className="mono">{b.skutPocet ?? "—"}</td>
                        <td><Tag v={b.stav} /></td>
                        <td>
                          {!done && b.stav !== "ZRUSENO" && can("vyroba") && (
                            <div className="flex justify-end gap-2">
                              <input className="input !h-7 !w-16" inputMode="numeric" placeholder={String(b.planPocet)} value={skut[b.id] ?? ""} onChange={(e) => setSkut({ ...skut, [b.id]: e.target.value })} aria-label="Skutečný počet balení" />
                              <button className="btn btn-primary btn-sm" onClick={() => f.handle(confirmBaleni(b.id, Number(skut[b.id] ?? b.planPocet)), `Balení ${b.cislo} potvrzeno.`)}>Potvrdit</button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="p-4 pt-0">{f.node}</div>
          </Panel>

          <Panel title="Nový plán balení">
            <div className="grid gap-4 p-4 sm:grid-cols-2">
              <Field label="Produkt"><select className="input" value={n.produktId} onChange={(e) => setN({ ...n, produktId: e.target.value, zdrojId: "" })}>{s.produkty.map((p) => <option key={p.id} value={p.id}>{p.nazev}</option>)}</select></Field>
              <Field label={direct ? "Zdroj: pack suroviny (přímé plnění)" : "Zdroj: polotovar"}>
                <select className="input" value={n.zdrojId} onChange={(e) => setN({ ...n, zdrojId: e.target.value })}><option value="">— vyberte —</option>{zdroje.map((z) => <option key={z.id} value={z.id}>{z.l}</option>)}</select>
              </Field>
              <Field label="Plánovaný počet balení"><input className="input" inputMode="numeric" value={n.pocet} onChange={(e) => setN({ ...n, pocet: e.target.value })} /></Field>
              <div className="flex items-end"><button className="btn btn-primary w-full" disabled={!can("vyroba")} onClick={() => f.handle(createBaleni({ produktId: n.produktId, zdrojTyp: direct ? "PACK_SUROVINA" : "POLOTOVAR", zdrojId: n.zdrojId, pocet: cnt }), "Plán balení založen.")}>Založit plán balení</button></div>
              <div className="sm:col-span-2">
                <div className="lbl mb-2">Potřeba pro {cnt || "…"} balení{pr.kapsliNaBaleni && cnt ? ` · ${nf(pr.kapsliNaBaleni * cnt)} kapslí (${pr.kapsliNaBaleni} / balení)` : ""}</div>
                <div className="grid gap-px bg-line sm:grid-cols-2">
                  {matNeed(cnt).map((m) => (
                    <div key={m.materialId} className="flex items-center justify-between bg-stock px-3 py-2 text-[12px]">
                      <span>{m.mat.nazev}</span>
                      <span className={`mono font-bold ${m.mat.mnozstvi < m.need ? "text-signal-ink" : ""}`}>{nf(m.need)} / {nf(m.mat.mnozstvi)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Panel>
        </div>

        <Panel title="Sklad obalového materiálu">
          <ul>
            {s.materialy.map((m) => {
              const low = m.mnozstvi < 200;
              return (
                <li key={m.id} className="border-b border-line px-4 py-3 last:border-0">
                  <div className="flex items-baseline justify-between gap-3"><span className="text-[13px]">{m.nazev}</span><span className={`mono text-[15px] font-extrabold ${low ? "text-signal-ink" : ""}`}>{nf(m.mnozstvi)} <span className="text-[10px] font-medium">{m.jednotka}</span></span></div>
                  <div className="mono mt-1 flex justify-between text-[10.5px] text-mute"><span>lot {m.lot}</span><span>{m.box} / {m.poz}</span></div>
                  <div className="mt-2 h-[3px] bg-line"><div className={low ? "bg-signal" : "bg-ink"} style={{ height: "100%", width: `${Math.min(100, m.mnozstvi / 24)}%` }} /></div>
                </li>
              );
            })}
          </ul>
        </Panel>
      </div>
    </>
  );
}

export function Hotove() {
  const { s, produkt, labelHotove, handover, can } = useStore();
  const f = useFlash();
  const [lab, setLab] = useState<Record<string, string>>({});
  const [sel, setSel] = useState<Record<string, string>>({});
  const [h, setH] = useState({ predal: "", prevzal: "", ref: "" });
  const cekaji = s.hotove.filter((x) => x.stav === "CEKA_ETYKETU");
  const ready = s.hotove.filter((x) => x.stav === "PRIPRAVENO_K_PREDANI");
  const done = s.hotove.filter((x) => x.stav === "PREDANO_EXPEDICI");
  return (
    <>
      <PageHead no="08" title="Hotové výrobky" sub="Etiketování mění stav a rozdělení množství, nesnižuje počet balení podruhé. Předání expedici je poslední evidovaná operace." />
      <div className="grid items-start gap-6 xl:grid-cols-2">
        <Panel title="Etiketování" right={<span className="lbl">{cekaji.length} řádků</span>}>
          {cekaji.length ? (
            <ul>
              {cekaji.map((x) => (
                <li key={x.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3 last:border-0">
                  <div><div className="text-[13px] font-semibold">{produkt(x.produktId)?.nazev}</div><div className="mono text-[11px] text-mute">{x.id} · lot {x.lot} · {x.pocet} balení · {x.box}/{x.poz}</div></div>
                  <div className="flex gap-2">
                    <input className="input !h-8 !w-20" inputMode="numeric" placeholder={String(x.pocet)} value={lab[x.id] ?? ""} onChange={(e) => setLab({ ...lab, [x.id]: e.target.value })} aria-label="Počet k etiketování" />
                    <button className="btn btn-primary btn-sm" disabled={!can("vyroba")} onClick={() => f.handle(labelHotove(x.id, Number(lab[x.id] ?? x.pocet)), "Etiketování potvrzeno.")}>Etiketovat</button>
                  </div>
                </li>
              ))}
            </ul>
          ) : <p className="p-4 text-[13px] text-mute">Nic nečeká na etiketu.</p>}
        </Panel>

        <Panel title="Připraveno k předání" right={<span className="lbl">{nf(ready.reduce((a, x) => a + x.pocet, 0))} balení</span>}>
          <ul>
            {ready.map((x) => (
              <li key={x.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
                <div><div className="text-[13px] font-semibold">{produkt(x.produktId)?.nazev}</div><div className="mono text-[11px] text-mute">{x.id} · lot {x.lot} · k dispozici {x.pocet}</div></div>
                <input className="input !h-8 !w-24" inputMode="numeric" placeholder="0" value={sel[x.id] ?? ""} onChange={(e) => setSel({ ...sel, [x.id]: e.target.value })} aria-label="Počet k předání" />
              </li>
            ))}
            {!ready.length && <li className="p-4 text-[13px] text-mute">Nic není připraveno.</li>}
          </ul>
          <div className="grid gap-3 border-t border-ink p-4 sm:grid-cols-3">
            <Field label="Předal"><input className="input" value={h.predal} onChange={(e) => setH({ ...h, predal: e.target.value })} /></Field>
            <Field label="Převzal"><input className="input" value={h.prevzal} onChange={(e) => setH({ ...h, prevzal: e.target.value })} /></Field>
            <Field label="Reference expedice"><input className="input" value={h.ref} onChange={(e) => setH({ ...h, ref: e.target.value })} placeholder="EXP-2610-07" /></Field>
            <div className="space-y-3 sm:col-span-3">
              {f.node}
              <button className="btn btn-primary w-full" disabled={!can("expedice")} onClick={() => { const r = handover({ items: ready.map((x) => ({ id: x.id, pocet: Number(sel[x.id] ?? 0) })), ...h }); f.handle(r, "Předání expedici potvrzeno. Zbytek zůstává dostupný."); if (r.ok) setSel({}); }}>Potvrdit předání expedici</button>
            </div>
          </div>
        </Panel>
      </div>

      <div className="mt-6">
        <Panel title="Předáno expedici">
          <div className="overflow-x-auto">
            <table className="tbl min-w-[640px]">
              <thead><tr><th>Řádek</th><th>Produkt</th><th>Lot</th><th>Balení</th><th>Aktualizováno</th></tr></thead>
              <tbody>{done.map((x) => <tr key={x.id}><td className="mono font-bold">{x.id}</td><td>{produkt(x.produktId)?.nazev}</td><td className="mono">{x.lot}</td><td className="mono">{x.pocet}</td><td className="mono text-[12px]">{fmtDT(x.updatedAt)}</td></tr>)}
                {!done.length && <tr><td colSpan={5} className="py-6 text-center text-mute">Zatím nic nebylo předáno.</td></tr>}</tbody>
            </table>
          </div>
          {s.predani.length > 0 && <div className="border-t border-ink p-4">{s.predani.map((p) => <div key={p.id} className="mono text-[12px]"><b>{p.id}</b> · {p.predal} → {p.prevzal} · {p.ref || "bez reference"} · {p.polozky.map((i) => `${i.pocet}× ${i.lot}`).join(", ")}</div>)}</div>}
        </Panel>
      </div>
    </>
  );
}

export function Historie() {
  const { s } = useStore();
  const [tab, setTab] = useState("m");
  const [q, setQ] = useState("");
  const has = (...v: (string | undefined)[]) => !q || v.join(" ").toLowerCase().includes(q.toLowerCase());
  return (
    <>
      <PageHead no="09" title="Historie" sub="Append-only audit. Chyby se řeší kompenzační akcí, nikdy přepisem." />
      <div className="panel mb-4 p-3"><input className="input" placeholder="Filtr: Pack_ID, akce, uživatel, reference…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <div className="panel">
        <div className="tabs" role="tablist">
          {[["m", "POHYBY_LOG"], ["q", "QR_LABEL_LOG"], ["o", "OPERATIONS_LOG"]].map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{l}</button>)}
        </div>
        <div className="overflow-x-auto">
          {tab === "m" && (
            <table className="tbl min-w-[900px]">
              <thead><tr><th>Čas</th><th>Entita</th><th>Akce</th><th>Změna</th><th>Reference</th><th>Uživatel</th></tr></thead>
              <tbody>
                {[...s.movements].reverse().filter((m) => has(m.entitaId, m.action, m.user, m.refId)).map((m) => (
                  <tr key={m.id}>
                    <td className="mono text-[12px]">{fmtDT(m.ts)}</td>
                    <td className="mono font-bold">{m.entita === "PACK" ? <a className="underline decoration-signal underline-offset-4" href={`#/pack/${m.entitaId}`}>{m.entitaId}</a> : m.entitaId}</td>
                    <td className="mono text-[12px]">{m.action}</td>
                    <td className="mono text-[12px]">{m.from && m.to ? `${m.from} → ${m.to}` : m.to ?? ""}{m.delta != null ? ` ${m.delta > 0 ? "+" : ""}${m.delta} ${m.jednotka ?? ""}` : ""}</td>
                    <td className="mono text-[12px] text-mute">{m.refId ?? ""}</td><td>{m.user}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {tab === "q" && (
            <table className="tbl min-w-[760px]">
              <thead><tr><th>Čas</th><th>Pack</th><th>Akce</th><th>Formát</th><th>Uživatel</th></tr></thead>
              <tbody>{[...s.qrLog].reverse().filter((l) => has(l.packId, l.action, l.user)).map((l) => <tr key={l.id}><td className="mono text-[12px]">{fmtDT(l.ts)}</td><td className="mono font-bold">{l.packId}</td><td className="mono text-[12px]">{l.action}</td><td className="mono">{l.format}</td><td>{l.user}</td></tr>)}</tbody>
            </table>
          )}
          {tab === "o" && (
            <table className="tbl min-w-[760px]">
              <thead><tr><th>Operation_ID</th><th>Typ</th><th>Entita</th><th>Zahájeno</th><th>Uživatel</th><th>Stav</th></tr></thead>
              <tbody>{[...s.operations].reverse().filter((o) => has(o.type, o.entityId, o.by)).map((o) => <tr key={o.id}><td className="mono text-[12px]">{o.id}</td><td className="mono text-[12px]">{o.type}</td><td className="mono">{o.entityId}</td><td className="mono text-[12px]">{fmtDT(o.started)}</td><td>{o.by}</td><td><span className="tag tag-ok">{o.status}</span></td></tr>)}</tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}

export function Nastaveni() {
  const { s, setConfig } = useStore();
  const f = useFlash();
  const [url, setUrl] = useState(s.config.APP_BASE_URL);
  const canEditConfig = s.role === "ADMIN" || s.role === "VEDOUCI";
  return (
    <>
      <PageHead no="10" title="Nastavení" sub="Konfigurace a účty. Změna APP_BASE_URL je migrační událost – už vytištěné QR štítky by mohly vést na nefunkční adresu." />
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Panel title="APP_BASE_URL">
          <div className="space-y-3 p-4">
            <Field label="Produkční URL (končí /exec)"><input className="input" value={url} onChange={(e) => setUrl(e.target.value)} /></Field>
            {f.node}
            <button className="btn btn-primary" disabled={!canEditConfig} onClick={() => f.handle(setConfig("APP_BASE_URL", url), "APP_BASE_URL uložena.")}>Uložit</button>
            {!canEditConfig && <Notice>Konfiguraci mohou měnit pouze role ADMIN a VEDOUCI.</Notice>}
            <Notice kind="info">Při neplatné nebo /dev URL je generování QR zablokováno. Při změně URL ponechte starou jako přesměrování, nebo přetiskněte štítky.</Notice>
          </div>
        </Panel>
        <Panel title="Aktuální účet">
          <div className="space-y-3 p-4">
            <div className="account-summary">
              <div className="account-avatar">{s.user.split(" ").map((part) => part[0]).slice(0, 2).join("")}</div>
              <div><div className="text-base font-bold">{s.user}</div><div className="mono mt-1 text-sm text-mute">Role: {s.role}</div></div>
            </div>
            <Notice kind="info">Změnu účtu proveďte odhlášením a novým přihlášením. Toto je demonstrační aplikace bez serverové autentizace.</Notice>
          </div>
        </Panel>
        <div className="lg:col-span-2">
          <Panel title="CONFIG">
            <table className="tbl"><tbody>{Object.entries(s.config).map(([k, v]) => <tr key={k}><td className="mono w-[300px] font-bold">{k}</td><td className="mono break-all text-[12px]">{v}</td></tr>)}</tbody></table>
          </Panel>
        </div>
      </div>
    </>
  );
}


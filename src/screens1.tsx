import { useMemo, useState } from "react";
import { NOW, POZICE, expKey, fifoWarning, nowKey, useStore, type Pack } from "./store";
import { Field, LabelBlock, Notice, PageHead, Panel, Tag, fmtD, fmtDT, go, nf, useFlash } from "./ui";

export function PozGrid({ value, onChange, packs }: { value: string; onChange: (p: string) => void; packs: Pack[] }) {
  const occ = new Map(packs.filter((p) => p.stav !== "VYPRAZDNENY").map((p) => [p.poz, p.id]));
  return (
    <div>
      <div className="grid grid-cols-10 gap-[3px]" role="group" aria-label="Pozice A1–D10">
        {POZICE.map((p) => {
          const sel = p === value;
          const o = occ.has(p);
          return (
            <button
              key={p}
              type="button"
              title={o ? `${p} · obsazeno ${occ.get(p)}` : `${p} · volné`}
              onClick={() => onChange(p)}
              className={`mono h-7 border text-[10px] font-bold transition-colors ${sel ? "border-ink bg-signal text-ink" : o ? "border-ink bg-ink text-stock hover:bg-ink-2" : "border-line bg-white hover:border-ink"}`}
            >
              {p}
            </button>
          );
        })}
      </div>
      <div className="lbl mt-2 flex gap-4">
        <span>■ obsazeno</span>
        <span className="text-signal-ink">■ vybráno</span>
        <span>□ volné</span>
      </div>
    </div>
  );
}

export function Dashboard() {
  const { s, nameOf, produkt } = useStore();
  const cnt = (st: string) => s.packs.filter((p) => p.stav === st).length;
  const warn = s.packs
    .filter((p) => p.stav !== "VYPRAZDNENY")
    .map((p) => ({ p, k: expKey(p.exp) }))
    .filter((x) => x.k !== null && x.k! <= nowKey + 12)
    .sort((a, b) => a.k! - b.k!);
  const planBy = (st: string) => s.plany.filter((p) => p.stav === st).length;
  const cekaEt = s.hotove.filter((h) => h.stav === "CEKA_ETYKETU").reduce((a, h) => a + h.pocet, 0);
  const kPredani = s.hotove.filter((h) => h.stav === "PRIPRAVENO_K_PREDANI").reduce((a, h) => a + h.pocet, 0);
  const problems = s.operations.filter((o) => o.status === "FAILED" || o.status === "RECOVERY_REQUIRED").length;

  const Kpi = ({ l, v, sub, to, hot }: { l: string; v: number | string; sub?: string; to?: string; hot?: boolean }) => (
    <button onClick={() => to && go(to)} className={`group border-r border-b border-ink p-4 text-left transition-colors hover:bg-ink hover:text-stock ${hot ? "bg-signal text-ink hover:text-signal" : "bg-stock"}`}>
      <div className="lbl !text-inherit opacity-70">{l}</div>
      <div className="mono mt-2 text-[40px] leading-none font-extrabold">{v}</div>
      {sub && <div className="mt-2 text-[11px] opacity-70">{sub}</div>}
    </button>
  );

  return (
    <>
      <PageHead no="01" title="Přehled" sub={`Stav k ${fmtDT(NOW.toISOString())}. Hmotnosti se evidují výhradně v gramech (g). Tato demo verze sleduje počáteční hmotnost packu, nikoli průběžný zbytek.`} />
      {problems > 0 && <div className="mb-4"><Notice kind="err">V OPERATIONS_LOG je {problems} operací vyžadujících zotavení.</Notice></div>}
      <div className="panel mb-6 grid grid-cols-2 border-b-0 border-r-0 lg:grid-cols-6">
        <Kpi l="Packy · nové" v={cnt("NOVY")} to="#/sklad" />
        <Kpi l="Packy · otevřené" v={cnt("OTEVRENY")} to="#/sklad" />
        <Kpi l="Packy · vyprázdněné" v={cnt("VYPRAZDNENY")} to="#/sklad" />
        <Kpi l="Plány výroby · běží" v={planBy("PROBIHA")} sub={`${planBy("NAPLANOVANO") + planBy("PRIPRAVENO")} čeká na start`} to="#/vyroba" />
        <Kpi l="Čeká na etiketu" v={nf(cekaEt)} sub="balení" to="#/hotove" hot={cekaEt > 0} />
        <Kpi l="K předání expedici" v={nf(kPredani)} sub="balení" to="#/hotove" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.25fr_1fr]">
        <Panel title="Expirace do 12 měsíců" right={<span className="lbl">{warn.length} packů</span>}>
          <table className="tbl">
            <thead><tr><th>Pack</th><th>Surovina</th><th>Lot</th><th>Exp.</th><th></th></tr></thead>
            <tbody>
              {warn.map(({ p, k }) => (
                <tr key={p.id} className="row" onClick={() => go(`#/pack/${p.id}`)}>
                  <td className="mono font-bold">{p.id}</td>
                  <td>{nameOf(p.surovinaId)}</td>
                  <td className="mono">{p.lot}</td>
                  <td className="mono">{p.exp}</td>
                  <td>{k! < nowKey ? <span className="tag tag-open">Po expiraci</span> : k! <= nowKey + 6 ? <span className="tag tag-warn">≤ 6 měs.</span> : <span className="tag tag-done">≤ 12 měs.</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        <div className="grid gap-6">
          <Panel title="Výrobní plány" right={<button className="btn btn-sm" onClick={() => go("#/vyroba")}>Otevřít</button>}>
            <ul>
              {s.plany.filter((p) => !["DOKONCENO", "ZRUSENO"].includes(p.stav)).map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5 last:border-0">
                  <div>
                    <div className="mono text-[12px] font-bold">{p.cislo}</div>
                    <div className="text-[12px] text-mute">{produkt(p.produktId)?.nazev}</div>
                  </div>
                  <Tag v={p.stav} />
                </li>
              ))}
            </ul>
          </Panel>
          <Panel title="Poslední pohyby" right={<button className="btn btn-sm" onClick={() => go("#/historie")}>Historie</button>}>
            <ul>
              {[...s.movements].reverse().slice(0, 6).map((m) => (
                <li key={m.id} className="flex items-baseline justify-between gap-3 border-b border-line px-4 py-2 last:border-0">
                  <div className="min-w-0">
                    <div className="mono truncate text-[11.5px] font-bold">{m.action}</div>
                    <div className="mono text-[11px] text-mute">{m.entitaId}</div>
                  </div>
                  <div className="mono shrink-0 text-[11px] text-mute">{fmtDT(m.ts)}</div>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
    </>
  );
}

export function Prijem() {
  const { s, receivePack, logLabel, can } = useStore();
  const f = useFlash();
  const [v, setV] = useState({ surovinaId: s.suroviny[0].id, lot: "", exp: "", hm: "", box: "", poz: "" });
  const [created, setCreated] = useState<string | null>(null);
  const pack = created ? s.packs.find((p) => p.id === created) : undefined;
  const set = (k: string, val: string) => setV((o) => ({ ...o, [k]: val }));

  const submit = () => {
    const r = receivePack({ ...v, hm: Number(v.hm.replace(",", ".")) });
    if (r.ok) { setCreated(r.value); f.ok(`Pack ${r.value} byl přijat. Štítek je připraven k tisku.`); setV((o) => ({ ...o, lot: "", exp: "", hm: "" })); }
    else f.err(r.error);
  };

  return (
    <>
      <PageHead no="02" title="Příjem packu" sub="Jeden fyzický pack = jedno Pack_ID = jeden QR štítek. ID přidělí server a už se nikdy nemění." />
      {!can("sklad") && <div className="mb-4"><Notice kind="err">Vaše role nemá oprávnění zapisovat do skladu.</Notice></div>}
      <div className="grid items-start gap-6 lg:grid-cols-[1fr_1fr]">
        <Panel title="Nová evidence">
          <div className="grid gap-4 p-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field label="Surovina">
                <select className="input" value={v.surovinaId} onChange={(e) => set("surovinaId", e.target.value)}>
                  {s.suroviny.map((x) => <option key={x.id} value={x.id}>{x.nazev}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Lot"><input className="input" value={v.lot} onChange={(e) => set("lot", e.target.value)} placeholder="MG-2610" /></Field>
            <Field label="Expirace MM/YY"><input className="input" value={v.exp} onChange={(e) => set("exp", e.target.value)} placeholder="10/28" maxLength={5} /></Field>
            <Field label="Počáteční hmotnost (g)" hint="Skladové hmotnosti se evidují výhradně v gramech.">
              <div className="weight-input"><input className="input" inputMode="decimal" aria-label="Počáteční hmotnost v gramech" value={v.hm} onChange={(e) => set("hm", e.target.value)} placeholder="20000" /><span>g</span></div>
            </Field>
            <Field label="Box_Number"><input className="input" value={v.box} onChange={(e) => set("box", e.target.value)} placeholder="B-23" /></Field>
            <Field label="Pozice"><input className="input" readOnly value={v.poz} placeholder="vyberte v mřížce" /></Field>
            <div className="sm:col-span-2"><PozGrid value={v.poz} onChange={(p) => set("poz", p)} packs={s.packs} /></div>
            <div className="space-y-3 sm:col-span-2">
              {f.node}
              <button className="btn btn-primary w-full" onClick={submit} disabled={!can("sklad")}>Přijmout pack a vygenerovat ID</button>
            </div>
          </div>
        </Panel>

        <Panel title="Štítek" right={pack && <button className="btn btn-sm" onClick={() => go(`#/pack/${pack.id}`)}>Detail packu →</button>}>
          {pack ? (
            <LabelBlock pack={pack} reprint={false} onPrint={() => logLabel(pack.id, false)} />
          ) : (
            <div className="hatch grid min-h-[320px] place-items-center p-8 text-center">
              <div>
                <div className="mono text-[44px] font-extrabold text-line">P-26-••••••</div>
                <p className="mx-auto mt-3 max-w-xs text-[13px] text-mute">Po přijetí se zde vykreslí QR lokálně v prohlížeči – bez externí služby.</p>
              </div>
            </div>
          )}
        </Panel>
      </div>
    </>
  );
}

export function Sklad() {
  const { s, nameOf } = useStore();
  const [q, setQ] = useState("");
  const [sur, setSur] = useState("");
  const [stav, setStav] = useState("");
  const [box, setBox] = useState("");
  const rows = useMemo(
    () =>
      s.packs.filter(
        (p) =>
          (!q || `${p.id} ${p.lot}`.toLowerCase().includes(q.toLowerCase())) && (!sur || p.surovinaId === sur) && (!stav || p.stav === stav) && (!box || p.box.toLowerCase().includes(box.toLowerCase())),
      ),
    [s.packs, q, sur, stav, box],
  );
  return (
    <>
      <PageHead no="03" title="Sklad surovin" sub="Jeden řádek = jeden fyzický pack. Klikněte na řádek pro detail." right={<button className="btn btn-primary" onClick={() => go("#/prijem")}>+ Příjem packu</button>} />
      <div className="panel mb-4 grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-4">
        <input className="input" placeholder="Pack_ID nebo Lot" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input" value={sur} onChange={(e) => setSur(e.target.value)}><option value="">Všechny suroviny</option>{s.suroviny.map((x) => <option key={x.id} value={x.id}>{x.nazev}</option>)}</select>
        <select className="input" value={stav} onChange={(e) => setStav(e.target.value)}><option value="">Všechny stavy</option><option value="NOVY">Nový</option><option value="OTEVRENY">Otevřený</option><option value="VYPRAZDNENY">Vyprázdněný</option></select>
        <input className="input" placeholder="Box" value={box} onChange={(e) => setBox(e.target.value)} />
      </div>
      <Panel title="Packy" right={<span className="lbl">{rows.length} / {s.packs.length}</span>}>
        <div className="overflow-x-auto">
          <table className="tbl min-w-[860px]">
            <thead><tr><th>Pack_ID</th><th>Surovina</th><th>Lot</th><th>Exp.</th><th>Poč. hm.</th><th>Stav</th><th>Umístění</th><th>FIFO</th></tr></thead>
            <tbody>
              {rows.map((p) => {
                const fw = fifoWarning(p, s.packs);
                return (
                  <tr key={p.id} className="row" onClick={() => go(`#/pack/${p.id}`)}>
                    <td className="mono font-bold">{p.id}</td>
                    <td>{nameOf(p.surovinaId)}</td>
                    <td className="mono">{p.lot}</td>
                    <td className="mono">{p.exp}</td>
                    <td className="mono weight-value">{new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 3 }).format(p.hm)} <span>g</span></td>
                    <td><Tag v={p.stav} /></td>
                    <td className="mono">{p.box} / {p.poz}</td>
                    <td className="text-[12px] text-warn">{fw}</td>
                  </tr>
                );
              })}
              {!rows.length && <tr><td colSpan={8} className="py-10 text-center text-mute">Nic neodpovídá filtru.</td></tr>}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}

export function Detail({ id }: { id: string }) {
  const { s, nameOf, produkt, can, movePack, logLabel, emptyPack, assignPack, confirmUse } = useStore();
  const f = useFlash();
  const p = s.packs.find((x) => x.id === id);
  const [moving, setMoving] = useState(false);
  const [box, setBox] = useState("");
  const [poz, setPoz] = useState("");
  const [using, setUsing] = useState(false);
  const [planSel, setPlanSel] = useState("");
  const [confirmEmpty, setConfirmEmpty] = useState(false);

  if (!p)
    return (
      <>
        <PageHead no="04" title="Pack nenalezen" />
        <Notice kind="err">Pack „{id}“ neexistuje.</Notice>
        <button className="btn mt-4" onClick={() => go("#/scan")}>Zpět na skenování</button>
      </>
    );

  const hist = [...s.movements].filter((m) => m.entitaId === p.id).reverse();
  const links = s.planPacks.filter((x) => x.packId === p.id);
  const eligible = s.plany.filter((pl) => {
    if (["DOKONCENO", "ZRUSENO"].includes(pl.stav) || links.some((l) => l.planId === pl.id)) return false;
    const rec = pl.recepturaId ? s.receptury.find((r) => r.id === pl.recepturaId) : undefined;
    return rec ? rec.surovinaIds.includes(p.surovinaId) : produkt(pl.produktId)?.surovinaId === p.surovinaId;
  });
  const fw = fifoWarning(p, s.packs);
  const empty = p.stav === "VYPRAZDNENY";
  const k = expKey(p.exp);

  return (
    <>
      <div className="lbl mb-2"><a href="#/sklad" className="hover:text-ink">← Sklad surovin</a></div>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b-2 border-ink pb-4">
        <div>
          <div className="lbl mb-1">Detail packu · načteno aktuálně z databáze</div>
          <h1 className="mono text-[34px] leading-none font-extrabold tracking-tight sm:text-[48px]">{p.id}</h1>
        </div>
        <Tag v={p.stav} />
      </header>

      <div className="mb-4"><Notice>Počáteční hmotnost packu je v gramech (g). Demo verze zbytek materiálu nepočítá, proto jej obsluha před použitím ověří fyzicky.</Notice></div>
      {k !== null && k < nowKey && !empty && <div className="mb-4"><Notice kind="err">Pack je po expiraci ({p.exp}).</Notice></div>}
      {fw && <div className="mb-4"><Notice>FIFO upozornění – {fw}. Volba packu se tím nemění.</Notice></div>}

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_1fr]">
        <div className="grid gap-6">
          <Panel title="Údaje">
            <dl className="grid grid-cols-2 gap-px bg-line">
              {[
                ["Surovina", nameOf(p.surovinaId)], ["Lot", p.lot], ["Expirace", p.exp], ["Počáteční hmotnost", `${new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 3 }).format(p.hm)} g`],
                ["Box", p.box], ["Pozice", p.poz], ["Přijato", fmtD(p.receivedAt)], ["Otevřeno", fmtD(p.openedAt)], ["Vyprázdněno", fmtD(p.emptiedAt)],
              ].map(([l, v]) => (
                <div key={l} className="bg-stock p-3"><dt className="lbl">{l}</dt><dd className="mono mt-1 text-[14px] font-bold">{v}</dd></div>
              ))}
            </dl>
          </Panel>

          <Panel title="Akce">
            <div className="space-y-4 p-4">
              {f.node}
              <div className="grid grid-cols-2 gap-3">
                <button className="btn btn-primary" disabled={!can("sklad") || empty} onClick={() => { setMoving((x) => !x); setBox(p.box); setPoz(p.poz); }}>Přesunout</button>
                <button className="btn btn-primary" disabled={!can("vyroba") || empty} onClick={() => setUsing((x) => !x)}>Použít ve výrobě</button>
                <button className="btn" disabled={!can("sklad") || empty || p.stav === "NOVY"} onClick={() => setConfirmEmpty(true)}>Potvrdit vyprázdnění</button>
                <a className="btn" href="#/historie">Historie</a>
              </div>
              {p.stav === "NOVY" && !empty && <p className="text-[11px] text-mute">Vyprázdnit lze až pack, který byl použit (stav Otevřený).</p>}
              {!can("sklad") && !can("vyroba") && <p className="text-[12px] text-signal-ink">Role READONLY – akce jsou skryté.</p>}

              {confirmEmpty && (
                <div className="border border-ink bg-[#fff3ec] p-3">
                  <p className="mb-3 text-[13px] font-semibold">Fyzicky jste ověřili, že pack je prázdný? Stav VYPRAZDNENY je konečný a nelze ho vrátit.</p>
                  <div className="flex gap-2">
                    <button className="btn btn-primary btn-sm" onClick={() => { f.handle(emptyPack(p.id), "Pack označen jako vyprázdněný."); setConfirmEmpty(false); }}>Ano, je prázdný</button>
                    <button className="btn btn-sm" onClick={() => setConfirmEmpty(false)}>Zrušit</button>
                  </div>
                </div>
              )}

              {moving && (
                <div className="space-y-3 border border-ink p-3">
                  <div className="lbl">Přesun · z {p.box} / {p.poz}</div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Cílový box"><input className="input" value={box} onChange={(e) => setBox(e.target.value)} /></Field>
                    <Field label="Cílová pozice"><input className="input" readOnly value={poz} /></Field>
                  </div>
                  <PozGrid value={poz} onChange={setPoz} packs={s.packs} />
                  <button className="btn btn-primary w-full" onClick={() => { const r = movePack(p.id, box, poz); f.handle(r, `Pack přesunut na ${box} / ${poz}. QR zůstává stejný.`); if (r.ok) setMoving(false); }}>Potvrdit přesun</button>
                </div>
              )}

              {using && (
                <div className="space-y-3 border border-ink p-3">
                  <div className="lbl">Přiřadit k výrobnímu plánu</div>
                  {eligible.length ? (
                    <div className="flex gap-2">
                      <select className="input" value={planSel} onChange={(e) => setPlanSel(e.target.value)}>
                        <option value="">— vyberte plán —</option>
                        {eligible.map((pl) => <option key={pl.id} value={pl.id}>{pl.cislo} · {produkt(pl.produktId)?.nazev}</option>)}
                      </select>
                      <button className="btn" disabled={!planSel} onClick={() => f.handle(assignPack(planSel, p.id), "Pack přiřazen. Stav packu se nezměnil – použití potvrďte níže.")}>Přiřadit</button>
                    </div>
                  ) : <p className="text-[12px] text-mute">Žádný otevřený plán nepoužívá tuto surovinu, nebo je už přiřazen.</p>}
                  <p className="text-[11px] text-mute">Plánování nemění stav. Potvrzení skutečného použití najdete v seznamu plánů níže.</p>
                </div>
              )}
            </div>
          </Panel>

          <Panel title="Výrobní plány s tímto packem">
            {links.length ? (
              <ul>
                {links.map((l) => {
                  const pl = s.plany.find((x) => x.id === l.planId);
                  const b = s.baleni.find((x) => x.id === l.planId);
                  return (
                    <li key={l.planId} className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3 last:border-0">
                      <div><div className="mono text-[12px] font-bold">{l.planId}</div><div className="text-[12px] text-mute">{pl && produkt(pl.produktId)?.nazev}{b && "balení"}</div></div>
                      <div className="flex items-center gap-2">
                        <Tag v={l.stav} />
                        {l.stav === "PLANOVANO" && can("vyroba") && <button className="btn btn-sm" onClick={() => f.handle(confirmUse(l.planId, p.id), "Použití potvrzeno.")}>Potvrdit použití</button>}
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : <p className="p-4 text-[13px] text-mute">Pack zatím není přiřazen k žádnému plánu.</p>}
          </Panel>
        </div>

        <div className="grid gap-6">
          <Panel title="QR štítek"><LabelBlock pack={p} reprint onPrint={() => logLabel(p.id, true)} /></Panel>
          <Panel title="Historie packu" right={<span className="lbl">{hist.length} událostí</span>}>
            <ul>
              {hist.map((m) => (
                <li key={m.id} className="grid grid-cols-[1fr_auto] gap-x-3 border-b border-line px-4 py-2.5 last:border-0">
                  <div className="mono text-[12px] font-bold">{m.action}</div>
                  <div className="mono text-[11px] text-mute">{fmtDT(m.ts)}</div>
                  <div className="text-[12px] text-mute">{m.from && m.to ? `${m.from} → ${m.to}` : m.to ?? m.note ?? m.refId}</div>
                  <div className="text-[11px] text-mute">{m.user}</div>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
    </>
  );
}

export function Scan() {
  const { s } = useStore();
  const [val, setVal] = useState("");
  const [err, setErr] = useState("");
  const open = () => {
    let id = val.trim();
    try { const u = new URL(id); id = u.searchParams.get("id") ?? id; } catch { /* plain id */ }
    id = id.toUpperCase();
    if (!/^P-\d{2}-\d{6}$/.test(id)) return setErr("Neplatné Pack_ID. Očekávaný tvar: P-26-000123.");
    if (!s.packs.some((p) => p.id === id)) return setErr(`Pack ${id} neexistuje.`);
    setErr(""); go(`#/pack/${id}`);
  };
  return (
    <>
      <PageHead no="05" title="Skenovat pack" sub="Skenování nic nemění – pouze otevře aktuální detail. Změnu je nutné samostatně potvrdit." />
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Panel title="Ruční vyhledání">
          <div className="space-y-3 p-4">
            <Field label="Pack_ID nebo celý odkaz z QR"><input className="input" autoFocus value={val} onChange={(e) => setVal(e.target.value)} onKeyDown={(e) => e.key === "Enter" && open()} placeholder="P-26-000103" /></Field>
            {err && <Notice kind="err">{err}</Notice>}
            <button className="btn btn-primary w-full" onClick={open}>Otevřít detail</button>
            <div>
              <div className="lbl mb-2">Naposledy použité</div>
              <div className="flex flex-wrap gap-2">
                {s.packs.filter((p) => p.stav === "OTEVRENY").slice(0, 4).map((p) => <button key={p.id} className="btn btn-sm" onClick={() => go(`#/pack/${p.id}`)}>{p.id}</button>)}
              </div>
            </div>
          </div>
        </Panel>
        <Panel title="Kamera">
          <div className="hatch grid min-h-[220px] place-items-center p-8 text-center">
            <div>
              <div className="mono mb-2 text-[13px] font-bold">QR_ENABLE_CAMERA_SCANNER = {s.config.QR_ENABLE_CAMERA_SCANNER}</div>
              <p className="mx-auto max-w-sm text-[13px] text-mute">Interní skener je při prvním nasazení vypnutý. Použijte nativní fotoaparát telefonu – QR otevře deeplink přímo na detail packu. Zapnutí až po testu na cílových zařízeních.</p>
            </div>
          </div>
        </Panel>
      </div>
    </>
  );
}

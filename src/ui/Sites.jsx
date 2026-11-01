import { useEffect, useState } from "react";
import * as DB from "../db.js";
import { CHAMPS_SITE, LIBELLES_SITE } from "../spec.js";
import { lireSites } from "../xlsx.js";
import { lireTexte } from "../util.js";
import { Champ, Modal, useApp } from "./common.jsx";

export function FicheSite({ site, onFerme }) {
  const { params, reload, toast } = useApp();
  const [v, setV] = useState(site ? { ...site } : {});
  const auteur = params.technicien_courant || "";
  const enreg = async () => {
    if (!(v.prom || v.nom)) return toast("Renseignez au moins le Prom ou le nom.");
    if (site) { const f = await DB.modifierSite(site.id, v, auteur); toast(f.length ? `${f.length} champ(s) modifié(s).` : "Aucun changement."); }
    else { await DB.creerSite(v, auteur); toast("Site créé."); }
    await reload(); onFerme();
  };
  return (
    <Modal titre={site ? "Fiche du site" : "Nouveau site"} onClose={onFerme} large>
      <div className="grille">{CHAMPS_SITE.map(([k, lib]) => <Champ key={k} label={lib}><input value={v[k] ?? ""} onChange={(e) => setV({ ...v, [k]: e.target.value })} autoCapitalize="off" /></Champ>)}</div>
      {site && <p className="aide">Dernière mise à jour : {site.maj || "—"} {site.maj_par && "par " + site.maj_par}</p>}
      <div className="rangee fin"><button className="btn" onClick={onFerme}>Annuler</button><button className="btn primaire" onClick={enreg}>Enregistrer</button></div>
    </Modal>);
}

export function Journal({ onFerme }) {
  const { reload, toast, params } = useApp();
  const [l, setL] = useState([]); const charger = async () => setL(await DB.journal());
  useEffect(() => { charger(); }, []);
  return (
    <Modal titre="Journal des modifications" onClose={onFerme} large>
      {l.length === 0 && <p>Aucune modification.</p>}
      <div className="journal">{l.slice(0, 300).map((x) => (
        <div key={x.id} className={"jl" + (x.annule ? " annule" : "")}>
          <div><b>{x.site_nom}</b> — {x.champ.startsWith("(") ? x.champ : LIBELLES_SITE[x.champ] || x.champ}</div>
          <div>{x.ancien || "∅"} → {x.nouveau || "∅"} <span className="aide">{x.date} · {x.auteur || "?"} · {x.source}</span></div>
          {!x.annule && !x.champ.startsWith("(") && x.source !== "annulation" && <button className="btn petit" onClick={async () => { await DB.annulerChangement(x.id, params.technicien_courant); await reload(); await charger(); toast("Modification annulée."); }}>Annuler</button>}
        </div>))}</div>
    </Modal>);
}

export function Fusion({ autres, onFerme }) {
  const { reload, toast, params } = useApp();
  const [ap, setAp] = useState(null), [nv, setNv] = useState({}), [df, setDf] = useState({});
  useEffect(() => { (async () => {
    const a = await DB.apercuFusion(autres); setAp(a);
    setNv(Object.fromEntries(a.nouveaux.map((_, i) => [i, true])));
    const o = {}; a.differences.forEach((x) => x.diffs.forEach((y) => { o[x.site_id + "|" + y.champ] = x.plus_recent; })); setDf(o);
  })(); }, [autres]);
  if (!ap) return null;
  const appliquer = async () => {
    const choix = { nouveaux: Object.entries(nv).filter(([, c]) => c).map(([i]) => +i), diffs: [] };
    for (const x of ap.differences) for (const y of x.diffs) if (df[x.site_id + "|" + y.champ]) choix.diffs.push([x.site_id, y.champ, y.autre]);
    const r = await DB.appliquerFusion(ap, choix, params.technicien_courant || ""); await reload();
    toast(`Fusion : ${r.ajoutes} site(s) ajouté(s), ${r.modifies} champ(s) modifié(s).`); onFerme();
  };
  return (
    <Modal titre="Fusion avec une autre base" onClose={onFerme} large>
      {!ap.nouveaux.length && !ap.differences.length && <p>Les deux bases sont identiques.</p>}
      {ap.nouveaux.length > 0 && <><h4>Nouveaux sites ({ap.nouveaux.length})</h4>
        {ap.nouveaux.map((s, i) => <label key={i} className="coche bloc"><input type="checkbox" checked={!!nv[i]} onChange={(e) => setNv({ ...nv, [i]: e.target.checked })} /> {s.prom} — {s.nom} ({s.ville})</label>)}</>}
      {ap.differences.length > 0 && <><h4>Différences ({ap.differences.length} sites)</h4><p className="aide">Pré-coché : valeurs de l'autre base lorsqu'elle est plus récente.</p>
        {ap.differences.map((x) => <div key={x.site_id} className="jl"><b>{x.nom}</b> {x.plus_recent && <span className="pastille info">autre base plus récente</span>}
          {x.diffs.map((y) => { const k = x.site_id + "|" + y.champ; return <label key={k} className="coche bloc"><input type="checkbox" checked={!!df[k]} onChange={(e) => setDf({ ...df, [k]: e.target.checked })} /> {LIBELLES_SITE[y.champ]} : <s>{y.local || "∅"}</s> → <b>{y.autre}</b></label>; })}</div>)}</>}
      <div className="rangee fin"><button className="btn" onClick={onFerme}>Annuler</button><button className="btn primaire" onClick={appliquer}>Appliquer</button></div>
    </Modal>);
}

export default function VueSites() {
  const { sites, reload, toast, params } = useApp();
  const [q, setQ] = useState(""), [fiche, setFiche] = useState(undefined), [jr, setJr] = useState(false), [fus, setFus] = useState(null);
  const liste = DB.rechercher(sites, q);
  const importer = async (f) => {
    if (!f) return;
    try {
      let lignes;
      if (/\.json$/i.test(f.name)) { setFus(DB.sitesDe(DB.lireSauvegarde(await lireTexte(f)))); return; }
      lignes = await lireSites(await f.arrayBuffer());
      if (!lignes.length) return toast("Aucun site reconnu (colonnes « Prom » et « Nom agence » attendues).");
      const r = await DB.importerSites(lignes, params.technicien_courant || ""); await reload();
      toast(`Import : ${r.ajoutes} ajouté(s), ${r.maj} mis à jour.`);
    } catch (e) { console.error(e); toast("Import impossible : " + e.message); }
  };
  return (
    <div>
      <div className="rangee barre">
        <input type="search" className="recherche" placeholder="Rechercher un site (nom, Prom, ville)…" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn primaire" onClick={() => setFiche(null)}>+ Site</button>
        <label className="btn">Importer<input hidden type="file" accept=".xlsx,.xlsm,.json" onChange={(e) => { importer(e.target.files[0]); e.target.value = ""; }} /></label>
        <button className="btn" onClick={() => setJr(true)}>Journal</button>
      </div>
      <p className="aide">{sites.length} site(s). Importer : classeur Excel ou base partagée (.json) d'un autre technicien.</p>
      <div className="liste">{liste.slice(0, 200).map((s) => (
        <button key={s.id} className="ligne" onClick={() => setFiche(s)}><b>{s.nom || "(sans nom)"}</b><span>{s.prom} · {s.code_postal} {s.ville}</span></button>))}
        {liste.length === 0 && <div className="vide">Aucun site. Importez votre base Excel ou créez un site.</div>}</div>
      {fiche !== undefined && <FicheSite site={fiche} onFerme={() => setFiche(undefined)} />}
      {jr && <Journal onFerme={() => setJr(false)} />}
      {fus && <Fusion autres={fus} onFerme={() => setFus(null)} />}
    </div>);
}

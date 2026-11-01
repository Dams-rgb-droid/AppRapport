import { useEffect, useState } from "react";
import * as DB from "../db.js";
import { NOMS_LISTES } from "../spec.js";
import { lireTexte, maintenant, telecharger } from "../util.js";
import { Carte, Champ, useApp } from "./common.jsx";
import { Fusion } from "./Sites.jsx";

export default function VueReglages() {
  const { params, listes, ipCentre, reload, toast, logo } = useApp();
  const [p, setP] = useState({ ...params }), [ipc, setIpc] = useState(Object.entries(ipCentre).map(([k, v]) => `${k}=${v}`).join("\n"));
  const [ls, setLs] = useState(Object.fromEntries(Object.entries(listes).map(([k, v]) => [k, v.join("\n")])));
  const [fus, setFus] = useState(null), [restaur, setRestaur] = useState(null), [stock, setStock] = useState("");
  useEffect(() => { (async () => {
    if (navigator.storage?.persisted) setStock((await navigator.storage.persisted()) ? "Stockage protégé : oui" : "Stockage protégé : non demandé");
  })(); }, []);
  const [urlLogo, setUrlLogo] = useState(null);
  useEffect(() => { if (!logo) return setUrlLogo(null); const u = URL.createObjectURL(logo); setUrlLogo(u); return () => URL.revokeObjectURL(u); }, [logo]);

  const enregParams = async () => {
    for (const k of ["masque", "ip_serveur_srv", "ip_serveur_siege", "decalage_passerelle", "email_destinataire", "technicien_courant", "societe"]) if (k in p) await DB.setParam(k, p[k]);
    const m = {}; for (const l of ipc.split("\n")) { const [a, ...b] = l.split("="); if (a.trim() && b.join("=").trim()) m[a.trim().toUpperCase()] = b.join("=").trim(); }
    await DB.setParam("ip_centre", m); await reload(); toast("Réglages enregistrés.");
  };
  const enregListe = async (k) => { const v = ls[k].split("\n").map((x) => x.trim()).filter(Boolean); await DB.setListe(k, v); await reload(); toast("Liste enregistrée."); };
  const sauver = async (complet) => {
    const b = await DB.exporterBase({ complet });
    await DB.setParam("derniere_sauvegarde", maintenant()); await reload();
    telecharger(b, `${complet ? "sauvegarde_complete" : "base_partagee"}_${maintenant().slice(0, 10)}.json`);
  };
  const lireFichier = async (f) => {
    try { const o = DB.lireSauvegarde(await lireTexte(f)); setRestaur(o); } catch (e) { toast(e.message); }
  };
  const logoChoisi = async (f) => {
    if (!f) return; const { reduireImage } = await import("../util.js");
    const png = /png/i.test(f.type);
    await DB.setParam("logo", png ? f : await reduireImage(f, 800, 0.9)); await reload(); toast("Logo enregistré.");
  };
  const persister = async () => { const ok = navigator.storage?.persist ? await navigator.storage.persist() : false; setStock(ok ? "Stockage protégé : oui" : "Stockage protégé : refusé par le navigateur"); };

  return (
    <div>
      <Carte titre="Technicien et société">
        <div className="grille">
          <Champ label="Technicien (ce poste)"><select value={p.technicien_courant ?? ""} onChange={(e) => setP({ ...p, technicien_courant: e.target.value })}><option value="" />{(listes.technicien || []).map((t) => <option key={t}>{t}</option>)}</select></Champ>
          <Champ label="E-mail destinataire habituel"><input type="email" value={p.email_destinataire ?? ""} onChange={(e) => setP({ ...p, email_destinataire: e.target.value })} /></Champ>
        </div>
        <div className="logo-zone">{urlLogo ? <img src={urlLogo} alt="Logo" className="logo-apercu" /> : <span className="aide">Aucun logo.</span>}
          <label className="btn">Choisir le logo<input hidden type="file" accept="image/*" onChange={(e) => { logoChoisi(e.target.files[0]); e.target.value = ""; }} /></label>
          {logo && <button className="btn danger" onClick={async () => { await DB.setParam("logo", null); await reload(); }}>Retirer</button>}</div>
      </Carte>
      <Carte titre="Réseau (valeurs par défaut)">
        <div className="grille">
          <Champ label="Masque sous-réseau"><input value={p.masque ?? ""} onChange={(e) => setP({ ...p, masque: e.target.value })} /></Champ>
          <Champ label="IP serveur siège"><input value={p.ip_serveur_siege ?? ""} onChange={(e) => setP({ ...p, ip_serveur_siege: e.target.value })} /></Champ>
          <Champ label="Décalage passerelle (dernier octet −)"><input type="number" value={p.decalage_passerelle ?? "12"} onChange={(e) => setP({ ...p, decalage_passerelle: e.target.value })} /></Champ>
          <Champ label="IP centre par centrale (NOM=IP, une par ligne)" large><textarea rows={3} value={ipc} onChange={(e) => setIpc(e.target.value)} /></Champ>
        </div>
        <div className="rangee fin"><button className="btn primaire" onClick={enregParams}>Enregistrer</button></div>
      </Carte>
      <Carte titre="Listes déroulantes (une valeur par ligne)">
        {Object.keys(NOMS_LISTES).map((k) => (
          <details key={k}><summary>{NOMS_LISTES[k]}</summary>
            <textarea rows={Math.min(12, (ls[k] || "").split("\n").length + 1)} value={ls[k] ?? ""} onChange={(e) => setLs({ ...ls, [k]: e.target.value })} />
            <div className="rangee fin"><button className="btn" onClick={() => enregListe(k)}>Enregistrer cette liste</button></div></details>))}
      </Carte>
      <Carte titre="Sauvegarde et partage">
        <p className="aide">Toutes les données restent sur cet appareil. Faites une sauvegarde régulière (Fichiers / iCloud Drive / e-mail).</p>
        <div className="rangee">
          <button className="btn primaire" onClick={() => sauver(true)}>Sauvegarde complète</button>
          <button className="btn" onClick={() => sauver(false)}>Base partageable (sans rapports)</button>
          <label className="btn">Restaurer / importer<input hidden type="file" accept=".json" onChange={(e) => { lireFichier(e.target.files[0]); e.target.value = ""; }} /></label>
          <button className="btn" onClick={persister}>Protéger le stockage</button>
        </div>
        <p className="aide">Dernière sauvegarde : {params.derniere_sauvegarde || "jamais"}. {stock}</p>
      </Carte>
      {restaur && !fus && (
        <div className="voile"><div className="modal"><div className="modal-tete"><h2>Fichier reconnu</h2></div><div className="modal-corps">
          <p>{(restaur.sites || []).length} site(s){restaur.complet ? `, ${(restaur.rapports || []).length} rapport(s)` : ""} — {restaur.date}</p>
          <div className="rangee">
            <button className="btn primaire" onClick={() => setFus(restaur.sites || [])}>Fusionner les sites</button>
            {restaur.complet && <button className="btn danger" onClick={async () => { if (confirm("Remplacer TOUTES les données de cet appareil par cette sauvegarde ?")) { await DB.restaurer(restaur); await reload(); setRestaur(null); toast("Sauvegarde restaurée."); } }}>Tout restaurer (remplace)</button>}
            <button className="btn" onClick={() => setRestaur(null)}>Annuler</button></div></div></div></div>)}
      {fus && <Fusion autres={fus} onFerme={() => { setFus(null); setRestaur(null); }} />}
    </div>);
}

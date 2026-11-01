import { useState } from "react";
import * as DB from "../db.js";
import { aujourdhui } from "../util.js";
import { uuid } from "../util.js";
import { Modal, useApp } from "./common.jsx";
import { donneesDepuisSite } from "./Form.jsx";
import { rapportVierge } from "../spec.js";
import { normaliser } from "../logic.js";

export default function VueRapports({ rapports, ouvrir, onSauvegarde }) {
  const { sites, params, ipCentre, reload, toast } = useApp();
  const [q, setQ] = useState(""), [choix, setChoix] = useState(false), [qs, setQs] = useState("");
  const jours = params.derniere_sauvegarde ? (Date.now() - new Date(params.derniere_sauvegarde.replace(" ", "T")).getTime()) / 864e5 : Infinity;
  const rappel = rapports.length > 0 && jours > 14;
  const liste = rapports.filter((r) => !q || normaliser(r.donnees.site_nom + " " + r.donnees.date_rapport + " " + r.donnees.technicien).includes(normaliser(q)));
  const creer = async (s) => {
    const base = rapportVierge(); base.date_rapport = aujourdhui(); base.technicien = params.technicien_courant || base.technicien;
    const d = donneesDepuisSite(base, s, params, ipCentre);
    const r = await DB.enregistrerRapport({ id: uuid(), site_id: s.id, donnees: d, statut: "brouillon", sig_tech: null, sig_client: null });
    setChoix(false); await reload(); ouvrir(r.id);
  };
  return (
    <div>
      {rappel && <div className="banniere"><strong>Pensez à sauvegarder vos données</strong> ({isFinite(jours) ? `dernière sauvegarde il y a ${Math.floor(jours)} jours` : "aucune sauvegarde faite"}). <button className="btn petit primaire" onClick={onSauvegarde}>Sauvegarder</button></div>}
      <div className="rangee barre">
        <input type="search" className="recherche" placeholder="Rechercher un rapport…" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn primaire" onClick={() => setChoix(true)}>+ Nouveau rapport</button>
      </div>
      <div className="liste">{liste.map((r) => (
        <div key={r.id} className="ligne ligne-r">
          <button className="ligne-corps" onClick={() => ouvrir(r.id)}><b>{r.donnees.site_nom || "(sans site)"}</b><span>{r.donnees.date_rapport || "sans date"} · {r.donnees.technicien} · modifié {r.modifie}</span></button>
          <span className={"pastille " + (r.statut === "final" ? "ok" : "neutre")}>{r.statut === "final" ? "Finalisé" : "Brouillon"}</span>
          <button className="btn petit" onClick={async () => { const n = await DB.dupliquerRapport(r.id); await reload(); toast("Rapport dupliqué."); ouvrir(n.id); }}>Dupliquer</button>
          <button className="btn petit danger" onClick={async () => { if (confirm("Supprimer ce rapport ?")) { await DB.supprimerRapport(r.id); await reload(); } }}>🗑</button>
        </div>))}
        {liste.length === 0 && <div className="vide">Aucun rapport. Appuyez sur « Nouveau rapport ».</div>}</div>
      {choix && <Modal titre="Choisir le site" onClose={() => setChoix(false)} large>
        <input type="search" autoFocus className="recherche" placeholder="Nom, Prom, ville…" value={qs} onChange={(e) => setQs(e.target.value)} />
        <div className="liste">{DB.rechercher(sites, qs).slice(0, 60).map((s) => <button key={s.id} className="ligne" onClick={() => creer(s)}><b>{s.nom}</b><span>{s.prom} · {s.code_postal} {s.ville}</span></button>)}
          {sites.length === 0 && <div className="vide">Aucun site : importez d'abord votre base (onglet Sites).</div>}</div></Modal>}
    </div>);
}

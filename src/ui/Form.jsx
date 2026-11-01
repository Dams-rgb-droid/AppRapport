import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as DB from "../db.js";
import { A_RENSEIGNER, CHAMPS_ALARME, CHAMPS_ENTETE, CHAMPS_VIDEO, COMPTE_RENDU, JOURS, MAX_ECRANS, VERIF_ALARME, VERIF_VIDEO,
  ZONES_HORAIRES, aSalleForte, cleHoraire, nombreEcrans } from "../spec.js";
import { alertes, calculerDerives, controlerHoraires, normaliserHoraire, valeurRenseignee, versionNum } from "../logic.js";
import { genererPdf } from "../pdf.js";
import { dateValide, frVersIso, isoVersFr, nomFichier, partager, reduireImage, telecharger, uuid } from "../util.js";
import { Carte, Champ, Modal, Pastille, Select, SignaturePad, useApp } from "./common.jsx";

const DERIVES_SRC = ["ip_centrale", "n_raccordement", "centrale"];
const SITE_DE = {}; // clé du rapport -> clé de la fiche site
for (const f of [...CHAMPS_ENTETE, ...CHAMPS_ALARME, ...CHAMPS_VIDEO]) if (f[4]) SITE_DE[f[0]] = f[4];

/** Valeurs d'un rapport à partir d'une fiche site (et des réglages). */
export function donneesDepuisSite(base, site, params, ipCentre) {
  const d = { ...base, site_id: site.id, site_nom: site.nom };
  for (const [k, sk] of Object.entries(SITE_DE)) d[k] = site[sk] || "";
  d.masque_centrale = params.masque; d.masque_video = params.masque; d.ip_serveur = params.ip_serveur_siege;
  Object.assign(d, calculerDerives(d, params, ipCentre, true));
  return d;
}

export default function Formulaire({ id, onFerme }) {
  const { listes, params, ipCentre, sites, reload, toast, logo } = useApp();
  const [r, setR] = useState(null), [d, setD] = useState(null), [pieces, setPieces] = useState([]);
  const [dialogue, setDialogue] = useState(null), [occupe, setOccupe] = useState(false);
  const meta = useRef(null);

  useEffect(() => { (async () => { const x = await DB.rapport(id); meta.current = x; setR(x); setD(x.donnees); setPieces(await DB.piecesDe(id)); })(); }, [id]);
  // enregistrement automatique
  const premier = useRef(true);
  useEffect(() => {
    if (!d) return; if (premier.current) { premier.current = false; return; }
    const t = setTimeout(() => DB.enregistrerRapport({ ...meta.current, donnees: d }).then((x) => { meta.current = x; }), 600);
    return () => clearTimeout(t);
  }, [d]);

  const set = useCallback((k, v) => setD((p) => {
    const n = { ...p, [k]: v };
    if (DERIVES_SRC.includes(k)) {
      const avant = calculerDerives(p, params, ipCentre, true), apres = calculerDerives(n, params, ipCentre, true);
      for (const c of Object.keys(apres)) if (!n[c] || n[c] === avant[c]) n[c] = apres[c];
    }
    if (k === "type_agence" && !aSalleForte(v)) { /* les horaires de salle forte sont conservés mais non imprimés */ }
    return n;
  }), [params, ipCentre]);
  const setSig = async (cle, val) => { meta.current = { ...meta.current, [cle]: val }; setR(meta.current); await DB.enregistrerRapport({ ...meta.current, donnees: d }); };

  const diffs = useMemo(() => {
    if (!d || !d.site_id) return [];
    const s = sites.find((x) => x.id === d.site_id); if (!s) return [];
    return Object.entries(SITE_DE).filter(([k, sk]) => valeurRenseignee(d[k]) && String(d[k]).trim() !== (s[sk] || "")).map(([k, sk]) => ({ k, sk, ancien: s[sk] || "", nouveau: String(d[k]).trim() }));
  }, [d, sites]);
  const [coches, setCoches] = useState({});
  useEffect(() => { setCoches((c) => { const n = {}; for (const x of diffs) n[x.k] = c[x.k] ?? true; return n; }); }, [diffs]);
  const majBase = async () => {
    const ch = {}; for (const x of diffs) if (coches[x.k]) ch[x.sk] = x.nouveau;
    const faits = await DB.modifierSite(d.site_id, ch, params.technicien_courant || d.technicien, "manuel");
    await reload(); toast(faits.length ? `${faits.length} donnée(s) mise(s) à jour dans la base.` : "Rien à mettre à jour.");
  };

  const versionMax = useMemo(() => Math.max(0, ...sites.map((s) => versionNum(s.version_centrale) || 0)) || null, [sites]);
  const liste = (k) => listes[k] || [A_RENSEIGNER];
  if (!d) return <div className="vide">Chargement…</div>;

  const ecrans = nombreEcrans(d.nb_ecrans), sf = aSalleForte(d.type_agence), signe = String(d.signatures_actives) !== "0";
  const bloc = () => alertes(d, { versionMax, signatures: [!!r.sig_tech, !!r.sig_client] });

  const fichierPdf = async (brouillon) => {
    const ps = await DB.piecesDe(id);
    const octets = await genererPdf({ donnees: d, pieces: ps, sigTech: r.sig_tech, sigClient: r.sig_client, logo, brouillon });
    return new Blob([octets], { type: "application/pdf" });
  };
  const produire = async (brouillon) => {
    setOccupe(true);
    try {
      const blob = await fichierPdf(brouillon);
      const nom = `Rapport_${nomFichier(d.site_nom)}_${nomFichier(d.date_rapport.replace(/\//g, "-"))}${brouillon ? "_BROUILLON" : ""}.pdf`;
      if (!brouillon) { meta.current = { ...meta.current, statut: "final", pdf_nom: nom }; setR(meta.current); await DB.enregistrerRapport({ ...meta.current, donnees: d }); }
      setDialogue({ type: "pdf", blob, nom, brouillon });
    } catch (e) { console.error(e); toast("Erreur lors de la création du PDF : " + e.message); }
    finally { setOccupe(false); }
  };
  const lancer = (brouillon) => {
    if (!brouillon) {
      if (!dateValide(d.date_rapport)) return toast("Renseignez une date valide.");
      const a = bloc();
      if (a.some((x) => x[0] === "erreur")) return setDialogue({ type: "alertes", alertes: a, bloquant: true });
      if (a.some((x) => x[0] !== "info") || a.length) return setDialogue({ type: "alertes", alertes: a, suite: () => produire(false) });
    }
    produire(brouillon);
  };

  const mes = (z, j, s) => {
    const k = cleHoraire(z, j, s), v = d[k] ?? "", ok = normaliserHoraire(v)[0];
    return <input className={"h" + (ok ? "" : " erreur")} inputMode="text" value={v} placeholder={s === "mes" ? "9h" : "18h"} aria-label={`${z} ${j} ${s}`}
      onChange={(e) => set(k, e.target.value)} onBlur={() => { const [o, n] = normaliserHoraire(d[k]); if (o && n !== d[k]) set(k, n); }} />;
  };
  const { invalides, incoherents } = controlerHoraires(d);
  const champ = ([k, lib, type, lst]) => (
    <Champ key={k} label={lib}>
      {type === "check" ? <input type="checkbox" checked={d[k] === "1"} onChange={(e) => set(k, e.target.checked ? "1" : "0")} />
        : type === "combo" ? <Select value={d[k]} options={liste(lst)} onChange={(v) => set(k, v)} />
        : type === "spin" ? <input type="number" inputMode="numeric" min="0" max={MAX_ECRANS} value={d[k]} onChange={(e) => set(k, e.target.value)} />
        : <input value={d[k] ?? ""} onChange={(e) => set(k, e.target.value)} autoCapitalize="off" autoCorrect="off" />}
    </Champ>);
  const ligneVerif = ([k, lib, mode, lst]) => {
    const present = mode === "qty" ? (parseInt(d[k] || "0", 10) || 0) > 0 : valeurRenseignee(d[k]) && !["Aucun", "Aucune"].includes(d[k]);
    const manque = mode !== "text" && present && !valeurRenseignee(d["v_" + k]);
    return (
      <div key={k} className={"verif" + (manque ? " attn" : "")}>
        <span className="lib">{lib}</span>
        {mode === "qty" ? <input type="number" inputMode="numeric" min="0" value={d[k] ?? ""} onChange={(e) => set(k, e.target.value)} aria-label={lib + " quantité"} />
          : mode === "choice" ? <Select value={d[k]} options={liste(lst)} onChange={(v) => set(k, v)} aria-label={lib} />
          : <input value={d[k] ?? ""} onChange={(e) => set(k, e.target.value)} aria-label={lib} />}
        {<Select value={d["v_" + k]} options={liste("verification")} onChange={(v) => set("v_" + k, v)} aria-label={lib + " vérification"} />}
      </div>);
  };

  // pièces jointes
  const ajouter = async (fichiers, type) => {
    let ordre = pieces.length ? Math.max(...pieces.map((p) => p.ordre)) + 1 : 0;
    for (const f of fichiers) {
      const pdf = /pdf/i.test(f.type) || /\.pdf$/i.test(f.name);
      try {
        const blob = pdf ? new Blob([await f.arrayBuffer()], { type: "application/pdf" }) : await reduireImage(f);
        await DB.enregistrerPiece({ id: uuid(), rapport_id: id, titre: f.name.replace(/\.[^.]+$/, ""), type: pdf ? "document" : type, blob, inclure: true, ordre: ordre++ });
      } catch { toast(`Fichier illisible : ${f.name}`); }
    }
    setPieces(await DB.piecesDe(id));
  };
  const majPiece = async (p, ch) => { const n = { ...p, ...ch }; await DB.enregistrerPiece(n); setPieces((l) => l.map((x) => (x.id === p.id ? n : x))); };
  const deplacer = async (i, s) => { const a = [...pieces], j = i + s; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; for (let k = 0; k < a.length; k++) { a[k] = { ...a[k], ordre: k }; await DB.enregistrerPiece(a[k]); } setPieces(a); };
  const retirer = async (p) => { await DB.supprimerPiece(p.id); setPieces((l) => l.filter((x) => x.id !== p.id)); };

  return (
    <div className="form">
      <div className="barre-haut">
        <button className="btn" onClick={onFerme}>← Rapports</button>
        <strong className="titre-site">{d.site_nom}</strong>
        <span className={"pastille " + (r.statut === "final" ? "ok" : "neutre")}>{r.statut === "final" ? "Finalisé" : "Brouillon"}</span>
      </div>

      {diffs.length > 0 && (
        <div className="banniere">
          <strong>Des données saisies diffèrent de la base. Mettre à jour la fiche du site ?</strong>
          <ul>{diffs.map((x) => (<li key={x.k}><label><input type="checkbox" checked={!!coches[x.k]} onChange={(e) => setCoches({ ...coches, [x.k]: e.target.checked })} />
            {" "}{x.k}: <s>{x.ancien || "(vide)"}</s> → <b>{x.nouveau}</b></label></li>))}</ul>
          <button className="btn primaire" onClick={majBase}>Mettre à jour la base</button>
        </div>)}

      <Carte titre="Intervention">
        <div className="grille">
          <Champ label="Date"><input type="date" value={frVersIso(d.date_rapport)} onChange={(e) => set("date_rapport", isoVersFr(e.target.value))} /></Champ>
          <Champ label="Technicien"><Select value={d.technicien} options={liste("technicien")} onChange={(v) => set("technicien", v)} /></Champ>
          <Champ label="Type d'agence"><Select value={d.type_agence} options={liste("type_agence")} onChange={(v) => set("type_agence", v)} /></Champ>
          {CHAMPS_ENTETE.map(champ)}
        </div>
      </Carte>

      <Carte titre="Identification – Système d'alarme"><div className="grille">{CHAMPS_ALARME.map(champ)}</div></Carte>
      <Carte titre="Identification – Système vidéo"><div className="grille">{CHAMPS_VIDEO.map(champ)}</div></Carte>
      <Carte titre="Vérification – Système d'alarme">
        <div className="verifs">{VERIF_ALARME.map(ligneVerif)}</div>
        {(parseInt(d.pti_hm || "0", 10) > 0 || d.imei_pti) && <Champ label="IMEI du PTI"><input value={d.imei_pti ?? ""} onChange={(e) => set("imei_pti", e.target.value)} inputMode="numeric" /></Champ>}
      </Carte>

      <Carte titre="Horaires de mise En / Hors service">
        {ZONES_HORAIRES.filter(([z]) => z !== "sf" || sf).map(([z, nom]) => (
          <div key={z} className="zone-h">
            <div className="zone-tete"><strong>{nom}</strong>
              <button className="btn petit" onClick={() => JOURS.slice(1).forEach(([j]) => ["mes", "mhs"].forEach((s) => set(cleHoraire(z, j, s), d[cleHoraire(z, "lun", s)] ?? "")))}>Copier le lundi partout</button></div>
            <div className="grille-h"><span /><b>MES</b><b>MHS</b>
              {JOURS.map(([j, n]) => (<div key={j} className="ligne-h"><span>{n}</span>{mes(z, j, "mes")}{mes(z, j, "mhs")}</div>))}</div>
          </div>))}
        {invalides.length > 0 && <p className="msg erreur">{invalides.length} horaire(s) invalide(s) — exemples valides : 9h, 9h30, 18:00, 0930, Fermé, —. Le PDF final est bloqué tant que ce n'est pas corrigé.</p>}
        {incoherents.slice(0, 4).map((m) => <p key={m} className="msg attention">{m}</p>)}
      </Carte>

      <Carte titre="Vérification – Système vidéo">
        <div className="verifs">{VERIF_VIDEO.map(ligneVerif)}</div>
        {ecrans > 0 && <>
          <h4>Écrans</h4>
          {Array.from({ length: ecrans }, (_, i) => i + 1).map((i) => (
            <div key={i} className="verif ecran">
              <span className="lib">Écran {i}</span>
              <Select value={d[`ecran_${i}_emp`] ?? A_RENSEIGNER} options={liste("ecran_emplacement")} onChange={(v) => set(`ecran_${i}_emp`, v)} aria-label={`Écran ${i} emplacement`} />
              <Select value={d[`ecran_${i}_det`] ?? A_RENSEIGNER} options={liste("ecran_detail")} onChange={(v) => set(`ecran_${i}_det`, v)} aria-label={`Écran ${i} détail`} />
              <Select value={d[`v_ecran_${i}`] ?? A_RENSEIGNER} options={liste("verification")} onChange={(v) => set(`v_ecran_${i}`, v)} aria-label={`Écran ${i} vérification`} />
            </div>))}</>}
      </Carte>

      <Carte titre="Compte rendu">
        {COMPTE_RENDU.map(([k, lib]) => (<Champ key={k} label={lib} large><textarea rows={4} value={d[k] ?? ""} onChange={(e) => set(k, e.target.value)} /></Champ>))}
      </Carte>

      <Carte titre="Pièces jointes (plans, photos, PDF)" actions={<span className="aide">{pieces.length} fichier(s)</span>}>
        <div className="rangee">
          <label className="btn primaire">📷 Prendre une photo<input hidden type="file" accept="image/*" capture="environment" onChange={(e) => { ajouter([...e.target.files], "photo"); e.target.value = ""; }} /></label>
          <label className="btn">🖼 Photos<input hidden type="file" accept="image/*" multiple onChange={(e) => { ajouter([...e.target.files], "photo"); e.target.value = ""; }} /></label>
          <label className="btn">📐 Plan / document<input hidden type="file" accept="image/*,application/pdf" multiple onChange={(e) => { ajouter([...e.target.files], "document"); e.target.value = ""; }} /></label>
        </div>
        {pieces.map((p, i) => (
          <div key={p.id} className="piece">
            {/pdf/.test(p.blob.type) ? <div className="miniature pdfi">PDF</div> : <img className="miniature" alt="" src={URL.createObjectURL(p.blob)} onLoad={(e) => URL.revokeObjectURL(e.target.src)} />}
            <div className="piece-corps">
              <input value={p.titre} onChange={(e) => majPiece(p, { titre: e.target.value })} aria-label="Légende" placeholder="Légende" />
              <div className="rangee">
                <select value={p.type} onChange={(e) => majPiece(p, { type: e.target.value })} disabled={/pdf/.test(p.blob.type)}><option value="photo">Photo (galerie)</option><option value="document">Plan / page entière</option></select>
                <label className="coche"><input type="checkbox" checked={p.inclure !== false} onChange={(e) => majPiece(p, { inclure: e.target.checked })} /> Inclure</label>
                <button className="btn petit" onClick={() => deplacer(i, -1)} aria-label="Monter">↑</button>
                <button className="btn petit" onClick={() => deplacer(i, 1)} aria-label="Descendre">↓</button>
                <button className="btn petit danger" onClick={() => retirer(p)} aria-label="Supprimer">🗑</button>
              </div></div>
          </div>))}
      </Carte>

      <Carte titre="Signatures" actions={<label className="coche"><input type="checkbox" checked={signe} onChange={(e) => set("signatures_actives", e.target.checked ? "1" : "0")} /> Faire signer ce rapport</label>}>
        {signe ? <div className="grille">
          <div className="champ large"><span>{"Technicien – " + (d.technicien === A_RENSEIGNER ? "" : d.technicien)}</span><SignaturePad valeur={r.sig_tech} onChange={(v) => setSig("sig_tech", v)} /></div>
          <Champ label="Nom du client"><input value={d.nom_client ?? ""} onChange={(e) => set("nom_client", e.target.value)} /></Champ>
          <div className="champ large"><span>Signature du client</span><SignaturePad valeur={r.sig_client} onChange={(v) => setSig("sig_client", v)} /></div>
        </div> : <p className="aide">Le bloc de signatures n'apparaîtra pas dans le PDF.</p>}
      </Carte>

      <div className="actions">
        <button className="btn" onClick={() => setDialogue({ type: "alertes", alertes: bloc(), info: true })}>Contrôler</button>
        <button className="btn" disabled={occupe} onClick={() => lancer(true)}>PDF brouillon</button>
        <button className="btn primaire" disabled={occupe || invalides.length > 0} onClick={() => lancer(false)}>{occupe ? "Création…" : "Générer le PDF final"}</button>
      </div>

      {dialogue?.type === "alertes" && (
        <Modal titre={dialogue.info ? "Contrôle du rapport" : "Points à vérifier"} onClose={() => setDialogue(null)}>
          {dialogue.alertes.length === 0 && <p>✅ Aucun point à signaler.</p>}
          <ul className="alertes">{dialogue.alertes.map(([n, m], i) => <li key={i} className={n}>{n === "erreur" ? "⛔" : n === "attention" ? "⚠️" : "ℹ️"} {m}</li>)}</ul>
          <div className="rangee fin">
            <button className="btn" onClick={() => setDialogue(null)}>{dialogue.suite ? "Corriger" : "Fermer"}</button>
            {dialogue.suite && !dialogue.bloquant && <button className="btn primaire" onClick={() => { const s = dialogue.suite; setDialogue(null); s(); }}>Générer quand même</button>}
          </div>
        </Modal>)}
      {dialogue?.type === "pdf" && (
        <Modal titre={dialogue.brouillon ? "PDF brouillon prêt" : "PDF final prêt"} onClose={() => setDialogue(null)}>
          <p>{dialogue.nom} — {(dialogue.blob.size / 1024).toFixed(0)} Ko</p>
          <div className="rangee">
            <button className="btn primaire" onClick={async () => { if (!(await partager(dialogue.blob, dialogue.nom, "Rapport d'intervention", d.site_nom))) telecharger(dialogue.blob, dialogue.nom); }}>Partager / envoyer</button>
            <button className="btn" onClick={() => telecharger(dialogue.blob, dialogue.nom)}>Télécharger</button>
            <button className="btn" onClick={() => window.open(URL.createObjectURL(dialogue.blob), "_blank")}>Ouvrir</button>
          </div>
          {params.email_destinataire && <p className="aide">Destinataire habituel : {params.email_destinataire} (choisissez Mail dans la feuille de partage).</p>}
        </Modal>)}
    </div>
  );
}

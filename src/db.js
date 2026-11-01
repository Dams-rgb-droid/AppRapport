// Stockage local (IndexedDB) : sites, journal, rapports, pièces, listes, paramètres.
import { CLES_SITE, LISTES_DEFAUT, PARAMS_DEFAUT, IP_CENTRE_DEFAUT } from "./spec.js";
import { maintenant, uuid } from "./util.js";
import { normaliser } from "./logic.js";

const NOM = "rapports_intervention";
const STORES = { sites: "id", rapports: "id", pieces: "id", listes: "cle", params: "cle", journal: "id" };
let _db = null;

export function ouvrir(nom = NOM) {
  if (_db) return Promise.resolve(_db);
  return new Promise((res, rej) => {
    const rq = indexedDB.open(nom, 1);
    rq.onupgradeneeded = () => {
      const db = rq.result;
      for (const [s, kp] of Object.entries(STORES)) {
        const st = db.createObjectStore(s, { keyPath: kp });
        if (s === "pieces") st.createIndex("rapport_id", "rapport_id");
      }
    };
    rq.onsuccess = () => { _db = rq.result; res(_db); };
    rq.onerror = () => rej(rq.error);
  });
}
const req = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
async function tx(stores, mode, fn) {
  const db = await ouvrir();
  const t = db.transaction(stores, mode);
  const out = fn(...[].concat(stores).map((s) => t.objectStore(s)));
  await new Promise((res, rej) => { t.oncomplete = res; t.onerror = () => rej(t.error); t.onabort = () => rej(t.error); });
  return out && out.then ? out : out;
}
const tous = async (s) => { const db = await ouvrir(); return req(db.transaction(s).objectStore(s).getAll()); };
const lire = async (s, k) => { const db = await ouvrir(); return req(db.transaction(s).objectStore(s).get(k)); };
const ecrire = async (s, v) => { const db = await ouvrir(); return req(db.transaction(s, "readwrite").objectStore(s).put(v)); };
const supprimer = async (s, k) => { const db = await ouvrir(); return req(db.transaction(s, "readwrite").objectStore(s).delete(k)); };

// ---------- paramètres & listes
export async function init() {
  await ouvrir();
  for (const [k, v] of Object.entries(PARAMS_DEFAUT)) if ((await lire("params", k)) === undefined) await ecrire("params", { cle: k, valeur: v });
  if ((await lire("params", "ip_centre")) === undefined) await ecrire("params", { cle: "ip_centre", valeur: { ...IP_CENTRE_DEFAUT } });
  for (const [k, v] of Object.entries(LISTES_DEFAUT)) if ((await lire("listes", k)) === undefined) await ecrire("listes", { cle: k, valeurs: [...v] });
}
export async function params() { const o = {}; for (const p of await tous("params")) o[p.cle] = p.valeur; return o; }
export const setParam = (cle, valeur) => ecrire("params", { cle, valeur });
export async function listes() { const o = {}; for (const l of await tous("listes")) o[l.cle] = l.valeurs; return o; }
export const setListe = (cle, valeurs) => ecrire("listes", { cle, valeurs });

// ---------- sites & journal
const vide = (o = {}) => { const s = {}; for (const k of CLES_SITE) s[k] = String(o[k] ?? "").trim(); return s; };
export async function sites() {
  return (await tous("sites")).sort((a, b) => (a.nom || "").localeCompare(b.nom || "", "fr", { sensitivity: "base" }));
}
export const site = (id) => lire("sites", id);
export function rechercher(liste, q) {
  const n = normaliser(q); if (!n) return liste;
  return liste.filter((s) => normaliser([s.prom, s.nom, s.ville, s.code_postal, s.adresse].join(" ")).includes(n));
}
async function journaliser(site_id, champ, ancien, nouveau, auteur, source = "manuel") {
  await ecrire("journal", { id: uuid(), site_id, champ, ancien, nouveau, auteur: auteur || "", date: maintenant(), source, annule: false });
}
export async function creerSite(donnees, auteur = "") {
  const s = { id: uuid(), ...vide(donnees), maj: maintenant(), maj_par: auteur };
  await ecrire("sites", s);
  await journaliser(s.id, "(création)", "", s.nom || s.prom, auteur);
  return s;
}
/** Applique les changements ; retourne la liste des champs réellement modifiés. */
export async function modifierSite(id, changes, auteur = "", source = "manuel") {
  const s = await lire("sites", id); if (!s) return [];
  const faits = [];
  for (const [k, v] of Object.entries(changes)) {
    if (!CLES_SITE.includes(k)) continue;
    const nv = String(v ?? "").trim();
    if ((s[k] || "") !== nv) { await journaliser(id, k, s[k] || "", nv, auteur, source); s[k] = nv; faits.push(k); }
  }
  if (faits.length) { s.maj = maintenant(); s.maj_par = auteur; await ecrire("sites", s); }
  return faits;
}
export async function supprimerSite(id) { await supprimer("sites", id); }
export async function journal(site_id = null) {
  let j = await tous("journal"); if (site_id) j = j.filter((x) => x.site_id === site_id);
  const ss = Object.fromEntries((await tous("sites")).map((s) => [s.id, s.nom || s.prom]));
  return j.sort((a, b) => b.date.localeCompare(a.date)).map((x) => ({ ...x, site_nom: ss[x.site_id] || "(supprimé)" }));
}
export async function annulerChangement(jid, auteur = "") {
  const j = await lire("journal", jid); if (!j || j.annule || j.champ.startsWith("(")) return false;
  const s = await lire("sites", j.site_id); if (!s) return false;
  s[j.champ] = j.ancien; s.maj = maintenant(); s.maj_par = auteur; await ecrire("sites", s);
  j.annule = true; await ecrire("journal", j);
  await journaliser(j.site_id, j.champ, j.nouveau, j.ancien, auteur, "annulation");
  return true;
}

// ---------- import (lignes déjà lues : dicts avec CLES_SITE) : mise à jour par prom, sinon nom
const cle = (s) => (s.prom ? "p:" + s.prom.trim().toLowerCase() : "n:" + normaliser(s.nom));
export async function importerSites(lignes, auteur = "") {
  const exist = await sites(); const idx = new Map(exist.map((s) => [cle(s), s]));
  let ajoutes = 0, maj = 0;
  for (const l of lignes) {
    const v = vide(l); if (!v.prom && !v.nom) continue;
    const e = idx.get(cle(v));
    if (!e) { const n = await creerSite(v, auteur); idx.set(cle(n), n); ajoutes++; }
    else {
      const ch = {}; for (const k of CLES_SITE) if (v[k] && v[k] !== e[k]) ch[k] = v[k];
      if ((await modifierSite(e.id, ch, auteur, "import")).length) maj++;
    }
  }
  return { ajoutes, maj };
}

// ---------- fusion avec la base d'un autre technicien
export async function apercuFusion(autres) {
  const exist = await sites(); const idx = new Map(exist.map((s) => [cle(s), s]));
  const nouveaux = [], differences = [];
  for (const a of autres) {
    const o = { ...vide(a), maj: a.maj || "" }; if (!o.prom && !o.nom) continue;
    const e = idx.get(cle(o));
    if (!e) { nouveaux.push(o); continue; }
    const diffs = CLES_SITE.filter((k) => o[k] && o[k] !== (e[k] || "")).map((k) => ({ champ: k, local: e[k] || "", autre: o[k] }));
    if (diffs.length) differences.push({ site_id: e.id, nom: e.nom || e.prom, plus_recent: (o.maj || "") > (e.maj || ""), diffs });
  }
  return { nouveaux, differences };
}
/** choix = { nouveaux: [indices], diffs: [[site_id, champ, valeur], ...] } */
export async function appliquerFusion(apercu, choix, auteur = "") {
  let n = 0, m = 0;
  for (const i of choix.nouveaux) { const s = apercu.nouveaux[i]; delete s.maj; const c = await creerSite(s, auteur); await journaliser(c.id, "(fusion)", "", c.nom, auteur, "fusion"); n++; }
  const par = {}; for (const [sid, ch, v] of choix.diffs) (par[sid] ||= {})[ch] = v;
  for (const [sid, ch] of Object.entries(par)) m += (await modifierSite(sid, ch, auteur, "fusion")).length;
  return { ajoutes: n, modifies: m };
}

// ---------- rapports & pièces
export async function rapports() { return (await tous("rapports")).sort((a, b) => (b.modifie || "").localeCompare(a.modifie || "")); }
export const rapport = (id) => lire("rapports", id);
export async function enregistrerRapport(r) { r.modifie = maintenant(); r.cree ||= r.modifie; await ecrire("rapports", r); return r; }
export async function supprimerRapport(id) { for (const p of await piecesDe(id)) await supprimer("pieces", p.id); await supprimer("rapports", id); }
export async function piecesDe(rid) {
  const db = await ouvrir();
  const l = await req(db.transaction("pieces").objectStore("pieces").index("rapport_id").getAll(rid));
  return l.sort((a, b) => a.ordre - b.ordre);
}
export const enregistrerPiece = (p) => ecrire("pieces", p);
export const supprimerPiece = (id) => supprimer("pieces", id);
export async function dupliquerRapport(id) {
  const r = await lire("rapports", id); const n = JSON.parse(JSON.stringify(r));
  n.id = uuid(); n.statut = "brouillon"; n.sig_tech = null; n.sig_client = null; n.cree = null; n.pdf_nom = "";
  n.donnees.date_rapport = ""; n.donnees.cr_observations = "";
  await enregistrerRapport(n); return n;
}

// ---------- sauvegardes
import { blobVersBase64, base64VersBlob } from "./util.js";
/** partageable = base clients + listes + réglages, sans rapports. */
export async function exporterBase({ complet }) {
  const o = { format: "rapports-intervention", version: 1, date: maintenant(), complet: !!complet,
    sites: await tous("sites"), listes: await tous("listes"), params: [] };
  for (const p of await tous("params")) o.params.push(p.valeur instanceof Blob ? { cle: p.cle, valeur: { __b64: await blobVersBase64(p.valeur), type: p.valeur.type } } : p);
  if (complet) {
    o.journal = await tous("journal"); o.rapports = await tous("rapports");
    o.pieces = [];
    for (const p of await tous("pieces")) { const q = { ...p }; if (q.blob) { q.b64 = await blobVersBase64(q.blob); q.type = q.blob.type; delete q.blob; } o.pieces.push(q); }
  }
  return new Blob([JSON.stringify(o)], { type: "application/json" });
}
export function lireSauvegarde(texte) {
  const o = JSON.parse(texte); if (o.format !== "rapports-intervention") throw new Error("Fichier de sauvegarde non reconnu.");
  return o;
}
/** Restaure une sauvegarde complète (remplace tout) */
export async function restaurer(o) {
  const db = await ouvrir();
  for (const s of Object.keys(STORES)) await req(db.transaction(s, "readwrite").objectStore(s).clear());
  for (const x of o.sites || []) await ecrire("sites", x);
  for (const x of o.listes || []) await ecrire("listes", x);
  for (const x of o.params || []) await ecrire("params", x.valeur && x.valeur.__b64 ? { cle: x.cle, valeur: base64VersBlob(x.valeur.__b64, x.valeur.type) } : x);
  for (const x of o.journal || []) await ecrire("journal", x);
  for (const x of o.rapports || []) await ecrire("rapports", x);
  for (const p of o.pieces || []) { const q = { ...p }; if (q.b64) { q.blob = base64VersBlob(q.b64, q.type); delete q.b64; } await ecrire("pieces", q); }
}
/** Fichier partagé reçu : retourne les sites pour aperçu de fusion. */
export const sitesDe = (o) => o.sites || [];
export { tous as _tous };

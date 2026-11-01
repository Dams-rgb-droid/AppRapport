// Règles de calcul et contrôles de cohérence (port de logic.py).
import { A_RENSEIGNER, COMPTE_RENDU, JOURS, VERIF_ALARME, VERIF_VIDEO, ZONES_HORAIRES, aSalleForte, cleHoraire, nombreEcrans } from "./spec.js";

const IP_RE = /^\d{1,3}(\.\d{1,3}){3}$/;
export const ipValide = (ip) => { ip = (ip || "").trim(); return IP_RE.test(ip) && ip.split(".").every((p) => +p >= 0 && +p <= 255); };
const pad3 = (n) => String(n).padStart(3, "0");

/** Passerelle = IP avec dernier octet − décalage (format 000, comme la formule Excel). */
export function passerelle(ip, decalage = 12) {
  ip = (ip || "").trim();
  if (!ipValide(ip)) return "";
  const p = ip.split(".");
  const d = parseInt(p[3], 10) - decalage;
  return d < 0 ? "" : p.slice(0, 3).join(".") + "." + pad3(d);
}
export function ipPlusUn(ip) {
  ip = (ip || "").trim();
  if (!ipValide(ip)) return "";
  const p = ip.split(".");
  return p.slice(0, 3).join(".") + "." + pad3(parseInt(p[3], 10) + 1);
}
export const numMachine = (prom) => (prom || "").trim().slice(-4);
export function versionNum(v) {
  const m = /^\s*(\d+(?:\.\d+)?)/.exec(v || "");
  return m ? parseFloat(m[1]) : null;
}
export const sansAccents = (s) => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "");
/** Minuscule, sans accents ni ponctuation — pour reconnaître les en-têtes Excel. */
export const normaliser = (s) => sansAccents(String(s ?? "")).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
export const valeurRenseignee = (v) => { const s = String(v ?? "").trim(); return !!s && s.toLowerCase() !== A_RENSEIGNER; };

export function calculerDerives(d, params, ipCentreMap, forcer = false) {
  const res = {};
  const dec = parseInt(params.decalage_passerelle || "12", 10) || 12;
  const pg = passerelle(d.ip_centrale, dec);
  if (pg && (forcer || !d.passerelle_centrale)) res.passerelle_centrale = pg;
  if (pg && (forcer || !d.passerelle_video)) res.passerelle_video = pg;
  const cen = (d.centrale || "").trim().toUpperCase();
  if (cen in ipCentreMap && (forcer || !d.ip_centre)) res.ip_centre = ipCentreMap[cen];
  const nm = numMachine(d.n_raccordement);
  if (nm && (forcer || !d.num_machine)) res.num_machine = nm;
  return res;
}

// --- horaires
const HORAIRE_RE = /^(\d{1,2})\s*(?:[hH:]\s*(\d{2})?)?$/;
/** -> [valide, valeur normalisée]. Accepte 9h, 9h30, 09:00, 18, 0930, « — », « Fermé ». */
export function normaliserHoraire(texte) {
  const t = String(texte ?? "").trim();
  if (!t) return [true, ""];
  if (["-", "—", "–"].includes(t)) return [true, "—"];
  if (["ferme", "f"].includes(sansAccents(t).toLowerCase())) return [true, "Fermé"];
  let h, mn;
  const m = HORAIRE_RE.exec(t);
  if (m) { h = +m[1]; mn = +(m[2] || 0); }
  else if (/^\d+$/.test(t) && (t.length === 3 || t.length === 4)) { h = +t.slice(0, -2); mn = +t.slice(-2); }
  else return [false, t];
  if (h > 23 || mn > 59) return [false, t];
  return [true, mn === 0 ? `${h}h` : `${h}h${String(mn).padStart(2, "0")}`];
}
export function minutesHoraire(v) {
  const [ok, n] = normaliserHoraire(v);
  const m = ok ? /^(\d{1,2})h(\d{2})?$/.exec(n) : null;
  return m ? +m[1] * 60 + +(m[2] || 0) : null;
}
/** -> { invalides: [[zone, jour, sens, valeur]], incoherents: [texte] } */
export function controlerHoraires(d) {
  const invalides = [], incoherents = [];
  for (const [zone, titre] of ZONES_HORAIRES) {
    if (zone === "sf" && !aSalleForte(d.type_agence)) continue;
    for (const [jour, nom] of JOURS) {
      const val = {};
      for (const sens of ["mes", "mhs"]) {
        const v = d[cleHoraire(zone, jour, sens)] ?? "";
        const [ok, n] = normaliserHoraire(v);
        if (!ok) invalides.push([titre, nom, sens.toUpperCase(), String(v)]);
        val[sens] = n;
      }
      if (!!val.mes !== !!val.mhs) incoherents.push(`${titre} – ${nom} : MES et MHS doivent être renseignés ensemble.`);
      else {
        const a = minutesHoraire(val.mes), b = minutesHoraire(val.mhs);
        if (a !== null && b !== null && a >= b) incoherents.push(`${titre} – ${nom} : la MES (${val.mes}) n'est pas avant la MHS (${val.mhs}).`);
      }
    }
  }
  return { invalides, incoherents };
}

const quantite = (v) => { const n = parseInt(String(v ?? "").trim() || "0", 10); return Number.isNaN(n) ? 0 : n; };

/** Contrôles avant génération du PDF -> [[niveau, message]] (erreur | attention | info). */
export function alertes(d, { versionMax = null, signatures = [true, true] } = {}) {
  const out = [];
  if (!d.site_nom) out.push(["erreur", "Aucun site sélectionné."]);
  if (!valeurRenseignee(d.technicien)) out.push(["erreur", "Le technicien n'est pas renseigné."]);
  for (const [cle, lib] of [["ip_centrale", "IP de la centrale"], ["ip_video", "IP de l'enregistreur"],
    ["passerelle_centrale", "Passerelle alarme"], ["passerelle_video", "Passerelle vidéo"],
    ["masque_centrale", "Masque alarme"], ["masque_video", "Masque vidéo"]]) {
    const v = d[cle] || "";
    if (v && !ipValide(v)) out.push(["erreur", `${lib} invalide : « ${v} ».`]);
    else if (!v && ["ip_centrale", "ip_video"].includes(cle)) out.push(["attention", `${lib} non renseignée.`]);
  }
  for (const [cle, lib] of [["type_agence", "Type d'agence"], ["modele_centrale", "Modèle de centrale"],
    ["ligne_pau", "Ligne PAU"], ["emplacement_centrale", "Emplacement de la centrale"],
    ["emplacement_video", "Emplacement vidéo"]])
    if (!valeurRenseignee(d[cle])) out.push(["attention", `« ${lib} » est encore « à renseigner ».`]);
  let nb = 0;
  for (const [cle, , mode] of [...VERIF_ALARME, ...VERIF_VIDEO.slice(0, -1)]) {
    const v = d[cle] ?? "";
    const concerne = mode === "qty" ? quantite(v) > 0 : valeurRenseignee(v) && !["Aucun", "Aucune"].includes(v);
    if (concerne && !valeurRenseignee(d["v_" + cle])) nb++;
  }
  const ecrans = nombreEcrans(d.nb_ecrans);
  for (let i = 1; i <= ecrans; i++) if (!valeurRenseignee(d[`v_ecran_${i}`])) nb++;
  if (nb) out.push(["attention", `${nb} élément(s) présent(s) sans résultat de vérification.`]);
  const defauts = [...VERIF_ALARME, ...VERIF_VIDEO].filter(([c]) => ["En défaut", "Impossible"].includes(d["v_" + c])).map((x) => x[1]);
  for (let i = 1; i <= ecrans; i++) if (["En défaut", "Impossible"].includes(d[`v_ecran_${i}`])) defauts.push(`Écran ${i}`);
  if (defauts.length) {
    out.push(["info", "Éléments en défaut / impossibles : " + defauts.slice(0, 8).join(", ") + (defauts.length > 8 ? "…" : "") +
      " — pensez à les détailler dans les observations."]);
    if (!(d.cr_observations || "").trim()) out.push(["attention", "Des défauts sont signalés mais « Observations » est vide."]);
  }
  for (const [cle, lib] of COMPTE_RENDU.slice(0, 3)) if (!(d[cle] || "").trim()) out.push(["attention", `Compte rendu « ${lib} » vide.`]);
  if (versionMax !== null) {
    const v = versionNum(d.version_centrale);
    if (v !== null && v < versionMax) out.push(["info", `Version centrale ${v} inférieure à la plus récente de la base (${versionMax}).`]);
  }
  const { invalides, incoherents } = controlerHoraires(d);
  for (const [t, n, s, v] of invalides.slice(0, 6)) out.push(["erreur", `Horaire invalide (${t} – ${n} – ${s}) : « ${v} » (exemples : 9h, 9h30, 18:00).`]);
  if (invalides.length > 6) out.push(["erreur", `… et ${invalides.length - 6} autre(s) horaire(s) invalide(s).`]);
  for (const m of incoherents.slice(0, 6)) out.push(["attention", m]);
  if (incoherents.length > 6) out.push(["attention", `… et ${incoherents.length - 6} autre(s) incohérence(s) d'horaires.`]);
  const zones = ZONES_HORAIRES.filter(([z]) => z !== "sf" || aSalleForte(d.type_agence));
  if (!zones.some(([z]) => JOURS.some(([j]) => ["mes", "mhs"].some((s) => String(d[cleHoraire(z, j, s)] || "").trim()))))
    out.push(["info", "Horaires de mise En / Hors service non renseignés."]);
  if (String(d.signatures_actives ?? "1") !== "0") {
    if (!signatures[0]) out.push(["info", "Signature du technicien absente."]);
    if (!signatures[1]) out.push(["info", "Signature du client absente."]);
  }
  return out;
}

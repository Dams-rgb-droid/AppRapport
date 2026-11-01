// Lecteur XLSX minimal (JSZip) + import des sites (port de import_excel.py).
import JSZip from "jszip";
import { CLES_SITE } from "./spec.js";
import { ipPlusUn, normaliser, numMachine } from "./logic.js";

const ent = (s) => s.replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
const colIdx = (ref) => { let n = 0; for (const c of /^[A-Z]+/.exec(ref)[0]) n = n * 26 + c.charCodeAt(0) - 64; return n - 1; };
const texteSi = (xml) => [...xml.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((m) => ent(m[1])).join("");

/** -> [{nom, lignes: [[valeurs]]}] */
export async function lireClasseur(buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const lire = async (p) => { const f = zip.file(p); return f ? f.async("string") : ""; };
  const partages = [...(await lire("xl/sharedStrings.xml")).matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => texteSi(m[1]));
  const wb = await lire("xl/workbook.xml");
  const rels = await lire("xl/_rels/workbook.xml.rels");
  const cible = {};
  for (const m of rels.matchAll(/<Relationship\b([^>]*)\/?>/g)) {
    const id = /Id="([^"]+)"/.exec(m[1]), t = /Target="([^"]+)"/.exec(m[1]);
    if (id && t) cible[id[1]] = t[1].startsWith("/") ? t[1].slice(1) : "xl/" + t[1];
  }
  const feuilles = [];
  for (const m of wb.matchAll(/<sheet\b([^>]*)\/?>/g)) {
    const nom = /name="([^"]*)"/.exec(m[1]), rid = /r:id="([^"]+)"/.exec(m[1]);
    if (!nom || !rid || !cible[rid[1]]) continue;
    const xml = await lire(cible[rid[1]]);
    const lignes = [];
    for (const r of xml.matchAll(/<row\b[^>]*?(?:\/>|>([\s\S]*?)<\/row>)/g)) {
      const row = [];
      for (const c of (r[1] || "").matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const ref = /r="([A-Z]+\d+)"/.exec(c[1]); if (!ref) continue;
        const t = (/t="(\w+)"/.exec(c[1]) || [])[1], corps = c[2] || "";
        const v = (/<v>([\s\S]*?)<\/v>/.exec(corps) || [])[1];
        let val = "";
        if (t === "s") val = partages[+v] ?? "";
        else if (t === "inlineStr") val = texteSi(corps);
        else if (t === "str" || t === "e") val = ent(v ?? "");
        else if (t === "b") val = v === "1" ? "VRAI" : "FAUX";
        else if (v !== undefined) val = ent(v);
        if (val === "" && /<f[ >]/.test(corps)) val = "=";
        row[colIdx(ref[1])] = val;
      }
      lignes.push(row);
    }
    feuilles.push({ nom: ent(nom[1]), lignes });
  }
  return feuilles;
}

const SYNONYMES = {
  prom: ["prom", "n raccordement prom"], nom: ["nom agence"], adresse: ["adresse agence", "adresse"], code_postal: ["code postal"], ville: ["ville"],
  centrale: ["centrale"],
  tel_secours: ["telephone transmetteur secours centrale", "telephone transmetteur secours", "telephone transmetteur"],
  type_reseau: ["type reseau centrale", "type reseau"],
  ip_centrale: ["adresse reseau centrale", "adresse reseau transmetteur", "adresse ip centrale"],
  port_centrale: ["port reseau centrale", "port ip transmetteur"],
  enreg_video: ["enregistreur video", "transmetteur video", "transmetteur enregistreur video"],
  ip_video: ["adresse reseau video", "adresse ip video"], port_video: ["port reseau video", "port ip video"],
  tel_pau: ["n telephone pau", "numero telephone pau", "telephone pau"],
  version_centrale: ["version centrale"], version_noyau: ["version noyau centrale"],
  mac_centrale: ["adresse mac centrale", "mac address centrale"], serie_video: ["numero de serie video", "n de serie video"],
  modele_video: ["modele video"], version_video: ["version video"], stockage_video: ["stockage video"],
  derniere_mise_a_jour: ["derniere mise a jour"], par: ["par"],
};
const INDEX = {};
for (const [champ, l] of Object.entries(SYNONYMES)) for (const s of l) INDEX[normaliser(s)] = champ;

const txt = (v) => { if (v === undefined || v === null) return ""; let s = String(v).trim(); if (/^-?\d+\.0+$/.test(s)) s = s.replace(/\.0+$/, ""); return s; };

function tableVideo(feuilles) {
  for (const f of feuilles) {
    const e = (f.lignes[0] || []).map((c) => normaliser(c));
    const iN = e.indexOf("machine strnumero"), iS = e.indexOf("machine strnumeroserie");
    if (iN < 0 || iS < 0) continue;
    const iT = e.indexOf("machine strtype"), iV = e.indexOf("machine strnumeroversion"), res = {};
    for (const r of f.lignes.slice(1)) {
      const num = txt(r[iN]); if (!num) continue;
      res[num] = [txt(r[iS]), iT >= 0 ? txt(r[iT]) : "", iV >= 0 ? txt(r[iV]) : "", txt(r[8])];
    }
    return res;
  }
  return {};
}

/** Lit un .xlsx/.xlsm -> liste de sites (clés = CLES_SITE). */
export async function lireSites(buffer) {
  const feuilles = await lireClasseur(buffer), video = tableVideo(feuilles), res = [];
  for (const f of feuilles) {
    let cols = {}, ligneEntete = -1;
    for (let i = 0; i < f.lignes.length; i++) {
      const candidates = {};
      f.lignes[i].forEach((c, j) => { const ch = INDEX[normaliser(c)]; if (ch && !(ch in candidates)) candidates[ch] = j; });
      if ("prom" in candidates && "nom" in candidates) { cols = candidates; ligneEntete = i; break; }
    }
    if (ligneEntete < 0) continue;
    for (const r of f.lignes.slice(ligneEntete + 1)) {
      const l = {}; for (const [k, i] of Object.entries(cols)) l[k] = txt(r[i]);
      if (!l.nom && !l.prom) continue;
      for (const k of CLES_SITE) l[k] ??= "";
      if (l.ip_video.startsWith("=")) l.ip_video = ipPlusUn(l.ip_centrale);
      if (Object.keys(video).length && !l.serie_video) {
        const v = video[numMachine(l.prom)];
        if (v) [l.serie_video, l.modele_video, l.version_video, l.stockage_video] = v;
      }
      res.push(l);
    }
    if (res.length) break;
  }
  return res;
}

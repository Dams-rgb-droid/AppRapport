// Génération du PDF (pdf-lib) — mise en page identique à la version Python (reportlab).
import { PDFDocument, StandardFonts, rgb, degrees } from "pdf-lib";
import { A_RENSEIGNER, CHAMPS_ALARME, CHAMPS_VIDEO, COMPTE_RENDU, JOURS, VERIF_ALARME, VERIF_VIDEO, ZONES_HORAIRES,
  aSalleForte, cleHoraire, nombreEcrans } from "./spec.js";
import { normaliserHoraire } from "./logic.js";

const mm = 72 / 25.4, W = 595.28, H = 841.89, MARGE = 15 * mm, UTILE = W - 2 * MARGE, BAS = 16 * mm;
const hex = (h) => rgb(parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255);
const NAVY = hex("#14304F"), ACCENT = hex("#1F7A8C"), CLAIR = hex("#F2F5F8"), TRAIT = hex("#D5DCE4"), TEXTE = hex("#1D2733"), GRIS = hex("#6B7785"), BLANC = rgb(1, 1, 1), ROUGE = hex("#B3261E");
const STATUTS = { "Oui": ["#1B7A3E", "#E3F4EA"], "Test": ["#1F5F9E", "#E2EEF9"], "Non": ["#9A5B00", "#FDF0D8"], "En défaut": ["#B3261E", "#FCE4E2"], "Impossible": ["#6A4C93", "#EEE7F6"] };

let F; // contexte courant : polices, page, pile
const safe = (s) => String(s ?? "").replace(/[‘’]/g, "'").replace(/[  ]/g, " ").replace(/→/g, "->").replace(/[\r\t]/g, " ")
  .split("").map((c) => (c === "\n" || F.set.has(c.codePointAt(0)) ? c : "?")).join("");
const largeur = (t, size, bold) => (bold ? F.b : F.f).widthOfTextAtSize(safe(t).replace(/\n/g, " "), size);
function wrap(t, size, width, bold) {
  const out = [];
  const coupe = (mot) => { const r = []; while (largeur(mot, size, bold) > width && mot.length > 1) { let k = mot.length; while (k > 1 && largeur(mot.slice(0, k), size, bold) > width) k--; r.push(mot.slice(0, k)); mot = mot.slice(k); } r.push(mot); return r; };
  for (const para of safe(t).split("\n")) {
    let ligne = "";
    for (const mot of para.split(" ")) {
      const essai = ligne ? ligne + " " + mot : mot;
      if (largeur(essai, size, bold) <= width) { ligne = essai; continue; }
      if (ligne) out.push(ligne);
      const morceaux = coupe(mot); ligne = morceaux.pop(); out.push(...morceaux);
    }
    out.push(ligne);
  }
  return out;
}
const dessinerTexte = (page, t, x, y, { size = 8.5, bold = false, color = TEXTE } = {}) => page.drawText(safe(t).replace(/\n/g, " "), { x, y, size, font: bold ? F.b : F.f, color });
const trait = (page, x1, y1, x2, y2, ep, color) => page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: ep, color });

// ---------- blocs : { h, w?, draw(page, x, top) }
const espace = (h) => ({ h, draw() {}, espace: true });
const pile = (blocs) => ({ h: blocs.reduce((a, b) => a + b.h, 0), draw(p, x, top) { let y = top; for (const b of blocs) { b.draw(p, x, y); y -= b.h; } } });
function colonnes(gauche, droite, ecart = 8 * mm) {
  const larg = (UTILE - ecart) / 2;
  return { h: Math.max(gauche.h, droite.h), draw(p, x, top) { gauche.draw(p, x, top); droite.draw(p, x + larg + ecart, top); } };
}
/** Texte (paragraphe) simple. */
function paragraphe(t, { size = 8.5, leading = 11, bold = false, color = TEXTE, align = "l", width = UTILE } = {}) {
  const lignes = wrap(t, size, width, bold);
  return { h: lignes.length * leading, draw(p, x, top) {
    lignes.forEach((l, i) => { const tw = largeur(l, size, bold); dessinerTexte(p, l, align === "c" ? x + (width - tw) / 2 : x, top - size - i * leading, { size, bold, color }); }); } };
}
/**
 * Tableau. rows : [{ cells:[cell|null], bg? }]; cell = { parts:[{t,size,leading,bold,color}] | t,size.., align, bg, span, pl, pr }
 * opts : { cw, pt, pb, pl, pr, lignes:(i)=>bool, avant:[colonnes], box }
 */
function tableau({ cw, rows, pt = 3, pb = 3, pl = 6, pr = 6, lignes = () => true, avant = [], box = false, epAvant = 0.8 }) {
  const total = cw.reduce((a, b) => a + b, 0);
  const info = rows.map((r) => {
    let c = 0, hmax = 0; const cells = [];
    for (const cell of r.cells) {
      if (!cell && cell !== "") { c++; continue; }
      const k = typeof cell === "string" ? { t: cell } : cell, span = k.span || 1;
      const cl = k.pl ?? pl, cr = k.pr ?? pr, wc = cw.slice(c, c + span).reduce((a, b) => a + b, 0);
      const parts = (k.parts || [k]).map((q) => { const size = q.size ?? 8.5, leading = q.leading ?? 11, bold = !!q.bold; return { ...q, size, leading, bold, lignes: wrap(q.t ?? "", size, wc - cl - cr, bold) }; });
      const h = parts.reduce((a, q) => a + q.lignes.length * q.leading, 0);
      cells.push({ c, span, wc, cl, cr, parts, h, bg: k.bg, align: k.align || "l", x: cw.slice(0, c).reduce((a, b) => a + b, 0) });
      hmax = Math.max(hmax, h); c += span;
    }
    return { cells, h: hmax + pt + pb, bg: r.bg };
  });
  const H_ = info.reduce((a, r) => a + r.h, 0);
  return { h: H_, w: total, draw(p, x, top) {
    let y = top; const traits = [];
    info.forEach((r, i) => {
      if (r.bg) p.drawRectangle({ x, y: y - r.h, width: total, height: r.h, color: r.bg });
      for (const k of r.cells) {
        if (k.bg) p.drawRectangle({ x: x + k.x, y: y - r.h, width: k.wc, height: r.h, color: k.bg });
        let cy = y - pt - (r.h - pt - pb - k.h) / 2;
        for (const q of k.parts) q.lignes.forEach((l, j) => {
          const tw = largeur(l, q.size, q.bold), aire = k.wc - k.cl - k.cr;
          const px = x + k.x + k.cl + (k.align === "c" ? (aire - tw) / 2 : 0);
          dessinerTexte(p, l, px, cy - q.size, { size: q.size, bold: q.bold, color: q.color || TEXTE }); cy -= q.leading; });
      }
      if (lignes(i)) traits.push(y - r.h);
      y -= r.h;
    });
    for (const ty of traits) trait(p, x, ty, x + total, ty, 0.4, TRAIT);
    for (const c of avant) { const cx = x + cw.slice(0, c).reduce((a, b) => a + b, 0); trait(p, cx, top, cx, top - H_, epAvant, TRAIT); }
    if (box) p.drawRectangle({ x, y: top - H_, width: total, height: H_, borderColor: TRAIT, borderWidth: 0.6 });
  } };
}

const S_LIB = { size: 8, color: GRIS }, S_VAL = { bold: true };
const val = (d, k) => String(d[k] ?? "").trim();

function titreSection(t) {
  const tb = tableau({ cw: [UTILE], pt: 4, pb: 4, pl: 8, rows: [{ cells: [{ t, size: 11, leading: 14, bold: true, color: NAVY }], bg: CLAIR }], lignes: () => false });
  return { h: tb.h, draw(p, x, top) { tb.draw(p, x, top); p.drawRectangle({ x, y: top - tb.h, width: 3, height: tb.h, color: ACCENT }); } };
}
const sousTitre = (t, larg) => tableau({ cw: [larg], pt: 4, pb: 4, pl: 8, rows: [{ cells: [{ t, size: 9.5, bold: true, color: BLANC }], bg: NAVY }], lignes: () => false });

function tableauChamps(champs, d, larg, titre) {
  const rows = champs.map((c) => {
    const v = c[2] === "check" ? (["1", "true", "True"].includes(String(d[c[0]] ?? "")) ? "Oui" : "Non") : val(d, c[0]) || "—";
    return { cells: [{ t: c[1], ...S_LIB }, { t: v, ...S_VAL }] };
  });
  return pile([sousTitre(titre, larg), tableau({ cw: [larg * 0.46, larg * 0.54], rows, pt: 2.5, pb: 2.5, pr: 4 })]);
}
const chip = (res) => (STATUTS[res] ? { t: res, bold: true, color: hex(STATUTS[res][0]), align: "c", bg: hex(STATUTS[res][1]) } : { t: "—", color: GRIS, align: "c" });
const ENT = { size: 7.5, bold: true, color: GRIS };

function tableauVerif(items, d, larg, titre, enteteValeur) {
  const rows = [{ cells: [{ t: "ÉLÉMENT", ...ENT }, { t: enteteValeur, ...ENT }, { t: "VÉRIFICATION", ...ENT }], bg: CLAIR }];
  for (const [cle, lib] of items) {
    let v = val(d, cle);
    if (cle === "pti_twig" && d.imei_pti) v = `${v || "1"}  —  IMEI : ${d.imei_pti}`;
    if (v.toLowerCase() === A_RENSEIGNER) v = "—";
    rows.push({ cells: [{ t: lib, ...S_LIB }, { t: v || "—", ...S_VAL }, chip(val(d, "v_" + cle))] });
  }
  return pile([sousTitre(titre, larg), tableau({ cw: [larg * 0.46, larg * 0.24, larg * 0.30], rows, pt: 1.8, pb: 1.8 })]);
}
function tableauEcrans(d, larg) {
  const n = nombreEcrans(d.nb_ecrans); if (!n) return espace(0);
  const ent = { size: 6.8, bold: true, color: GRIS };
  const rows = [{ cells: ["ÉCRAN", "EMPLACEMENT", "DÉTAIL", "VÉRIFICATION"].map((t) => ({ t, ...ent })), bg: CLAIR }];
  const v = (k) => { const x = val(d, k); return !x || x.toLowerCase() === A_RENSEIGNER ? "—" : x; };
  for (let i = 1; i <= n; i++) {
    const emp = `ecran_${i}_emp` in d ? v(`ecran_${i}_emp`) : v(`ecran_${i}_info`);
    rows.push({ cells: [{ t: `Écran ${i}`, ...S_LIB }, { t: emp, ...S_VAL }, { t: v(`ecran_${i}_det`), ...S_VAL }, chip(val(d, `v_ecran_${i}`))] });
  }
  const titre = "ÉCRANS" + (["1", "true", "True"].includes(String(d.ecran_incivilites ?? "")) ? " — dont écran anti-incivilités" : "");
  return pile([espace(3 * mm), sousTitre(titre, larg), tableau({ cw: [larg * 0.15, larg * 0.30, larg * 0.30, larg * 0.25], rows, pt: 1.8, pb: 1.8, pl: 4, pr: 2 })]);
}
function tableauHoraires(d) {
  const zones = ZONES_HORAIRES.filter(([z]) => z !== "sf" || aSalleForte(d.type_agence));
  const l0 = [""], l1 = [{ t: "JOUR", ...ENT }], avant = [];
  zones.forEach(([, titre], k) => {
    l0.push({ t: titre.toUpperCase(), size: 8.5, bold: true, color: BLANC, align: "c", span: 2 });
    l1.push({ t: "MES", ...ENT, align: "c" }, { t: "MHS", ...ENT, align: "c" }); avant.push(1 + 2 * k);
  });
  const rows = [{ cells: l0, bg: NAVY }, { cells: l1, bg: CLAIR }];
  for (const [j, nom] of JOURS) {
    const c = [{ t: nom, ...S_LIB }];
    for (const [z] of zones) for (const s of ["mes", "mhs"]) { const v = normaliserHoraire(d[cleHoraire(z, j, s)])[1]; c.push(v ? { t: v, bold: true, align: "c" } : { t: "—", align: "c" }); }
    rows.push({ cells: c });
  }
  const reste = (UTILE - 30 * mm) / (2 * zones.length);
  return tableau({ cw: [30 * mm, ...Array(2 * zones.length).fill(reste)], rows, pt: 2, pb: 2, avant, lignes: (i) => i >= 1 });
}
function compteurs(d) {
  let ok = 0, defaut = 0;
  const cles = [...VERIF_ALARME, ...VERIF_VIDEO].map((x) => x[0]);
  for (let i = 1; i <= nombreEcrans(d.nb_ecrans); i++) cles.push(`ecran_${i}`);
  for (const c of cles) { const r = d["v_" + c]; if (r === "Oui" || r === "Test") ok++; else if (["En défaut", "Impossible", "Non"].includes(r)) defaut++; }
  return [ok, defaut];
}
function bandeauResume(d) {
  const [ok, defaut] = compteurs(d), larg = UTILE / 3 - 3 * mm;
  const boite = (v, texte, fg, bg) => tableau({ cw: [larg], pt: 3, pb: 3, lignes: () => false, rows: [
    { cells: [{ t: String(v), size: 17, leading: 20, bold: true, color: hex(fg), align: "c" }], bg }, { cells: [{ t: texte, size: 8, color: GRIS, align: "c" }], bg }] });
  const b = [boite(ok, "vérifications conformes", "#1B7A3E", hex("#E3F4EA")), boite(defaut, "défauts / anomalies", defaut ? "#B3261E" : "#6B7785", defaut ? hex("#FCE4E2") : CLAIR),
    boite(["1", "true", "True"].includes(String(d.ntp ?? "")) ? "Oui" : "Non", "synchro NTP vidéo", "#14304F", CLAIR)];
  return { h: b[0].h, draw(p, x, top) { b.forEach((q, i) => q.draw(p, x + i * (larg + 4.5 * mm), top)); } };
}
function carteSite(d) {
  const adresse = [d.adresse || "", `${d.code_postal || ""} ${d.ville || ""}`.trim()].filter(Boolean).join(", ");
  const type = !d.type_agence || d.type_agence === A_RENSEIGNER ? "—" : d.type_agence;
  const cel = (lib, v) => ({ parts: [{ t: lib, ...S_LIB }, { t: v || "—", ...S_VAL }] });
  return tableau({ cw: [UTILE * 0.22, UTILE * 0.38, UTILE * 0.24, UTILE * 0.16], pt: 6, pb: 6, pl: 8, box: true, lignes: () => false,
    rows: [{ cells: [cel("Site", d.site_nom), cel("Adresse", adresse), cel("Type d'agence", type), cel("N° raccordement", d.site_prom ?? d.n_raccordement)] }] });
}
function boiteSignature(titre, nom, img, larg) {
  const hImg = 17 * mm, h = 6 + 11 + hImg + 11 + 6;
  return { h, draw(p, x, top) {
    p.drawRectangle({ x, y: top - h, width: larg, height: h, borderColor: TRAIT, borderWidth: 0.6 });
    dessinerTexte(p, titre, x + 8, top - 6 - 7.5, { size: 7.5, bold: true, color: GRIS });
    if (img) { const e = Math.min((larg - 16) / img.width, hImg / img.height); p.drawImage(img, { x: x + 8, y: top - 6 - 11 - img.height * e, width: img.width * e, height: img.height * e }); }
    dessinerTexte(p, nom || " ", x + 8, top - 6 - 11 - hImg - 8, S_LIB);
  } };
}
function dataUrlBytes(u) { const b = atob(u.split(",")[1]); const a = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) a[i] = b.charCodeAt(i); return a; }
const embed = (pdf, bytes, type) => (/png/i.test(type) ? pdf.embedPng(bytes) : pdf.embedJpg(bytes));

// ---------- pages
function pastille(page, x, y, w, h, r) {
  page.drawSvgPath(`M ${r} 0 H ${w - r} Q ${w} 0 ${w} ${r} V ${h - r} Q ${w} ${h} ${w - r} ${h} H ${r} Q 0 ${h} 0 ${h - r} V ${r} Q 0 0 ${r} 0 Z`, { x, y: y + h, color: BLANC });
}
function nouvellePage(premiere) {
  const p = F.pdf.addPage([W, H]); F.pages.push(p); F.page = p; const d = F.d, n = F.pages.length;
  if (premiere) {
    p.drawRectangle({ x: 0, y: H - 30 * mm, width: W, height: 30 * mm, color: NAVY });
    p.drawRectangle({ x: 0, y: H - 31.2 * mm, width: W, height: 1.2 * mm, color: ACCENT });
    let x = MARGE;
    if (F.logo) {
      const { img } = F.logo, e = Math.min(21 * mm / img.height, 38 * mm / img.width), lw = img.width * e, lh = img.height * e, pad = 2 * mm;
      const bas = H - 30 * mm + (30 * mm - (lh + 2 * pad)) / 2;
      pastille(p, MARGE, bas, lw + 2 * pad, lh + 2 * pad, 2 * mm);
      p.drawImage(img, { x: MARGE + pad, y: bas + pad, width: lw, height: lh }); x = MARGE + lw + 2 * pad + 6 * mm;
    }
    dessinerTexte(p, "Rapport de visite préventive", x, H - 14 * mm, { size: 20, bold: true, color: BLANC });
    dessinerTexte(p, F.logo ? "Intrusion · contrôle d'accès · vidéo" : "Sécurité électronique — intrusion · contrôle d'accès · vidéo", x, H - 21.5 * mm, { size: 10.5, color: hex("#C9D6E3") });
    const dt = `Date : ${d.date_rapport || ""}`, tc = `Technicien : ${!d.technicien || d.technicien === A_RENSEIGNER ? "—" : d.technicien}`;
    dessinerTexte(p, dt, W - MARGE - largeur(dt, 11, true), H - 13 * mm, { size: 11, bold: true, color: BLANC });
    dessinerTexte(p, tc, W - MARGE - largeur(tc, 10, false), H - 20 * mm, { size: 10, color: BLANC });
    F.y = H - 31.2 * mm - 4 * mm;
  } else {
    p.drawRectangle({ x: 0, y: H - 11 * mm, width: W, height: 11 * mm, color: NAVY });
    dessinerTexte(p, "Rapport de visite préventive", MARGE, H - 7 * mm, { size: 9.5, bold: true, color: BLANC });
    const t = `${d.site_nom || ""}  ·  ${d.date_rapport || ""}`; dessinerTexte(p, t, W - MARGE - largeur(t, 9.5, false), H - 7 * mm, { size: 9.5, color: BLANC });
    F.y = H - 11 * mm - 6 * mm;
  }
  F.haut = F.y;
  // pied de page
  if (F.brouillon) { const t = "BROUILLON — document non finalisé"; dessinerTexte(p, t, (W - largeur(t, 8, true)) / 2, 8 * mm, { size: 8, bold: true, color: ROUGE }); }
  trait(p, MARGE, 12 * mm, W - MARGE, 12 * mm, 0.5, TRAIT);
  dessinerTexte(p, `${d.site_nom || ""} — rapport du ${d.date_rapport || ""}`, MARGE, 8 * mm, { size: 8, color: GRIS });
  const pg = `Page ${n}`; dessinerTexte(p, pg, W - MARGE - largeur(pg, 8, false), 8 * mm, { size: 8, color: GRIS });
  if (F.brouillon) { // filigrane : texte centré, pivoté de 52°, sous le contenu
    const t = "BROUILLON", tw = F.b.widthOfTextAtSize(t, 110), a = (52 * Math.PI) / 180;
    p.drawText(t, { x: W / 2 + (-tw / 2) * Math.cos(a) + 35 * Math.sin(a), y: H / 2 + (-tw / 2) * Math.sin(a) - 35 * Math.cos(a), size: 110, font: F.b, color: ROUGE, opacity: 0.1, rotate: degrees(52) });
  }
}
function poser(b) {
  if (F.y - b.h < BAS && F.y !== F.haut) nouvellePage(false);
  b.draw(F.page, MARGE, F.y); F.y -= b.h;
}
const pageSuivante = () => nouvellePage(false);

/**
 * @param {object} o { donnees, pieces:[{titre,type,blob,inclure,ordre}], sigTech, sigClient (dataURL|null), logo (Blob|null), brouillon }
 * @returns {Promise<Uint8Array>}
 */
export async function genererPdf({ donnees: d, pieces = [], sigTech = null, sigClient = null, logo = null, brouillon = false }) {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Rapport de visite préventive — ${d.site_nom || ""}`); pdf.setAuthor(d.technicien || ""); pdf.setProducer("Rapports de visite préventive");
  const f = await pdf.embedFont(StandardFonts.Helvetica), b = await pdf.embedFont(StandardFonts.HelveticaBold);
  F = { pdf, f, b, set: new Set(f.getCharacterSet()), d, brouillon, pages: [], page: null, y: 0, haut: 0, logo: null };
  if (logo) { try { F.logo = { img: await embed(pdf, new Uint8Array(await logo.arrayBuffer()), logo.type) }; } catch { F.logo = null; } }
  nouvellePage(true);

  poser(espace(2 * mm)); poser(carteSite(d)); poser(espace(4 * mm)); poser(bandeauResume(d)); poser(espace(5 * mm));
  const larg = (UTILE - 8 * mm) / 2;
  poser(pile([titreSection("Identification des systèmes"), espace(3 * mm),
    colonnes(tableauChamps(CHAMPS_ALARME, d, larg, "SYSTÈME D'ALARME"), tableauChamps(CHAMPS_VIDEO, d, larg, "SYSTÈME VIDÉO"))]));
  poser(espace(6 * mm));
  poser(pile([titreSection("Vérifications"), espace(3 * mm),
    colonnes(tableauVerif(VERIF_ALARME, d, larg, "SYSTÈME D'ALARME", "QUANTITÉ / PRÉSENCE"),
      pile([tableauVerif(VERIF_VIDEO, d, larg, "SYSTÈME VIDÉO — CAMÉRAS", "QUANTITÉ"), tableauEcrans(d, larg)]))]));
  poser(espace(6 * mm));
  poser(pile([titreSection("Système d'alarme — Horaires de mise En / Hors service"), espace(3 * mm), tableauHoraires(d)]));
  poser(espace(6 * mm));
  let premier = true;
  for (const [cle, lib] of COMPTE_RENDU) {
    const texte = val(d, cle); if (!texte && cle === "cr_observations") continue;
    const sec = pile([paragraphe(lib, { size: 9.5, leading: 13, bold: true, color: ACCENT }), espace(1 * mm), paragraphe(texte || "—", { size: 9, leading: 12.5, bold: true && false }), espace(3 * mm)]);
    poser(premier ? pile([titreSection("Compte rendu"), espace(2 * mm), sec]) : sec); premier = false;
  }
  if (String(d.signatures_actives ?? "1") !== "0") {
    const l2 = (UTILE - 6 * mm) / 2; let ti = null, ci = null;
    try { if (sigTech) ti = await pdf.embedPng(dataUrlBytes(sigTech)); } catch {} try { if (sigClient) ci = await pdf.embedPng(dataUrlBytes(sigClient)); } catch {}
    const g = boiteSignature("SIGNATURE DU TECHNICIEN", d.technicien === A_RENSEIGNER ? "" : d.technicien, ti, l2), c = boiteSignature("SIGNATURE DU CLIENT", d.nom_client, ci, l2);
    poser(pile([espace(3 * mm), { h: g.h, draw(p, x, top) { g.draw(p, x, top); c.draw(p, x + l2 + 6 * mm, top); } }]));
  }

  // ----- annexes
  const inclus = pieces.filter((x) => x.inclure !== false && x.blob).sort((a, z) => a.ordre - z.ordre);
  const estPdf = (x) => /pdf/i.test(x.blob.type);
  const photos = inclus.filter((x) => x.type === "photo" && !estPdf(x)), docsImg = inclus.filter((x) => x.type !== "photo" && !estPdf(x)), docsPdf = inclus.filter(estPdf);
  const titreAnnexe = (t) => paragraphe(t, { size: 13, leading: 16, bold: true, color: NAVY });
  if (photos.length) {
    pageSuivante(); poser(titreAnnexe("Annexe — Photos")); poser(espace(4 * mm));
    const lg = (UTILE - 6 * mm) / 2, cel = [];
    for (const ph of photos) {
      let im = null; try { im = await embed(pdf, new Uint8Array(await ph.blob.arrayBuffer()), ph.blob.type); } catch {}
      const cap = paragraphe(ph.titre || "", { size: 8.5, color: GRIS, align: "c", width: lg + 3 * mm });
      const e = im ? Math.min(lg / im.width, 68 * mm / im.height) : 0, ih = im ? im.height * e : 0;
      cel.push({ h: ih + 1.5 * mm + cap.h, draw(p, x, top) { if (im) p.drawImage(im, { x: x + (lg + 3 * mm - im.width * e) / 2, y: top - ih, width: im.width * e, height: ih }); cap.draw(p, x, top - ih - 1.5 * mm); } });
    }
    for (let i = 0; i < cel.length; i += 2) {
      const a = cel[i], z = cel[i + 1], h = Math.max(a.h, z ? z.h : 0) + 6 * mm;
      poser({ h, draw(p, x, top) { a.draw(p, x, top); if (z) z.draw(p, x + lg + 3 * mm, top); } });
    }
  }
  for (const a of docsImg) {
    pageSuivante(); poser(titreAnnexe(a.titre || "Document")); poser(espace(3 * mm));
    try {
      const im = await embed(pdf, new Uint8Array(await a.blob.arrayBuffer()), a.blob.type), e = Math.min(UTILE / im.width, (H - 2 * MARGE - 40 * mm) / im.height);
      poser({ h: im.height * e, draw(p, x, top) { p.drawImage(im, { x: x + (UTILE - im.width * e) / 2, y: top - im.height * e, width: im.width * e, height: im.height * e }); } });
    } catch { poser(paragraphe("(document illisible)", { size: 8.5, color: GRIS })); }
  }
  const fusion = [];
  for (const a of docsPdf) { try { fusion.push(await PDFDocument.load(await a.blob.arrayBuffer(), { ignoreEncryption: true })); } catch {} }
  for (const src of fusion) for (const pg of await pdf.copyPages(src, src.getPageIndices())) pdf.addPage(pg);
  return pdf.save();
}

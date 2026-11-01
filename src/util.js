export const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => { const r = (Math.random() * 16) | 0; return (c === "x" ? r : (r & 3) | 8).toString(16); }));
const p2 = (n) => String(n).padStart(2, "0");
export const maintenant = () => { const d = new Date(); return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`; };
export const aujourdhui = () => { const d = new Date(); return `${p2(d.getDate())}/${p2(d.getMonth() + 1)}/${d.getFullYear()}`; };
export const frVersIso = (s) => { const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s || ""); return m ? `${m[3]}-${m[2]}-${m[1]}` : ""; };
export const isoVersFr = (s) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ""); return m ? `${m[3]}/${m[2]}/${m[1]}` : ""; };
export const dateValide = (s) => { const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s || ""); if (!m) return false; const d = new Date(+m[3], +m[2] - 1, +m[1]); return d.getDate() === +m[1] && d.getMonth() === +m[2] - 1; };
export const nomFichier = (t) => (String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w-]+/g, "_").replace(/^_+|_+$/g, "") || "rapport");

export function telecharger(blob, nom) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = nom; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
/** Feuille de partage du système (iPad / Android) avec le fichier joint ; false si non disponible. */
export async function partager(blob, nom, titre, texte = "") {
  const file = new File([blob], nom, { type: blob.type || "application/pdf" });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: titre, text: texte }); return true; }
    catch (e) { if (e && e.name === "AbortError") return true; return false; }
  }
  return false;
}
export const lireTexte = (file) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsText(file); });
export const blobVersBase64 = (blob) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1] || ""); r.onerror = () => rej(r.error); r.readAsDataURL(blob); });
export function base64VersBlob(b64, type) { const bin = atob(b64); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new Blob([u], { type }); }
export const dataUrlVersBytes = (url) => { const b = atob(url.split(",")[1]); const u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; };

/** Réduit une image (rotation EXIF appliquée, fond blanc) -> Blob JPEG. */
export async function reduireImage(file, maxPx = 1800, qualite = 0.85) {
  let bmp;
  try { bmp = await createImageBitmap(file, { imageOrientation: "from-image" }); }
  catch { bmp = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = URL.createObjectURL(file); }); }
  const w0 = bmp.width, h0 = bmp.height, ech = Math.min(1, maxPx / Math.max(w0, h0));
  const c = document.createElement("canvas");
  c.width = Math.round(w0 * ech); c.height = Math.round(h0 * ech);
  const g = c.getContext("2d");
  g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height);
  g.drawImage(bmp, 0, 0, c.width, c.height);
  if (bmp.close) bmp.close();
  return new Promise((res) => c.toBlob(res, "image/jpeg", qualite));
}

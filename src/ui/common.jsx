import { createContext, useContext, useEffect, useRef, useState } from "react";
export const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);

export function Modal({ titre, children, onClose, large }) {
  return (
    <div className="voile" onMouseDown={(e) => e.target === e.currentTarget && onClose && onClose()}>
      <div className={"modal" + (large ? " large" : "")} role="dialog" aria-label={titre}>
        <div className="modal-tete"><h2>{titre}</h2>{onClose && <button className="btn nu" onClick={onClose} aria-label="Fermer">✕</button>}</div>
        <div className="modal-corps">{children}</div>
      </div>
    </div>
  );
}
export const Carte = ({ titre, children, actions, id }) => (
  <section className="carte" id={id}><header><h3>{titre}</h3>{actions}</header>{children}</section>
);
export const Champ = ({ label, children, large }) => (<label className={"champ" + (large ? " large" : "")}><span>{label}</span>{children}</label>);

export function Select({ value, options, onChange, ...rest }) {
  const opts = options.includes(value) || value === "" || value == null ? options : [value, ...options];
  return (<select value={value ?? ""} onChange={(e) => onChange(e.target.value)} {...rest}>{value === "" || value == null ? <option value="" /> : null}{opts.map((o) => <option key={o} value={o}>{o}</option>)}</select>);
}
export const Pastille = ({ v }) => {
  const c = { "Oui": "ok", "Non": "ko", "En défaut": "ko", "Impossible": "warn", "Test": "info" }[v] || "neutre";
  return <span className={"pastille " + c}>{v || "—"}</span>;
};

export function SignaturePad({ valeur, onChange, hauteur = 180 }) {
  const ref = useRef(null), dessin = useRef(false), dernier = useRef(null);
  useEffect(() => {
    const c = ref.current, g = c.getContext("2d"); g.clearRect(0, 0, c.width, c.height);
    if (valeur) { const i = new Image(); i.onload = () => g.drawImage(i, 0, 0, c.width, c.height); i.src = valeur; }
  }, []); // eslint-disable-line
  const pos = (e) => { const r = ref.current.getBoundingClientRect(); return [((e.clientX - r.left) / r.width) * ref.current.width, ((e.clientY - r.top) / r.height) * ref.current.height]; };
  const bas = (e) => { e.preventDefault(); ref.current.setPointerCapture(e.pointerId); dessin.current = true; dernier.current = pos(e); };
  const bouge = (e) => {
    if (!dessin.current) return; const g = ref.current.getContext("2d"), p = pos(e), l = dernier.current;
    g.lineWidth = 3; g.lineCap = "round"; g.lineJoin = "round"; g.strokeStyle = "#111";
    g.beginPath(); g.moveTo(l[0], l[1]); g.lineTo(p[0], p[1]); g.stroke(); dernier.current = p;
  };
  const haut = () => { if (!dessin.current) return; dessin.current = false; onChange(ref.current.toDataURL("image/png")); };
  const effacer = () => { const c = ref.current; c.getContext("2d").clearRect(0, 0, c.width, c.height); onChange(null); };
  return (
    <div className="sig">
      <canvas ref={ref} width={800} height={Math.round(hauteur * 800 / 400)} style={{ height: hauteur }} onPointerDown={bas} onPointerMove={bouge} onPointerUp={haut} onPointerCancel={haut} />
      <button className="btn petit" type="button" onClick={effacer}>Effacer</button>
    </div>
  );
}

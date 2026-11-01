import { useCallback, useEffect, useState } from "react";
import * as DB from "../db.js";
import { Ctx } from "./common.jsx";
import Formulaire from "./Form.jsx";
import VueRapports from "./Rapports.jsx";
import VueSites from "./Sites.jsx";
import VueReglages from "./Reglages.jsx";
import { maintenant, telecharger } from "../util.js";

const ONGLETS = [["rapports", "Rapports", "📝"], ["sites", "Sites", "🏢"], ["reglages", "Réglages", "⚙️"]];

export default function App() {
  const [prêt, setPrêt] = useState(false), [vue, setVue] = useState("rapports"), [ouvert, setOuvert] = useState(null);
  const [st, setSt] = useState({ params: {}, listes: {}, sites: [], rapports: [], logo: null }), [msg, setMsg] = useState("");
  const reload = useCallback(async () => {
    const p = await DB.params();
    setSt({ params: p, listes: await DB.listes(), sites: await DB.sites(), rapports: await DB.rapports(), logo: p.logo instanceof Blob ? p.logo : null });
  }, []);
  useEffect(() => { (async () => { await DB.init(); await reload(); setPrêt(true); if (navigator.storage?.persist) navigator.storage.persist().catch(() => {}); })(); }, [reload]);
  const toast = useCallback((t) => { setMsg(t); clearTimeout(toast.t); toast.t = setTimeout(() => setMsg(""), 4500); }, []);
  if (!prêt) return <div className="vide">Chargement…</div>;
  const ctx = { ...st, ipCentre: st.params.ip_centre || {}, reload, toast };
  const sauvegarder = async () => { telecharger(await DB.exporterBase({ complet: true }), `sauvegarde_complete_${maintenant().slice(0, 10)}.json`); await DB.setParam("derniere_sauvegarde", maintenant()); reload(); };
  return (
    <Ctx.Provider value={ctx}>
      <div className="app">
        {!ouvert && <nav className="nav">{ONGLETS.map(([k, t, i]) => <button key={k} className={vue === k ? "actif" : ""} onClick={() => setVue(k)}><span>{i}</span>{t}</button>)}</nav>}
        <main>
          {ouvert ? <Formulaire id={ouvert} onFerme={() => { setOuvert(null); reload(); }} />
            : vue === "rapports" ? <VueRapports rapports={st.rapports} ouvrir={setOuvert} onSauvegarde={sauvegarder} />
            : vue === "sites" ? <VueSites /> : <VueReglages key={JSON.stringify(st.params.derniere_sauvegarde)} />}
        </main>
        {msg && <div className="toast" role="status">{msg}</div>}
      </div>
    </Ctx.Provider>);
}

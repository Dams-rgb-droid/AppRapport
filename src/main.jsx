import { createRoot } from "react-dom/client";
import App from "./ui/App.jsx";
import "./ui/styles.css";
createRoot(document.getElementById("racine")).render(<App />);
if ("serviceWorker" in navigator) addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));

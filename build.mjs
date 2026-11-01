import { build } from "esbuild"; import fs from "fs";
fs.mkdirSync("dist", { recursive: true });
await build({ entryPoints: ["src/main.jsx"], bundle: true, minify: true, format: "esm", outfile: "dist/app.js", jsx: "automatic", loader: { ".css": "css" },
  define: { "process.env.NODE_ENV": '"production"' }, target: ["es2020", "safari15"], logLevel: "info" });
const fichiersStatiques = fs.existsSync("public") ? "public" : "dist";
for (const f of ["index.html", "manifest.webmanifest", "sw.js", "icons"]) {
  if (!fs.existsSync(`${fichiersStatiques}/${f}`)) throw new Error(`Fichier statique manquant : ${fichiersStatiques}/${f}`);
}
if (fichiersStatiques === "public") {
  for (const f of fs.readdirSync("public")) fs.cpSync("public/" + f, "dist/" + f, { recursive: true });
}
// service worker : version = empreinte des fichiers
import crypto from "crypto";
const h = crypto.createHash("sha1"); for (const f of ["app.js", "app.css", "index.html"]) h.update(fs.readFileSync("dist/" + f));
const sw = fs.readFileSync("dist/sw.js", "utf8");
const marqueurVersion = /rapports-(?:__VERSION__|[a-f0-9]{10})/;
if (!marqueurVersion.test(sw)) throw new Error("Version du service worker introuvable dans dist/sw.js");
const versionne = sw.replace(marqueurVersion, `rapports-${h.digest("hex").slice(0, 10)}`);
fs.writeFileSync("dist/sw.js", versionne);

import { build } from "esbuild"; import fs from "fs";
fs.mkdirSync("dist", { recursive: true });
await build({ entryPoints: ["src/main.jsx"], bundle: true, minify: true, format: "esm", outfile: "dist/app.js", jsx: "automatic", loader: { ".css": "css" },
  define: { "process.env.NODE_ENV": '"production"' }, target: ["es2020", "safari15"], logLevel: "info" });
for (const f of fs.readdirSync("public")) fs.cpSync("public/" + f, "dist/" + f, { recursive: true });
// service worker : version = empreinte des fichiers
import crypto from "crypto";
const h = crypto.createHash("sha1"); for (const f of ["app.js", "app.css", "index.html"]) h.update(fs.readFileSync("dist/" + f));
fs.writeFileSync("dist/sw.js", fs.readFileSync("dist/sw.js", "utf8").replace("__VERSION__", h.digest("hex").slice(0, 10)));

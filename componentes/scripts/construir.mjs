// SPDX-License-Identifier: MPL-2.0
// Construye un módulo JavaScript por componente a partir de src/<nombre>.cljs.
// Dentro de claude.ai una página solo puede cargar módulos JS de npm (vía jsDelivr), así que cada
// componente se publica como:  export default { clase, version, autor, licencia, doc, fuente }
// y además dist/indice.mjs con la lista de todos.
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(join(raiz, "package.json"), "utf8"));
const autor = typeof pkg.author === "string" ? pkg.author : (pkg.author && pkg.author.name) || "";
mkdirSync(join(raiz, "dist"), { recursive: true });

const leerCampo = (fuente, campo) => {
  const m = fuente.match(new RegExp(":" + campo + "\\s+\"((?:[^\"\\\\]|\\\\.)*)\""));
  return m ? m[1].replace(/\\"/g, '"') : null;
};

const indice = [];
for (const archivo of readdirSync(join(raiz, "src")).filter((f) => f.endsWith(".cljs")).sort()) {
  const fuente = readFileSync(join(raiz, "src", archivo), "utf8");
  const clase = leerCampo(fuente, "clase");
  if (!clase) throw new Error(archivo + ": falta :clase \"…\"");
  const nombre = archivo.replace(/\.cljs$/, "");
  const licencia = leerCampo(fuente, "licencia") || pkg.license || "";
  const comp = { clase, version: pkg.version, autor, licencia, doc: leerCampo(fuente, "doc") || "", fuente };
  writeFileSync(join(raiz, "dist", nombre + ".mjs"),
    "// Generado por scripts/construir.mjs a partir de src/" + archivo + "\nexport default " + JSON.stringify(comp, null, 2) + ";\n");
  indice.push({ clase, licencia, doc: comp.doc, archivo: nombre + ".mjs" });
  console.log("✓ " + clase + " → dist/" + nombre + ".mjs");
}
writeFileSync(join(raiz, "dist", "indice.mjs"),
  "// Generado por scripts/construir.mjs\nexport default " + JSON.stringify({ paquete: pkg.name, version: pkg.version, componentes: indice }, null, 2) + ";\n");

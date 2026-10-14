# Paquetes oficiales de Kairotic

*[Read in English](README.md)*

Los componentes que no son estructurales viven fuera del núcleo, en paquetes por categorías,
publicados en npm bajo el ámbito `@kairotic` y servidos dentro de claude.ai por jsDelivr.

| Paquete | Clases |
|---|---|
| [`@kairotic/synth`](synth/) | `adsr~ [a d s r]` una envolvente que sigue una puerta · `synth~` un sintetizador polifónico |
| [`@kairotic/spatial`](spatial/) | `pan~ [posición]` panorama estéreo · `space~ [x y]` colocación binaural alrededor de quien escucha |
| [`@kairotic/controls`](controls/) | `knob [mín máx inicial] [log] [nombre]` un control giratorio con su propia vista en el patch |

Previstos: `cac`, `notation`.

## En una obra

Escribir una clase de un paquete (`adsr~ 20 300 0.5 800`) en una obra que no lo tiene trae el paquete
entero a la obra, como **una** caja `component` fijada a su versión. La obra queda completa y suena
igual aunque el paquete cambie después. También se puede traer a mano:

```clojure
(packages)                         ; los paquetes oficiales y sus clases
(add-package! "@kairotic/synth")
(import! "npm:@kairotic/synth@0.1.1/dist/index.mjs")
```

## Escribir para un paquete

Un archivo por componente en `<paquete>/src/`, una expresión ClojureScript que se evalúa a una
definición (a menudo `(let [utilidades …] {…})`). Usa el núcleo solo a través de la
[API de Kairotic](../core/kairotic/api.cljs), `api/…`, y lleva su propio código de AudioWorklet si lo
necesita (`api/worklet-node`). Cada paquete declara para qué versión de la API se escribió
(`"kairotic": {"api": 1}` en su `package.json`).

```sh
node packages/build.mjs          # todos → <paquete>/dist/{<componente>.mjs, index.mjs}
node packages/build.mjs synth    # uno
```

`dist/index.mjs` es el paquete entero (lo que importa una obra); `dist/<componente>.mjs` es cada
componente por separado, para `(import! …)` de una sola clase.

## Publicar

Un release de GitHub con la etiqueta `<paquete>-vX.Y.Z` (`synth-v0.1.0`) publica ese paquete
([workflow](../.github/workflows/publish-packages.yml)), con publicación de confianza (sin tokens).
npm solo deja configurar un publicador de confianza en un paquete que ya existe, así que la primera
versión de cada paquete se publica a mano una vez.

Licencia: [MPL-2.0](../LICENSE).

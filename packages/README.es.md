# Paquetes oficiales de Kairotic

*[Read in English](README.md)*

Los componentes que no son estructurales viven fuera del núcleo, en paquetes por categorías,
publicados en npm bajo el ámbito `@kairotic` y servidos dentro de claude.ai por jsDelivr.

| Paquete | Clases |
|---|---|
| [`@kairotic/synth`](synth/) | `adsr~ [a d s r]` una envolvente que sigue una puerta · `synth~` un sintetizador polifónico · `gendy~ [freq x-step y-min y-max y-step breakpoints]` un oscilador estocástico dinámico, a partir de Xenakis |
| [`@kairotic/spatial`](spatial/) | `pan~ [posición]` panorama estéreo · `space~ [x y]` colocación binaural alrededor de quien escucha |
| [`@kairotic/controls`](controls/) | `knob [mín máx inicial] [log] [nombre]` un control giratorio con su propia vista en el patch · `keyboard [grave teclas] [hold]` un teclado MIDI virtual con velocidad y acordes, para synth~ y faust~ |
| [`@kairotic/analysis`](analysis/) | `features~ [ms] [descriptor …]` descriptores (rms, centroid, flatness, mfcc… con Meyda) · `pitch~ [lo hi]` la altura, por YIN · `onset~ [umbral] [ms]` los comienzos de los sonidos · `chroma~` las 12 clases de altura · `spectrum~ [lo hi]` el espectro, dibujado · `transcribe [bpm] [notes|glide]` lo que oye pitch~, en un freqt · `form~ [segundos] [paso] [núcleo]` autosimilitud: dónde empiezan los segmentos, el periodo que se repite · `monitor [segundos] [nombre …]` cualquier flujo de mensajes, dibujado en el tiempo |
| [`@kairotic/data`](data/) | `fetch [json\|text\|edn] [live]` lo que hay en una URL, traído como tarea y guardado en la obra · `edn [ancho alto]` cualquier valor como un árbol que se abre, se lee y del que se elige |
| [`@kairotic/theory`](theory/) | `pcclock [notas]` un conjunto de clases de altura en la esfera del reloj, su forma prima, vector interválico y simetrías · `fourier [notas]` los seis coeficientes de Fourier de una distribución de clases de altura · `tonnetz [notas]` las tríadas en el Tonnetz y el camino de la armonía — dibujados en el patch, y se pueden pulsar |
| [`@kairotic/patterns`](patterns/) | `pbind [semilla] [repeticiones] [loop]` un pattern como datos EDN, con generadores `#pat/…` y azar sembrado · `pattern [semilla] [repeticiones] [loop]` un pattern como código Clojure (secuencias perezosas, como en Overtone) · `player [bpm] [quant]` lo toca con su propio reloj, paso a paso o en una posición en beats |
| [`@kairotic/spectral`](spectral/) | `shift~ [factor …]` transporte de altura en tiempo real, un intervalo o un acorde entero (razones, semitonos, cents), conservando los formantes — stftPitchShift en WebAssembly |

Previstos: `cac`, `notation`.

## En una obra

Escribir una clase de un paquete (`adsr~ 20 300 0.5 800`) en una obra que no lo tiene trae el paquete
entero a la obra, como **una** caja `component` fijada a su versión. La obra queda completa y suena
igual aunque el paquete cambie después. También se puede traer a mano:

```clojure
(packages)                         ; los paquetes oficiales y sus clases
(add-package! "@kairotic/synth")
(import! "npm:@kairotic/synth@0.2.0/dist/index.mjs")
```

## Escribir para un paquete

Un archivo por componente en `<paquete>/src/`, una expresión ClojureScript que se evalúa a una
definición (a menudo `(let [utilidades …] {…})`). Usa el núcleo solo a través de la
[API de Kairotic](../core/kairotic/api.cljs), `api/…`, y lleva su propio código de AudioWorklet si lo
necesita (`api/worklet-node`). Lo que es demasiado grande para viajar en un código fuente, como un
WebAssembly, va en `<paquete>/assets/`: el build lo copia en `dist/`, y el componente lo carga con
`api/import-module` desde npm en la versión del propio paquete (el build comprueba que la versión que
nombra es la del paquete), o de la copia de la página (`kairotic/packages/<paquete>/`). Cada paquete declara para qué versión de la API se escribió
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

# kairotic-componentes

Componentes para [Kairotic](../README.md). Cada componente es un archivo `src/<nombre>.cljs` cuya
fuente es una definición en ClojureScript con el mismo contrato que los del núcleo:

```clojure
{:clase "quinta"
 :licencia "MPL-2.0"
 :doc "Añade una quinta justa (3/2) sobre cada frecuencia, como voz propia."
 :io [2 2]
 :recibir (fn [{:keys [entrada valor estado args at]}]
            {:salidas [[0 valor]] :estado … :luego [[at entrada valor]]})}
```

`:licencia` es un identificador [SPDX](https://spdx.org/licenses/) (si falta, se usa el del paquete).
`npm run build` genera `dist/<nombre>.mjs` (`export default {clase, version, autor, licencia, doc, fuente}`) y
`dist/indice.mjs`. Dentro de claude.ai una página solo puede cargar módulos JavaScript de npm a través
de jsDelivr, así que este es el formato publicado. En una obra se importa con:

```clojure
(importar "npm:kairotic-componentes@0.2.0/dist/quinta.mjs")
```

La importación **copia** la definición en una caja `componente` de la obra (con una cabecera de
origen): la obra queda completa y suena igual aunque el paquete cambie.

## Vista propia en el patch

Un componente puede dibujarse en el patch y responder a gestos (desde Kairotic Controles, ensayo 8).
La vista se describe con datos —figuras, no HTML— para que una clase escrita por cualquiera no pueda
inyectar marcado y siga el tema claro u oscuro de la página:

```clojure
{:tam [72 78]                                   ; ancho y alto de la vista
 :dibujo (fn [{:keys [vista args w h]}]          ; vista = lo último que la caja devolvió como :vista
           [[:arco {:cx 36 :cy 33 :r 23 :desde -135 :hasta 45 :trazo :acento :grosor 5}]
            [:texto {:x 36 :y 72 :ancla :medio} "440"]])
 :gesto (fn [{:keys [inicio dy fino]}] …)        ; devuelve el valor que llega a la entrada 0 de la caja
 :recibir (fn [{:keys [valor]}] {:salidas [[0 valor]] :vista valor})}
```

Figuras: `:rect` `:circulo` `:linea` `:arco` `:ruta` `:texto`; colores de la paleta `:tinta`
`:suave` `:acento` `:kairos` `:fondo` `:rejilla` en `:trazo` y `:relleno` (ver `nucleo/kairotic/figuras.cljs`).

## Publicar una versión

1. Sube la versión en `package.json` (`0.1.0` → `0.2.0`).
2. Crea y sube una etiqueta `componentes-v0.2.0`.
3. La Action `publicar-componentes` construye `dist/` y publica en npm con *trusted publishing* (OIDC, sin tokens). Si npm deja la versión en espera, se aprueba en npmjs.com → Staged Packages.

## Componentes

| clase | qué hace |
|---|---|
| `quinta` | añade una quinta justa sobre cada frecuencia, como voz propia |
| `deriva` | desafina cada frecuencia con un paseo aleatorio lento, distinto por voz |
| `perilla` | mando giratorio con vista propia: rango lineal o logarítmico, y nombre de parámetro opcional |

## Licencia

MPL-2.0 (ver [LICENSE](../LICENSE)). Cada componente declara la suya con `:licencia`.

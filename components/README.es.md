# kairotic-components

*[Read in English](README.md)*

Componentes para [Kairotic](../README.es.md). Cada componente es un archivo `src/<nombre>.cljs`
cuya fuente es una definición en ClojureScript con el mismo contrato que los del núcleo, escrita
por secciones (about · arguments · logic · view). Ver la guía
[Escribir un componente](../docs/writing-a-component.es.md).

`npm run build` genera `dist/<nombre>.mjs` (`export default {class, version, author, license, doc, source}`)
y `dist/index.mjs`. Dentro de claude.ai una página solo puede cargar módulos JavaScript de npm a
través de jsDelivr, así que este es el formato publicado. En una obra:

```clojure
(import! "npm:kairotic-components@0.1.0/dist/knob.mjs")
```

La importación **copia** la definición en una caja `component` de la obra (con una cabecera de
origen): la obra queda completa y suena igual aunque el paquete cambie.

## Componentes

| clase | qué hace |
|---|---|
| `knob` | mando giratorio con vista propia: rango lineal o logarítmico, nombre de parámetro opcional |
| `fifth` | añade una quinta justa sobre cada frecuencia, como voz propia |
| `drift` | desafina cada frecuencia con un paseo aleatorio lento, distinto por voz |

## Publicar una versión

1. Sube la versión en `package.json`.
2. Crea un release en GitHub con la etiqueta `components-vX.Y.Z` sobre `main`.
3. La Action `publish-components` construye `dist/` y publica en npm con *trusted publishing*
   (OIDC, sin tokens).

Este paquete sustituye a `kairotic-componentes` (nombres en castellano, hasta el Ensayo 8).

## Licencia

MPL-2.0 (ver [LICENSE](../LICENSE)). Cada componente declara la suya con `:license`.

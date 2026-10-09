# kairotic-componentes

Componentes para [Kairotic](../README.md). Cada componente es un archivo `src/<nombre>.cljs` cuya
fuente es una definición en ClojureScript con el mismo contrato que los del núcleo:

```clojure
{:clase "quinta"
 :doc "Añade una quinta justa (3/2) sobre cada frecuencia, como voz propia."
 :io [2 2]
 :recibir (fn [{:keys [entrada valor estado args at]}]
            {:salidas [[0 valor]] :estado … :luego [[at entrada valor]]})}
```

`npm run build` genera `dist/<nombre>.mjs` (`export default {clase, version, autor, doc, fuente}`) y
`dist/indice.mjs`. Dentro de claude.ai una página solo puede cargar módulos JavaScript de npm a través
de jsDelivr, así que este es el formato publicado. En una obra se importa con:

```clojure
(importar "npm:kairotic-componentes@0.1.0/dist/quinta.mjs")
```

La importación **copia** la definición en una caja `componente` de la obra (con una cabecera de
origen): la obra queda completa y suena igual aunque el paquete cambie.

## Publicar una versión

1. Sube la versión en `package.json` (`0.1.0` → `0.2.0`).
2. Crea y sube una etiqueta `componentes-v0.2.0`.
3. La Action `publicar-componentes` construye `dist/` y publica en npm (necesita el secreto `NPM_TOKEN`).

## Componentes

| clase | qué hace |
|---|---|
| `quinta` | añade una quinta justa sobre cada frecuencia, como voz propia |
| `deriva` | desafina cada frecuencia con un paseo aleatorio lento, distinto por voz |

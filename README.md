# Kairotic

Un espacio colaborativo visual-acústico para improvisación, composición e interpretación musical:
un patcher donde **código y patch son la misma obra**, con una historia ramificada y compartida,
lienzos de frecuencia sobre tiempo, partituras, cajas de código (Faust, ClojureScript) y
componentes que cualquiera puede escribir y compartir.

*kairos* + *chaotic*: el momento oportuno y la divergencia de líneas temporales.

## Principios

- **Datos primero.** La obra es EDN; cada gesto es un evento que se escribe como código.
- **Dos vistas, una obra.** Código (REPL al estilo CAD/CAC) y patch (su representación gráfica).
- **Historia ramificada y colaborativa.** Un árbol de eventos; se bifurca ante gestos simultáneos o vueltas atrás, y las ramas se pueden mezclar.
- **Representación y lectura separadas.** Un lienzo es solo frecuencia sobre tiempo; su organización temporal la da quien lo lee.
- **Componentes.** Cada clase de caja es un mapa de datos y funciones con un contrato común; las cajas de código son la base para crear otros.
- **Estático.** ClojureScript interpretado con [Scittle](https://github.com/babashka/scittle) (sin compilar), dependencias desde CDN y WebAssembly (Faust, Verovio).

## Estructura

```
nucleo/kairotic/      módulos actuales del sistema (ClojureScript)
  componentes.cljs    registro de componentes y clases del núcleo
  motor.cljs          ejecución: mensajes, cola temporal sobre el reloj de audio, nodos Web Audio
  lienzo.cljs         buffer gráfico frecuencia × tiempo, rejillas, afinaciones Scala
  partitura.cljs      modelo de voz, MEI para Verovio, relación tiempo ⇄ espacio
  codigo.cljs         cajas de código: compiladores por lenguaje, script (ClojureScript)
  faust.cljs          faust~: Faust compilado en el navegador (faustwasm) como AudioWorklet
  biblioteca.cljs     caja componente, importación de componentes publicados
ensayos/NN-nombre/    cada ensayo tal como se publicó (index.html + sus módulos)
componentes/          paquete npm kairotic-componentes (src/*.cljs → dist/*.mjs)
pruebas/              pruebas de viabilidad (Faust en artefactos, qué se puede cargar)
```

## Ensayos

| | Ensayo | Qué valida |
|---|---|---|
| 1 | Patcher | código ⇄ patch, EDN, REPL |
| 2 | Historia | árbol de eventos colaborativo, frente, simultaneidad, mezcla, salas |
| 3 | Partitura | piano roll y notación (Verovio) sincronizados por tiempo ⇄ espacio |
| 4 | Patch | editores como cajas del patch, una voz por caja |
| 5 | Lienzo | frecuencia × tiempo, rejillas y Scala; lector, rampa, pasos; motor de mensajes |
| 6 | Componentes | registro de componentes; cajas de código: faust~ y script |
| 7 | Biblioteca | componentes definidos en la obra, biblioteca compartida, importación |

## Probarlo

Los ensayos se publicaron como artefactos de claude.ai, que aportan la base de datos y las salas
compartidas. Fuera de claude.ai funcionan en **modo local** (sin guardar ni compartir):

```sh
cd ensayos/07-biblioteca && python3 -m http.server 8000
# abre http://localhost:8000 y elige «Probar en local, sin guardar»
```

## Componentes

Ver [`componentes/`](componentes/README.md). Dentro de una obra se importan con
`(importar "npm:kairotic-componentes@0.1.0/dist/quinta.mjs")`; dentro de claude.ai solo se pueden
cargar módulos JavaScript de npm a través de jsDelivr, por eso los componentes se publican así.

# Tutoriales

*[English version](README.md)*

Los tutoriales son lecciones que se abren dentro de Kairotic (pestaña Help, o `(tutorial "id")` en la
REPL). Una lección es una obra local construida paso a paso: cada paso hace sus gestos y deja un punto
en la historia. La barra de lección muestra la nota del paso en que estás, en castellano o en inglés;
◀ ▶ viajan entre pasos; cambiar algo en cualquier paso abre una rama tuya, y la lección sigue en su línea.

## Itinerarios

| itinerario | |
|---|---|
| `patch-code` | Patch ⇄ código |
| `theory` | Notación y teoría |
| `composition` | Composición y CAC |
| `dsp` | Electroacústica y DSP |
| `faust` | Faust |

## Escribir uno

Un archivo Markdown por tutorial, en la carpeta de su itinerario: `docs/tutorials/<itinerario>/<id>.md`.

````markdown
# From patch to code | Del patch al código
track: patch-code
order: 1

## A box | Una caja
@en
A paragraph with `code` and **bold**.
@es
Un párrafo con `código` (un clic lo lleva a la REPL) y **negrita**.

Otro párrafo.
@try.en
Something to do at this step (optional).
@try.es
Algo que hacer en este paso (opcional).
```kairotic
(box :b1 "osc~ 220" 40 110)
```
````

- `# English | Español` es el título; `## English | Español` empieza un paso.
- Cada paso necesita `@en` y `@es`; `@try.*` va en los dos idiomas o en ninguno.
- El bloque `kairotic` contiene los gestos del paso: las mismas líneas que la pestaña Code y la REPL
  (`box`, `connect`, `text!`, `stroke`, `code`…), una forma cada una. Un paso sin código es una nota
  sobre el mismo punto de la historia.
- Da ids explícitos a las cajas (`:b1`) para que los pasos y las notas siguientes puedan nombrarlas.

Después construye el catálogo que lee la página:

```sh
node docs/tutorials/build.mjs studies/18-learn/kairotic/tutorials.mjs
```

La construcción comprueba el formato (títulos, los dos idiomas, código equilibrado) y se detiene en el
primer error.

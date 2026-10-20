# Pedir un patch (Ensayo 23)

*[English version](ask.md)*

## En la pestaña Claude

La pestaña Claude ahora hace **patches** además de componentes. Elige *A patch*, descríbelo —«un hello
world: un seno a 440 Hz con un knob de volumen»— y **Make it**. Con *change the open patch* marcado
(por defecto), Claude recibe el patch abierto y lo cambia: «ahora añade un knob que haga síntesis FM».

Claude responde con el código del patch, las mismas llamadas que lleva un enlace (`box`, `connect`,
`code`, `present`, `tree!`…). Antes de responder lo comprueba con las herramientas de la propia página:

- `list_classes` y `class_help`: qué clases hay, qué recibe cada entrada y qué envía cada salida;
- `check_faust`: para el sonido que no hacen las clases del núcleo (FM, filtros, efectos), una caja
  `faust~` cuyos parámetros mueven knobs con nombre (`knob 50 2000 440 log carrier` envía `[:carrier v]`);
- `check_patch`: el código entero —solo llamadas de patch, clases que existen, líneas entre puertos que
  existen, cada Faust compilado y cada componente evaluado.

La página lo vuelve a comprobar y el patch se carga como **un evento de la historia**: puedes volver
atrás, ramificar o fusionar como con cualquier otro gesto. Desde la REPL: `(ask-patch "…")`, y
`(ask-patch "…" false)` para un patch nuevo.

## Enlaces que llevan una descripción: `?ask=`

```
https://bonuoq.github.io/kairotic/?embed&ask=un hello world con un seno a 440 Hz y un knob que haga FM
```

El enlace lleva **qué hacer, nunca una clave**. Quien lo abre ve la descripción y **Make it with
Claude**: el patch se hace con *su* Claude —su propia clave de API de Anthropic fuera de claude.ai
(guardada solo en su navegador; dentro de un embed, solo para ese marco) o su cuenta dentro de
claude.ai. Nadie gasta el crédito de otro, y una clave nunca acaba en una página de Notion, su
historial o un servidor.

Lo que un navegador hizo a partir de un enlace se queda en ese navegador: al abrirlo otra vez muestra
el mismo patch sin volver a preguntar (**Make it again** pregunta de nuevo). **Copy the link of this
result** da un enlace `?code=` con el patch dentro: ponlo en lugar de la descripción y todo el mundo
verá el mismo patch sin preguntar a Claude.

`?ask=` puede ir con `?code=` o `?src=`: entonces Claude cambia ese patch. El panel Share/Export tiene la
opción *Carry a description instead*, y la REPL `(ask-link "…")`, `(ask-link "…" :present)`.

## Tus peticiones, guardadas

Cada petición a Claude —un patch o un componente— se guarda **solo en tu navegador**: lo que pediste,
lo que respondió Claude, el código, las comprobaciones y si funcionó. En la pestaña Claude, *Your
requests to Claude* las lista: **Load** vuelve a ponerla en la obra abierta, **Copy** la da en Markdown,
**Export** las guarda todas en un archivo `.jsonl`, y **Share on GitHub…** abre una discusión ya escrita en la
[Gallery](https://github.com/bonuoq/kairotic/discussions/categories/gallery) del repositorio de Kairotic —la petición, un enlace para tocarla y el código— que tú lees y publicas, con tu
propia cuenta, o no. Fuera de eso nada sale de tu navegador.

## Seguridad

El patch que hace Claude se lee como un enlace (solo llamadas de patch, argumentos literales). Sus
scripts y componentes propios se ejecutan sin preguntar, porque los pediste tú; las comprobaciones de
la página (Faust compilado, componentes evaluados) se hacen antes de que nada entre en la obra.

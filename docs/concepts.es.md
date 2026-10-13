# Conceptos

*[Read in English](concepts.md)* · [Documentación](README.es.md)

## Una obra son datos

Una obra es un **patch**: cajas y las líneas entre ellas, escritas como datos (EDN).

```clojure
{:boxes {:b1 {:text "osc~ 440" :x 40 :y 40}
         :b2 {:text "dac~ 1 2" :x 40 :y 100}}
 :lines [[:b1 0 :b2 0]]}            ; de la salida 0 de :b1 a la entrada 0 de :b2
```

El **texto** de una caja es su clase (la primera palabra) y sus argumentos. Algunas cajas guardan además
**datos** —los trazos de un canvas, la fuente de una caja de código, el árbol de una caja `tree`— y un
lugar en la **presentación**. Los puertos se numeran desde 0, de izquierda a derecha.

El patch y su **código** son la misma obra: cada gesto es una llamada (`box`, `connect`, `move`, `text!`,
`stroke`, `tree!`…), y la pestaña Code escribe la obra entera con esas llamadas. Dibujar escribe código;
escribir código dibuja.

## La historia es un árbol

Cada gesto es un **evento**. Los eventos forman una **historia**, un árbol: volver atrás y hacer otra
cosa crea una rama; dos gestos a la vez (dentro de la *simultaneidad*, 1,5 s por defecto) crean dos
ramas. Nada se sobrescribe.

- El **frente** es el punto más nuevo; en una sala, *Follow the front* te mantiene ahí.
- **Fusionar** trae los eventos de otra rama a donde estás. Los eventos que tocan lo mismo de forma
  distinta chocan y se quedan fuera (en una caja tree, solo chocan las ediciones del mismo nodo).
- La autoría es por **sesión** (una pestaña del navegador): dos pestañas de la misma persona se distinguen.

## Las cajas son componentes

Cada clase es un **componente**: un mapa de datos y funciones con un mismo contrato —`:receive`
(mensajes que entran, resultados que salen, puro), `:state`, `:show` (lo que muestra la caja), `:later`
(lo que se programa en el tiempo), `:audio` (nodos Web Audio), una `:view` hecha de formas, `:help`.

Las clases vienen de cuatro sitios: el **núcleo**; los **paquetes** oficiales (`@kairotic/synth` con
`adsr~` y `synth~`, `@kairotic/spatial` con `pan~` y `space~`, y los sueltos `knob`, `fifth`, `drift`), que
entran solos en la obra cuando una caja los usa; las **cajas component** que definen una clase dentro de
la obra; y los componentes **importados** de npm. Una caja `patch` guarda un sub-patch, y una clase puede
ser un patch (una **abstracción**, con `$1 $2` para sus argumentos y un panel de cajas presentadas). Ver
[Escribir un componente](writing-a-component.es.md).

## Mensajes y señales

Por las líneas viajan dos cosas:

- **Mensajes** —números, palabras clave (`:bang`), cadenas, vectores, mapas, árboles musicales— que se
  entregan al momento, con o sin ▶.
- **Señales** —audio, entre cajas `~`, una vez que ▶ ha puesto en marcha el sonido.

▶ pone en marcha el sonido y el **tiempo**: todo lo que una caja pide *para más tarde* (`metro`, `ramp`,
`mt play`) espera en una cola sobre el reloj de audio. ■ silencia y devuelve las cajas a su estado
inicial.

Dos reglas mantienen el flujo sano: un mensaje que vuelve a la misma caja 100 veces en un instante es un
**bucle sin tiempo**, y se corta (y se dice en la REPL); y **el mismo valor dos veces no cambia nada** de
lo que está en marcha —un reproductor no vuelve a empezar. Ver [Datos que fluyen](flow.es.md).

## Cajas de datos y vistas

- Un **canvas** es un buffer de trazos en dos dimensiones; un **freqt** es frecuencia en el tiempo (Hz
  en escala logarítmica, afinaciones, rejillas de compás). Un **reader** (mensajes) o **reader~** (a ritmo
  de audio, con un `phasor~`) los lee; cómo se mueve da el tiempo. La representación no decide la lectura.
- Una caja **tree** guarda un **árbol musical** y lo envía cada vez que cambia —o cuando cambia el patch
  que hay después, solo hacia lo que lo necesita. Una **score** lo dibuja como partitura y devuelve las
  ediciones hechas en ella; las cajas `mt` lo transforman; `mt play` lo toca. Ver
  [Árboles musicales](mt.es.md).

## Código dentro de la obra

- `faust~` —Faust compilado en el navegador, tocado como AudioWorklet; sus parámetros reciben mensajes
  `[:nombre valor]`, lo que envía un knob con nombre.
- `script` —una función ClojureScript con el mismo contrato que cualquier componente.
- `component` —la definición de una clase.

El código escrito por otra persona solo se ejecuta cuando lo permites: en una **sala compartida** y en un
**enlace**, los scripts y componentes esperan a *Run them* / `(trust-scripts true)`. Las definiciones
oficiales, exactamente como las trae la página, se ejecutan sin preguntar.

## Dónde viven las obras

- **Dentro de claude.ai** (el artefacto de Kairotic): obras, salas y Claude vienen de claude.ai y de tu
  cuenta.
- **En Kairotic Pages**: obras y salas en [GUN](https://gun.eco), sincronizadas por un relay; las obras
  solo se cifran en tu navegador; Claude con tu propia clave de API de Anthropic, guardada solo en tu
  navegador. Ver [Kairotic Pages](pages.es.md).
- **En local**: no se guarda nada.

## Claude en la obra

La pestaña Claude hace un **patch** a partir de una descripción, o cambia el abierto, o escribe un
**componente**. Claude comprueba lo que hace con las herramientas de la propia página (clases, puertos,
Faust compilado, componentes evaluados) antes de que llegue, como un evento de la historia. Usa tu propia
cuenta o clave de Claude; cada petición se guarda en tu navegador, y puedes compartirla en la Gallery. Ver
[Pedírselo a Claude](ask.es.md).

## Los enlaces llevan datos

Un enlace puede llevar un patch (`?code=`, `?src=`), un paso de tutorial, un patch de ayuda o una
descripción para Claude (`?ask=`) —nunca una clave. El código de patch de un enlace se lee como datos:
solo pasan las llamadas de las que está hecho un patch, con argumentos literales. Ver [Insertar](embed.es.md).

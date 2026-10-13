# Insertar Kairotic (Ensayo 22)

*[English version](embed.md)*

Un patch, un paso de tutorial o un patch de ayuda pueden vivir dentro de otra página —una página de
Notion, un blog, un curso— y seguir sonando allí.

## Hacer el enlace

En el editor, **Embed** (junto a Present) abre un panel con dos opciones:

- **Patch**: el patch, escalado para caber en el marco, con ▶ ■, la barra de la lección si es un
  tutorial, y **Kairotic ↗**, que abre lo mismo en el editor completo.
- **Presentación, pantalla completa**: solo las cajas presentadas (ver `(present :bN x y)`), llenando el
  marco, con unos controles pequeños en una esquina (▶ ■ ⛶ ↗) que se atenúan mientras tocas. El
  primer toque pone en marcha el sonido. Sin cajas presentadas, el patch entero.

El panel da el **enlace** y un **iframe**. Desde la REPL: `(embed-link)` y `(embed-link :present)`
escriben ambos y copian el enlace.

Lo que lleva el enlace depende de lo que está abierto: un tutorial en un paso
(`?tutorial=work-tree&step=2`), un patch de ayuda (`?help=mt`) o, si no, **el propio patch**
(`?code=…`, su código comprimido). Un enlace de patch es una copia de ese momento, no la obra viva.

## En Notion

Escribe `/embed` (o **+ → Insertar**, en el grupo *Integraciones* del menú de inserción), pega el
enlace y ajusta el tamaño del bloque. En otras páginas, pega el iframe.

### Código escrito a mano: `?src=`

Además de `?code=` comprimido, un enlace puede llevar el código tal como se escribe:

```
https://bonuoq.github.io/kairotic/?embed&src=(box :b1 "osc~ 440" 20 20)(box :b2 "dac~" 20 80)(connect :b1 0 :b2 0)
```

Los navegadores y Notion codifican ellos mismos espacios y comillas; `+` se queda como `+`. Se lee
igual que `?code=` (como datos, solo llamadas de patch). Sirve para patches cortos, y para quien —o
el asistente que— escriba un enlace sin el editor de Kairotic a mano.

### ¿Un comando `/kairotic`?

Notion no deja que las integraciones añadan sus propios comandos `/`, y su API de Link Preview (que
convertía enlaces en vistas vivas) está cerrada a nuevos desarrolladores; sus *bloques personalizados*
están en alfa privada. Así que hoy los caminos son `/embed` con un enlace, o pedirle a Claude, con el
conector de Notion, que ponga un embed de Kairotic en una página a partir del código escrito en ella
(un bloque de código cuya primera línea es `;; kairotic`).

Ese segundo camino está escrito como **skill de Notion**, *Kairotic: insertar un patch en la página
(/kairotic)*: Notion AI, o cualquier asistente conectado a Notion, lee los bloques de código
`;; kairotic` de una página y pone debajo de cada uno un embed con su enlace `?src=`
(`;; kairotic present` para la presentación). Un asistente escribe el bloque embed por la API de
Notion como `<embed src="…">`, y Notion lo muestra vivo, como si se hubiera pegado a mano. El
iframe lleva `allow="fullscreen"`; donde una página no permite pantalla completa dentro de sus marcos,
⛶ abre la presentación en una pestaña propia.

## Direcciones

| | |
|---|---|
| `?code=…` | un patch (deflate-raw + base64url) |
| `?src=…` | un patch, su código tal como se escribe |
| `?tutorial=id&step=n` | un tutorial en el paso n |
| `?help=clase` | el patch de ayuda de una clase |
| `?lang=es` / `?lang=en` | el idioma de lecciones y ayuda |
| `?embed` | solo el patch |
| `?present` | solo la presentación, llenando la ventana |

Sin `embed` ni `present` las mismas direcciones se abren en el editor completo, como obra local: desde
Sessions se puede copiar a una obra solo o a una sala.

## Seguridad

Un embed funciona solo: sin relay, sin guardar nada, sin Claude. El código de un enlace se lee como
datos y solo pasan las llamadas de las que está hecho un patch (`box`, `connect`, `present`, `code`,
`stroke`, `axis`, `tree!`, `inside`…), con argumentos literales: un enlace no puede ejecutar código en
la página. Sus cajas script y component esperan, como en una sala compartida, hasta que quien lo abre
pulsa **Ejecutarlos** —salvo las definiciones que son exactamente un paquete o componente oficial tal
como lo trae la página, que se ejecutan sin preguntar (también en salas).

Hay una página de prueba con tres marcos en [embed-test.html](https://bonuoq.github.io/kairotic/embed-test.html).

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

Escribe `/embed`, pega el enlace y ajusta el tamaño del bloque. En otras páginas, pega el iframe. El
iframe lleva `allow="fullscreen"`; donde una página no permite pantalla completa dentro de sus marcos,
⛶ abre la presentación en una pestaña propia.

## Direcciones

| | |
|---|---|
| `?code=…` | un patch (deflate-raw + base64url) |
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

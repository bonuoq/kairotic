# Kairotic · marca

*[Read in English](README.md)*

<img src="kairotic-logo.svg" alt="Logotipo de Kairotic" height="64">

**El icono (k)**: unos paréntesis que encierran una K cuyo tallo es una línea de tiempo que se bifurca en un punto, el
kairós. **El logotipo**: `(kairotic` + una bifurcación + `)` en IBM Plex Mono, con la primera k dibujada como esa misma
K. Los paréntesis son el Lisp del código; la bifurcación, las líneas temporales que divergen.

## Archivos

| Archivo | Uso |
| --- | --- |
| `kairotic-logo.svg` | logotipo sobre fondos claros |
| `kairotic-logo-dark.svg` | logotipo sobre fondos oscuros |
| `kairotic-logo-adaptive.svg` | logotipo que sigue el esquema claro u oscuro del sistema |
| `kairotic-logo-closed.svg` | `(kairotic)`, sin la bifurcación final |
| `kairotic-wordmark.svg` | `kairotic` sin paréntesis, para cabeceras junto al icono |
| `kairotic-icon.svg` | icono (k), de 48 px en adelante, claro u oscuro según el sistema |
| `kairotic-icon-light.svg`, `kairotic-icon-dark.svg` | icono (k) fijo para fondos claros u oscuros |
| `kairotic-icon-small.svg` | icono (k) simplificado para 32 y 16 px (sin nodos en los brazos): el favicon |
| `kairotic-app-icon.svg` | icono sobre una placa redondeada de tinta |

Las letras están convertidas a trazos (IBM Plex Mono Medium), así que los archivos no necesitan la fuente; `generate.py` los vuelve a generar. La app
dibuja el logotipo en su cabecera con el `--ink` y el `--kairos` del tema.

## Uso

- Área de respeto alrededor del icono: el 12 % de su tamaño, más o menos el ancho de un paréntesis.
- El punto kairós es el único color: #b4472e sobre fondos claros, #e58a6f sobre tinta. A una tinta, el punto toma la tinta.
- Por debajo de 48 px, el icono pequeño.
- No redibujar las letras con otra fuente, deformar el logo ni cambiar el color de sus partes.

## Colores

| Nombre | Hex | Uso |
| --- | --- | --- |
| Tinta | `#1b2430` | texto, trazos, fondos oscuros |
| Papel | `#f8f9fb` | fondos claros |
| Línea | `#c3ccd6` | líneas y bordes |
| Kairós | `#b4472e` | el punto; fondos claros |
| Kairós claro | `#e58a6f` | el punto sobre tinta |
| Retícula | `#2f55d4` | enlaces, retícula de construcción |

## Tipografía

IBM Plex Mono 500 para el logotipo y el código · IBM Plex Sans Condensed 600 para títulos · IBM Plex Sans 400 para texto.

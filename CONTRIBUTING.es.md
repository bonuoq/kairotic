# Contribuir a Kairotic

*[Read in English](CONTRIBUTING.md)*

Gracias por querer ayudar. Kairotic es un proyecto joven (alfa): son bienvenidos componentes, ensayos,
documentación, traducciones, pruebas y avisos de errores. Antes de empezar, lee el
[Código de conducta](CODE_OF_CONDUCT.es.md) y [Cómo se construye Kairotic](docs/how-kairotic-is-built.es.md).

## Ideas, preguntas, errores

| Tienes… | Ve a |
|---|---|
| una idea, una propuesta, una dirección nueva | [Discussions → Ideas](https://github.com/bonuoq/kairotic/discussions/categories/ideas) |
| algo que has hecho (una obra, un patch, un componente) | [Discussions → Gallery](https://github.com/bonuoq/kairotic/discussions/categories/gallery) |
| una pregunta sobre cómo funciona algo | [Discussions → Q&A](https://github.com/bonuoq/kairotic/discussions/categories/q-a) |
| un error: algo que no hace lo que dice la documentación | [Issues](https://github.com/bonuoq/kairotic/issues/new/choose) |
| un componente nuevo que quieres escribir o ver | [Issues → New component](https://github.com/bonuoq/kairotic/issues/new/choose) |
| un problema de seguridad (sobre todo en el relay) | **no** un issue público: ver [SECURITY.md](SECURITY.md) |

Las ideas se discuten antes de construirse: la dirección del proyecto se decide en abierto, en
Discussions. A un pull request con un cambio grande sin discusión detrás se le puede pedir que abra una.
Las discusiones se escriben en inglés para que todo el mundo pueda seguirlas.

## Montar el entorno

Kairotic es estático: ClojureScript interpretado en el navegador por [Scittle](https://github.com/babashka/scittle),
dependencias desde CDN y WebAssembly. No hay compilador ni `npm install` para la app.

Necesitas [Node](https://nodejs.org) 22 (el de CI; 18 o posterior sirve para casi todos los scripts), git
y un Chromium, Firefox o Safari recientes.

```sh
git clone https://github.com/bonuoq/kairotic.git
cd kairotic
node site/build.mjs                    # → _site/ (edición Pages) y _artifact/ (edición claude.ai)
cd _site && python3 -m http.server 8000
# http://localhost:8000              la app
# http://localhost:8000/tests.html   las pruebas, en tu navegador
```

`site/build.mjs` construye primero los paquetes (`packages/build.mjs`), los ejemplos de Claude
(`examples/build.mjs`) y los tutoriales. Cualquier servidor estático sirve en lugar de Python
(`npx http-server _site -p 8000`).

Para levantar un relay propio (salas, OSC): `cd relay && npm install && npm start`. Ver [relay/](relay/README.es.md).

## Correr las pruebas

Cada cambio llega con sus pruebas, y las pruebas pasan antes de mezclarlo. CI las ejecuta en cada pull
request ([tests.yml](.github/workflows/tests.yml), [studies.yml](.github/workflows/studies.yml),
[headers.yml](.github/workflows/headers.yml)); córrelas antes en local:

```sh
# comprobaciones rápidas, en Node (segundos)
node tests/spdx.mjs          # cada fuente empieza con su cabecera de licencia SPDX
node tests/licences.mjs      # los datos con otra licencia (los corales) fuera de la app y los paquetes
node tests/names.mjs         # cada nombre de primer nivel de la página, definido una vez
node tests/versions.mjs      # cada paquete oficial fijado por la página a la versión de su package.json
node tests/keywords.mjs      # las órdenes son keywords, nunca strings
node tests/counterpoint.mjs && node tests/rules.mjs && node tests/export.mjs

# las pruebas de la app en un Chromium sin pantalla
node site/build.mjs
npm install --no-save playwright@1.56.0 && npx playwright install chromium
npx http-server _site -p 8000 -s &
node tests/browser.mjs http://localhost:8000/tests.html

# las páginas de prueba de los ensayos (el repositorio servido en su raíz)
npx http-server . -p 8000 -s &
node tests/studies.mjs http://localhost:8000/ [ensayo…]
```

Las pruebas de la app están en `tests/cljs/*.cljs` (ClojureScript, se ejecutan en la página) y en
`tests/*.mjs` (el driver del navegador y las comprobaciones en Node). Cada ensayo guarda las suyas en
`studies/NN-nombre/tests/*.html`.

## Convenciones

- **Inglés en el código.** Nombres, clases, mensajes, comentarios e interfaz en inglés, sin alias en otras
  lenguas. La documentación, los ejemplos y los tutoriales, en inglés y castellano (`archivo.md` y
  `archivo.es.md`); si solo puedes escribir uno, escríbelo y dilo en el pull request.
- **Nombres de `clojure.core`.** Cuando una caja hace lo que hace una función de Clojure, toma su nombre
  (`map`, `reduce`, `partition`…) en lugar de un nombre al estilo de Max. Las transformaciones de árboles
  siguen también el vocabulario de Clojure.
- **Las órdenes son keywords.** Una caja recibe `:bang`, `:stop`, `:clear`… nunca `"bang"`
  ([tests/keywords.mjs](tests/keywords.mjs) lo comprueba).
- **Alturas en Hz** por defecto, MIDI con la opción `midi`. Los componentes de notación devuelven árboles.
- **Datos primero.** Una obra es EDN; cada gesto es un evento que se escribe como código. Los componentes
  son mapas de datos y funciones puras, escritos por secciones (about · arguments · logic · view), que solo
  usan el núcleo a través de la [API de Kairotic](core/kairotic/api.cljs). Ver
  [Escribir un componente](docs/writing-a-component.es.md).
- **Estático.** Sin paso de compilación para la app: ClojureScript con Scittle, librerías desde CDN en una
  versión fija, WebAssembly para los núcleos pesados. JavaScript solo donde hace falta (DSP, worklets, núcleos).
- **Gráficos en SVG.** Los componentes dibujan en SVG; WebGL solo para el único lienzo de fondo del patch,
  donde de verdad hace falta.
- **Los ensayos antes que la app.** Una idea nueva se prueba primero como ensayo (`studies/NN-nombre/`: una
  página, su núcleo, sus pruebas), y pasa a un paquete o al núcleo cuando se ha demostrado. Se construye
  sobre lo que ya hay (los núcleos de contrapunto, el motor de reglas) en lugar de empezar de nuevo.
- **Un comportamiento, no dos.** Mientras Kairotic esté en alfa, los comportamientos se unifican aunque
  eso rompa patches antiguos; dilo en el Changelog.
- **Cabeceras de licencia.** Cada archivo fuente empieza con `SPDX-License-Identifier: MPL-2.0` en un
  comentario (después de `<!DOCTYPE html>` en una página); [tests/spdx.mjs](tests/spdx.mjs) lo comprueba.
  Un componente declara además su licencia con `:license`.
- **Código de otros.** El código que portes, empaquetes o compiles de otro proyecto mantiene su licencia si es
  permisiva (MIT, BSD, ISC, Zlib, Apache-2.0): su cabecera lo dice (`Apache-2.0`, o `MPL-2.0 AND MIT` si comparte
  archivo con el nuestro), con su aviso de copyright, y va a [THIRD_PARTY.md](THIRD_PARTY.es.md) con sus avisos; un
  paquete que lo publique declara también esa licencia. `tests/spdx.mjs` y `tests/licences.mjs` lo comprueban. El
  código copyleft (GPL, AGPL) no entra en el repositorio; una biblioteca LGPL se carga, no se copia.
- **Paquetes.** Un cambio en un paquete sube su versión en `package.json`, y la que fija la página con ella.
- **Changelog.** Añade una línea en *Unreleased* de [CHANGELOG.md](CHANGELOG.md) (en inglés).
- **Commits.** Un asunto corto que diga qué cambia (`rhythm: vary redraws below a metrical depth`), el porqué
  en el cuerpo, la discusión o el issue al que pertenece (`#353`).

## Pull requests

1. Haz un fork y una rama desde `main`.
2. Haz el cambio con sus pruebas y su documentación; corre las pruebas.
3. Firma cada commit (ver abajo).
4. Abre el pull request y rellena su plantilla. Los pull requests en borrador son bienvenidos para
   recibir comentarios pronto.

Alguien que mantiene el proyecto lo revisa; cuando las comprobaciones pasan, se mezcla.

## Certificado de origen del desarrollador (DCO)

Kairotic no pide un acuerdo de licencia de contribuidor. En su lugar, cada commit lleva una línea
`Signed-off-by` con la que certificas el [Developer Certificate of Origin 1.1](https://developercertificate.org/):
en pocas palabras, que el cambio es tuyo o que tienes derecho a enviarlo con la licencia del proyecto
(MPL-2.0 para el código, CC BY-SA 4.0 para la documentación).

```sh
git commit -s -m "theory: tonnetz draws the path of a progression"
# añade: Signed-off-by: Tu Nombre <tu@ejemplo.com>
```

El nombre y el correo deben ser los del autor del commit (tu `git config user.name` y `user.email`).
¿Se te olvidó? `git commit --amend -s` para el último commit, o `git rebase --signoff main` para toda la rama,
y luego `git push --force-with-lease`.

**Commits escritos con un asistente de IA.** Puedes usar uno (el propio Kairotic se construye con Claude
Code, ver [Cómo se construye Kairotic](docs/how-kairotic-is-built.es.md)), y sigues siendo responsable de lo
que envías. Haz los commits con **tu propia** identidad de Git: tú eres el autor y tú firmas. Al asistente
se le reconoce con una línea final, nunca como autor:

```
Co-Authored-By: Claude <noreply@anthropic.com>
Signed-off-by: Tu Nombre <tu@ejemplo.com>
```

Si un asistente hizo commits con su propia identidad, hazte cargo de ellos antes de subirlos — esto te hace
su autor y los firma, conservando sus mensajes y sus líneas finales:

```sh
git rebase origin/main --exec 'git commit --amend --no-edit --reset-author --signoff'
git push --force-with-lease
```

La [comprobación del DCO](.github/workflows/dco.yml) se ejecuta en cada pull request y nombra los commits
sin firma, con una firma que no es la de su autor, o cuyo autor es un asistente de IA. Como cualquier
comprobación de DCO, lee lo que los commits dicen de sí mismos: la certificación es tuya.

## Licencia

Al contribuir aceptas que tu contribución se licencie como el resto del proyecto: el código con la
[Mozilla Public License 2.0](LICENSE), la documentación con [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/deed.es).
El código de otros que traiga tu contribución mantiene su propia licencia, como lo recoge [THIRD_PARTY.md](THIRD_PARTY.es.md)
(el punto (b) del DCO lo cubre).
Las obras que hagas con Kairotic siguen siendo tuyas.

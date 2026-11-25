# Código de terceros en el repositorio

*[Read in English](THIRD_PARTY.md)*

El código propio de Kairotic es MPL-2.0. El código de otros que Kairotic adapta, porta, empaqueta o compila mantiene
**su propia licencia** cuando esa licencia es permisiva (MIT, BSD, ISC, Zlib, Apache-2.0) o, dentro del paquete del
editor, la EPL: sus archivos lo dicen en su cabecera SPDX (`MPL-2.0 AND MIT` cuando nuestro código y el suyo comparten
archivo), aparecen aquí y sus avisos van abajo. [`tests/spdx.mjs`](tests/spdx.mjs) falla con una cabecera distinta de
`MPL-2.0` que no esté aquí, y [`tests/licences.mjs`](tests/licences.mjs) con un paquete publicado que lleve código de
esta lista sin declarar su licencia ni incluir este archivo. Las dependencias que se cargan de un CDN, y nunca están
en el repositorio, aparecen en el [README](README.es.md#dependencias).

| Ruta | Licencia (SPDX) | Qué | De dónde |
|---|---|---|---|
| `core/vendor/codemirror.mjs` | MPL-2.0 AND MIT AND EPL-2.0 AND ISC AND EPL-1.0 | el paquete del editor de código | CodeMirror 6 y Lezer (MIT), clojure-mode (EPL-2.0), lezer-clojure (ISC), squint (EPL-1.0): versiones en `core/vendor/codemirror/package-lock.json` |
| `site/vendor/gun/` | MIT OR Zlib OR Apache-2.0 | salas y obras guardadas en Pages | [GUN](https://gun.eco), su licencia en `site/vendor/gun/LICENSE.md` |
| `packages/spectral/assets/shift.mjs` | MPL-2.0 AND MIT | el WebAssembly de `shift~` | [stftPitchShift](https://github.com/jurihock/stftPitchShift) 2.0, compilado; generado por `packages/spectral/native/build.mjs` |
| `studies/28-shift/kairotic/shift.mjs` | MPL-2.0 AND MIT | el mismo módulo, para el Study 28 | stftPitchShift, como arriba |
| `studies/29-live/kairotic/shift.mjs` | MPL-2.0 AND MIT | el mismo módulo, para el Study 29 | stftPitchShift, como arriba |
| `studies/73-polyphony/kairotic/basicpitch.mjs` | Apache-2.0 | las ventanas y la lectura de notas de Basic Pitch, portadas | [Basic Pitch](https://github.com/spotify/basic-pitch) (Spotify), `basic_pitch` y `basic-pitch-ts` |

Un paquete que publique alguno de estos declara sus licencias en su `package.json` (`"license": "MPL-2.0 AND MIT"`) y
lleva este archivo. Los pesos de modelos que se descargan al ejecutar (los de Basic Pitch, Apache-2.0, en el Study 73)
no están en el repositorio y Kairotic no los redistribuye.

## Avisos

Los avisos van tal como los dan sus autores, en inglés: ver [THIRD_PARTY.md](THIRD_PARTY.md#notices).

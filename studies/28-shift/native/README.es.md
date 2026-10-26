# Estudio 28 · el WebAssembly de stftPitchShift

*[Read in English](README.md)*

[stftPitchShift](https://github.com/jurihock/stftPitchShift) de Jürgen Hock (C++, licencia MIT) compilado
para la web sin Emscripten: [wasi-sdk](https://github.com/WebAssembly/wasi-sdk) compila una entrada en C
mínima (`shift.cpp`) a un WebAssembly de 80 KB, y `glue.mjs` lo envuelve en un único módulo ES con el
WebAssembly dentro (`../kairotic/shift.mjs`). Sin fetch ni `atob`: el mismo fichero sirve en una página,
en un worker y, más adelante, en un AudioWorklet.

```sh
node studies/28-shift/native/build.mjs     # descarga una vez stftPitchShift v2.0 y wasi-sdk 25 en .cache/
```

`ks_shift` acepta un **calendario** de factores (pueden cambiar de una trama STFT a la siguiente, con
`StftPitchShiftCore::factors`) y rellena una trama de silencio a cada lado, para que la salida dure lo
mismo que la entrada y sus extremos no se desvanezcan. Comprobado: compilado de forma nativa da
exactamente las mismas muestras que `StftPitchShift::shiftpitch` de la biblioteca (diferencia 0).

Velocidad (un canal de un minuto a 48 kHz, trama 1024): solapamiento 8 unos 2 s, 16 unos 3,5 s, 32
unos 7 s. Por eso el estudio lo ejecuta en un worker.

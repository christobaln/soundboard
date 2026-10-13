# Bundled MP3 decoder source and rebuilding

Waveform bundles mpg123-decoder 1.0.3 and @wasm-audio-decoders/common 9.0.7
(MIT, Ethan Halsall). Their embedded mpg123 core is LGPL 2.1.

* `mpg123-source.tar.gz`: unmodified corresponding mpg123 source at
  https://github.com/madebr/mpg123/tree/08247b317163175e62035893af3ff9e71a5dfefd
* `wasm-audio-decoders-source.tar.gz`: MP3 wrapper, common code and build files
  from https://github.com/eshaz/wasm-audio-decoders/tree/8f2428c1cd96b54dab74836c8471ff75fe35cbee
  Unrelated decoders and test audio are omitted. The upstream Makefile includes
  the compiler flags and exact configuration used for the core.
* License texts and author notices are in the adjacent `licenses` directory.
  web-worker is Apache 2.0 (Copyright 2020 Google LLC); puff is zlib licensed
  (Copyright 2002-2013 Mark Adler). Original notices are retained in source.

You may modify/relink the LGPL component and reverse engineer Waveform for
that purpose. No app signature or integrity lock prevents a rebuilt app from
using a modified decoder.

Rebuilding: use Node 24, Emscripten, GNU make and autotools. Extract the wrapper
archive, and extract the mpg123 archive into its `modules/mpg123` directory
(removing its top-level archive directory). Make `tmp` and `demo` directories.
The wrapper's root package.json describes its build dependencies; install its
non-local build dependencies (rollup and plugins, terser, simple-yenc and
node-zopfli) and install `src/common`/`src/mpg123-decoder` package dependencies.
Run `make mpg123-configure`, then `make mpg123-decoder` from the wrapper root.
These commands regenerate the EmscriptenWasm module and MP3 distribution.
The original full upstream checkout is also available at the pinned URL above.

Waveform's full application source and locked dependencies are available at
https://github.com/christobaln/soundboard/tree/v0.3.0 . After `npm ci`, replace
node_modules/mpg123-decoder with your rebuilt package (and common if changed).
Run `npm run test:ui` and `npm run test:desktop`, then `npm run package:installer`
on Windows. Vite's rebuild embeds your replacement decoder into the renderer.

Usage:

    node watcher.js basePath [--minify] [--pjs-watch path] [...] [--pjs args..]

  - `basePath` Specify a folder to watch changes.
  - `--minify` Specify whether to minify CSS output.
  - `--pjs-watch` When files inside path update, regenerate .pjs in basePath.
  - `--pjs` All arguments following are forwarded to cpp.

Example:

    node watcher.js ./doc/ --pjs-watch inc/ --pjs -D DEBUG

Watch files in ./doc/, update ./doc/*.pjs when ./doc/inc/* change.

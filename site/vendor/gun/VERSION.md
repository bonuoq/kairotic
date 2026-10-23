GUN browser files (gun.js, sea.js, and lib/radix.js, lib/radisk.js, lib/store.js, lib/rindexed.js:
RAD, its storage on IndexedDB), vendored so the Pages edition does not depend on a CDN for
its data layer.

- Source: https://github.com/amark/gun
- Commit: 054ca85f59d8a8fe6779c19fa34be985e16cfbc9 (2026-09-25), package version 0.2020.1239
- License: MIT or Zlib or Apache-2.0, see LICENSE.md (Copyright (c) 2015 Mark Nadal)

These are the exact files the adapter (core/backends/gun-backend.js) was tested with. To update,
copy these files from a newer checkout and run the two-browser test again.

# AGENTS.md

## Cursor Cloud specific instructions

`slinktool` is a small, self-contained C program: an all-in-one SeedLink client
used to inspect/collect seismic Mini-SEED data from a SeedLink server. The repo
bundles its only two dependencies as source (`libslink/` and `ezxml/`), so there
is **nothing to install** — the build compiles everything from source using the
system `gcc`/`make`/`ar` toolchain.

### Build / lint / test / run
- Build (from repo root): `make` — builds `libslink`, `ezxml`, then the
  `./slinktool` binary. Use `make clean` to remove all objects/binaries.
  Build commands, targets, and the `-I`/`-L` flags are defined in the per-dir
  `Makefile`s (`Makefile`, `src/Makefile`, `libslink/Makefile`, `ezxml/Makefile`).
- Lint: there is **no lint or automated-test framework** in this repo. Code style
  is described by `.clang-format` (LLVM/Allman) but `clang-format` is not part of
  the toolchain; the effective "lint" is a clean compiler build. A few
  pre-existing `-Wdeprecated-non-prototype` warnings in `libslink/logging.c` are
  expected and harmless.
- Run: `./slinktool -h` for usage; full docs in `doc/slinktool.md`.
- Example library client: `make -C libslink/example` builds `slclient`.

### Running end-to-end (network required)
`slinktool` is a network client and needs a reachable SeedLink server. A public
one is EarthScope/IRIS at `rtserve.iris.washington.edu:18000`.
- Quick server check: `./slinktool -P rtserve.iris.washington.edu:18000`
- Fetch real data and terminate cleanly: use dial-up mode (`-d`) plus a time
  window (`-tw start:end`), otherwise the client waits indefinitely for
  real-time data. Time format is `YYYY,MM,DD,HH,MM,SS`. Example:
  `./slinktool -pp -u -d -tw <start>:<end> -S IU_ANMO:BHZ.D rtserve.iris.washington.edu:18000`
  (`-pp` prints record headers, `-u` unpacks samples). Requested windows must be
  recent enough to still be in the server's ring buffer.

### Notes / gotchas
- Build artifacts (`*.o`, `*.a`, `./slinktool`) are written in-tree and are not
  git-ignored; do not commit them.
- Diagnostic output goes to stderr; Mini-SEED record details (`-p`), unpacked
  samples (`-u`), and raw INFO responses go to stdout.

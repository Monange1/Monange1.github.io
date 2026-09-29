# GameZone PS4 6.72 starter

This directory is isolated from the 9.00, 11.00 and modern firmware chains.

- The canonical 6.72 full-chain reference is `sleirsgoevy/ps4jb`, commit
  `25f07f919b3c07383895ff372ff76d88e3e1138e`.
- The packaged browser integration and 6.72 GoldHEN payload are from
  `GamerHack/GamerHack.github.io`, commit
  `d546c8e5517f6dee73486504db04accfc26f0886`.
- Packaged GoldHEN file: `goldhen_2.4b18.12.bin`, 293120 bytes, SHA-256
  `df3f27c1b35bc7c40e3a08caab948930914dc7d0301a73b68945cf6ffe40ea12`.

The `/start` router selects this directory only for the exact PS4 firmware
`6.72`. Nearby firmware versions fail closed.

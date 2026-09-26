# GameZone GoldHEN starter — PS4 12.00 field test

This is deliberately a field-test build. It is not a production starter yet.

- It refuses every firmware except exactly 12.00.
- It caches all required files for offline use.
- It requires an explicit press before each test; automatic startup remains disabled until real-console validation passes.
- Upstream: `rawgame4/rawgame4.github.io` at commit `d297459c793b08346409206c537acf40cbcb926f`.
- Payload SHA-256: `c6329401d1810e16c84e6474ac30977dbdc951987c10cdb559370de7d59db0b0`.

The upstream README claims 12.00 hardware support, while the same commit and `ps4_offsets.js` mark 12.00 as untested on hardware. GameZone therefore does not classify this build as production-ready.


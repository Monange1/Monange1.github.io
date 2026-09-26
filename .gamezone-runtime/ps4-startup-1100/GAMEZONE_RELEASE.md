# GameZone GoldHEN starter — PS4 11.00

Production candidate for consoles reporting exactly firmware 11.00.

- Browser entry: CSSFontFace userland chain with Lapse kernel chain.
- Startup: automatic after the offline cache is complete.
- Wrong-firmware guard: the launcher refuses every firmware except 11.00.
- Offline behavior: Application Cache stores the complete launcher on first use.
- Payload SHA-256: `c6329401d1810e16c84e6474ac30977dbdc951987c10cdb559370de7d59db0b0`.

The exploit implementation is derived from `ntfargo/CSSFontFace-Exploit` and retains its MIT license and upstream attribution. The bundled GoldHEN payload remains the work of the GoldHEN team.


# GameZone PS4 firmware router

This same-origin gateway detects an exact PS4 firmware and opens its protected
GameZone starter. It contains no exploit and cannot start GoldHEN by itself.

Registered routes:

- 9.00: certified GameZone browser starter.
- 11.00 and 11.02: CSSFontFace/Lapse hardware-test starter.
- 11.50 through 13.00: Lapse/Poops laboratory starter with exact-version guards.

Every destination requires its own completed offline cache and a deliberate
button press. Unknown and nearby firmware versions fail closed.

# GameZone PS4 6.72 starter

This host keeps the proven PS4 6.72 exploit logic and GoldHEN 2.4b18.12 payload while replacing the old multi-payload menu with the GameZone safe-start interface.

Safety behavior:

- requires the exact `PlayStation 4/6.72` browser user agent;
- never starts automatically;
- permits one deliberate start attempt per page load;
- caches every required local file for later offline use;
- fails closed if offline storage cannot be confirmed.

Payload SHA-256: `df3f27c1b35bc7c40e3a08caab948930914dc7d0301a73b68945cf6ffe40ea12`

The maintenance button is intentionally omitted because this release does not contain a separately verified 6.72 no-AutoRun payload.

# GameZone modern firmware laboratory host

This directory pins upstream commit `d297459c793b08346409206c537acf40cbcb926f`
from `rawgame4/rawgame4.github.io` and keeps its exploit, patch, and GoldHEN
payload bytes unchanged.

GameZone changes only the delivery and safety layer:

- exact firmware allow-list;
- manual startup on every visit;
- one launch attempt per page load;
- short-lived launch ticket required by internal exploit pages;
- two-step acknowledgement for firmware whose local upstream evidence marks
  offsets or aliases as unverified;
- standard same-origin AppCache manifest;
- build-time SHA-256 checks for payload and patch blobs.

The host is a laboratory candidate. It is not a production tracker-support
claim. A firmware remains blocked from venue installation until its activation,
GoldHEN identity, tracker AutoRun, FC observer, rest mode, cold boot, and failure
recovery checks pass on the exact hardware/firmware combination.

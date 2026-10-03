(function () {
  var button = document.getElementById("start");
  var firmwareEl = document.getElementById("firmware");
  var status = document.getElementById("msgs");
  var started = false;
  var cacheReady = false;
  button.disabled = true;

  window.PLfile = "goldhen-2.4b18.12.bin";
  window.LoadedMSG = "GoldHEN v2.4b18.12 loaded. You may close the browser.";
  try {
    document.getElementById("passCounter").textContent = localStorage.passcount || "0";
    document.getElementById("failCounter").textContent = localStorage.failcount || "0";
  } catch (_) { /* Counters must not prevent offline startup. */ }

  function firmware() {
    var match = /PlayStation 4[\\/ ](\d+)\.(\d+)(?:\D|$)/.exec(navigator.userAgent);
    if (!match) return null;
    return match[1] + "." + match[2];
  }

  function exactFirmware() {
    return firmware() === "6.72";
  }

  function ready(message) {
    if (started) return;
    if (!exactFirmware()) {
      button.disabled = true;
      status.textContent = "STOP: this starter requires exactly PS4 firmware 6.72.";
      return;
    }
    cacheReady = true;
    button.disabled = false;
    status.textContent = message || "Offline ready. Press Start GoldHEN when you are ready.";
  }

  button.addEventListener("click", function () {
    if (started || !cacheReady || !exactFirmware()) return;
    started = true;
    button.disabled = true;
    status.textContent = "Starting GoldHEN. Wait for the console notification…";
    // This upstream engine contains top-level heap/exploit setup. Never load it
    // while the entry page is only caching, checking firmware or awaiting consent.
    var engine = document.createElement("script");
    engine.src = "exploit-engine.js";
    engine.onload = function () {
      try { jailbreak(); }
      catch (_) { status.textContent = "Startup failed. Cold-restart the PS4 before retrying."; }
    };
    engine.onerror = function () {
      status.textContent = "Saved engine could not load. Nothing will retry automatically. Reconnect and reload before another attempt.";
    };
    document.body.appendChild(engine);
    // Never enable a second exploit attempt during the same page load.
  });

  var detected = firmware();
  firmwareEl.textContent = detected ? "Detected PS4 firmware " + detected : "No PS4 firmware detected";
  if (!exactFirmware()) {
    status.textContent = "STOP: this starter requires exactly PS4 firmware 6.72.";
    return;
  }

  var cache = window.applicationCache;
  if (!cache) {
    status.textContent = "Offline storage is unavailable. Reload once with an internet connection.";
    return;
  }
  function updateReady() {
    cacheReady = false;
    button.disabled = true;
    try { cache.swapCache(); } catch (_) {}
    status.textContent = "Offline update saved. Reload this page before starting GoldHEN.";
  }

  status.textContent = "Saving the complete 6.72 starter for offline use…";
  cache.addEventListener("progress", function (event) {
    if (event && event.total) status.textContent = "Saving for offline use: " + Math.round(event.loaded / event.total * 100) + "%";
  }, false);
  cache.addEventListener("cached", function () { ready(); }, false);
  cache.addEventListener("noupdate", function () { if (cache.status === cache.IDLE) ready(); }, false);
  cache.addEventListener("updateready", updateReady, false);
  cache.addEventListener("error", function () {
    if (cache.status === cache.IDLE) { ready("Offline cache loaded. No internet is needed for startup."); return; }
    if (cache.status === cache.UPDATEREADY) { updateReady(); return; }
    cacheReady = false;
    button.disabled = true;
    status.textContent = "Offline cache is not installed. Connect once, reload and wait for Offline ready; GoldHEN was not started.";
  }, false);
  cache.addEventListener("obsolete", function () {
    cacheReady = false; button.disabled = true;
    status.textContent = "Offline package is obsolete. Reconnect and reload before starting.";
  }, false);
  if (cache.status === cache.IDLE) ready();
  else if (cache.status === cache.UPDATEREADY) updateReady();
})();

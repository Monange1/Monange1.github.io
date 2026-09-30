(function () {
  var button = document.getElementById("start");
  var firmwareEl = document.getElementById("firmware");
  var status = document.getElementById("msgs");
  var started = false;
  var cacheReady = false;
  button.disabled = true;

  window.PLfile = "goldhen-2.4b18.12.bin";
  window.LoadedMSG = "GoldHEN v2.4b18.12 loaded. You may close the browser.";
  document.getElementById("passCounter").textContent = localStorage.passcount || "0";
  document.getElementById("failCounter").textContent = localStorage.failcount || "0";

  function firmware() {
    var match = /PlayStation 4[\\/ ](\d+)\.(\d+)/.exec(navigator.userAgent);
    if (!match) return null;
    var minor = match[2].slice(0, 2);
    if (minor.length < 2) minor = "0" + minor;
    return parseInt(match[1], 10) + "." + minor;
  }

  function exactFirmware() {
    return firmware() === "6.72";
  }

  function ready(message) {
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
    try {
      jailbreak();
    } catch (error) {
      status.textContent = "Startup failed. Cold-restart the PS4 before retrying.";
    }
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
  if (!navigator.onLine || cache.status === cache.IDLE) {
    ready();
    return;
  }
  if (cache.status === cache.UPDATEREADY) {
    try { cache.swapCache(); } catch (_) {}
    status.textContent = "Offline update saved. Reload this page before starting GoldHEN.";
    return;
  }

  status.textContent = "Saving the complete 6.72 starter for offline use…";
  cache.addEventListener("progress", function (event) {
    if (event && event.total) status.textContent = "Saving for offline use: " + Math.round(event.loaded / event.total * 100) + "%";
  }, false);
  cache.addEventListener("cached", function () { ready(); }, false);
  cache.addEventListener("noupdate", function () { ready(); }, false);
  cache.addEventListener("updateready", function () {
    try { cache.swapCache(); } catch (_) {}
    button.disabled = true;
    status.textContent = "Offline update saved. Reload this page before starting GoldHEN.";
  }, false);
  cache.addEventListener("error", function () {
    button.disabled = true;
    status.textContent = "Offline cache failed. Check the connection and reload; GoldHEN was not started.";
  }, false);
})();

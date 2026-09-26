(function () {
  var button = document.getElementById("jeilbrek");
  var maintenance = document.getElementById("maintenance");
  var checkbox = document.getElementById("autoJbInput");
  var ua = document.getElementById("UA");
  var status = document.getElementById("status");
  var netctrl = document.getElementById("netctrl-exploit");
  var lapse = document.getElementById("lapse-exploit");
  var form = document.getElementById("kernel-options");
  var started = false;
  var cacheReady = false;
  button.disabled = true;
  maintenance.disabled = true;

  window.exploitChain = "lapse";
  window.payloadPath = "src/payload.bin";
  window.payloadExpectedSize = 290016;
  lapse.checked = true;
  checkbox.checked = false;
  ua.textContent = navigator.userAgent;

  function firmware() {
    var match = /PlayStation 4[\\/ ](\d+)\.(\d+)/.exec(navigator.userAgent);
    if (!match) return null;
    return parseInt(match[1], 10) + "." + match[2].slice(0, 2).padStart(2, "0");
  }

  function supported(value) {
    return value === "11.00" || value === "11.02";
  }

  function setReady(message) {
    var fw = firmware();
    if (!supported(fw)) {
      button.disabled = true;
      maintenance.hidden = true;
      status.textContent = "STOP: this starter requires exactly PS4 firmware 11.00 or 11.02.";
      return;
    }
    cacheReady = true;
    button.disabled = false;
    maintenance.hidden = fw !== "11.00";
    maintenance.disabled = fw !== "11.00";
    status.textContent = message || "Offline ready. Press Start GoldHEN when you are ready.";
  }

  function start(mode) {
    if (started || !cacheReady || !supported(firmware())) return;
    started = true;
    button.disabled = true;
    maintenance.disabled = true;
    if (mode === "maintenance") {
      window.payloadPath = "src/goldhen-2.4b18-maintenance.bin";
      window.payloadExpectedSize = 260160;
      status.textContent = "Starting maintenance GoldHEN without GameZone tracker AutoRun…";
    } else {
      window.payloadPath = "src/payload.bin";
      window.payloadExpectedSize = 290016;
      status.textContent = "Starting GoldHEN. Wait for the console notification…";
    }
    try {
      window.doJb();
    } catch (error) {
      status.textContent = "Startup failed. Cold-restart the PS4 before retrying.";
      document.getElementById("console").textContent = String(error && (error.message || error));
    }
    // Deliberately never re-enable either button during this page load.
  }

  button.addEventListener("click", function () { start("managed"); });
  maintenance.addEventListener("click", function () { start("maintenance"); });
  form.addEventListener("change", function (event) { window.exploitChain = event.target.value; });
  netctrl.checked = false;

  if (!supported(firmware())) {
    status.textContent = "STOP: this starter requires exactly PS4 firmware 11.00 or 11.02.";
    return;
  }

  var cache = window.applicationCache;
  if (!cache) {
    status.textContent = "Offline storage is unavailable. Reload with an internet connection.";
    return;
  }
  if (!navigator.onLine || cache.status === cache.IDLE) {
    setReady();
    return;
  }
  if (cache.status === cache.UPDATEREADY) {
    try { cache.swapCache(); } catch (_) {}
    status.textContent = "Offline update saved. Reload this page before starting GoldHEN.";
    return;
  }

  status.textContent = "Saving the complete starter for offline use…";
  cache.addEventListener("progress", function (event) {
    if (event && event.total) status.textContent = "Saving for offline use: " + Math.round(event.loaded / event.total * 100) + "%";
  }, false);
  cache.addEventListener("cached", function () { setReady(); }, false);
  cache.addEventListener("noupdate", function () { setReady(); }, false);
  cache.addEventListener("updateready", function () {
    try { cache.swapCache(); } catch (_) {}
    button.disabled = true;
    maintenance.disabled = true;
    status.textContent = "Offline update saved. Reload this page before starting GoldHEN.";
  }, false);
  cache.addEventListener("error", function () {
    button.disabled = true;
    maintenance.disabled = true;
    status.textContent = "Offline cache failed. Check the connection and reload; GoldHEN was not started.";
  }, false);
})();

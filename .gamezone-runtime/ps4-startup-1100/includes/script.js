(function () {
  var button = document.getElementById("jeilbrek");
  var checkbox = document.getElementById("autoJbInput");
  var ua = document.getElementById("UA");
  var status = document.getElementById("status");
  var netctrl = document.getElementById("netctrl-exploit");
  var lapse = document.getElementById("lapse-exploit");
  var form = document.getElementById("kernel-options");
  var timer = null;
  var started = false;

  window.exploitChain = "lapse";
  lapse.checked = true;
  checkbox.checked = true;
  ua.textContent = navigator.userAgent;

  function supported() {
    return /PlayStation 4[\\/ ]11\.00/.test(navigator.userAgent);
  }

  function stopTimer() {
    if (timer !== null) clearInterval(timer);
    timer = null;
  }

  function start() {
    if (started || !supported()) return;
    started = true;
    stopTimer();
    button.disabled = true;
    status.textContent = "Starting GoldHEN. Wait for the console notification…";
    try { window.doJb(); }
    catch (error) {
      started = false;
      button.disabled = false;
      status.textContent = "Startup failed. Cold-restart the PS4 before retrying.";
      document.getElementById("console").textContent = String(error && (error.message || error));
    }
  }

  function countdown(seconds) {
    if (started || !supported()) return;
    stopTimer();
    var left = seconds;
    status.textContent = "Offline starter ready. GoldHEN starts in " + left + "…";
    timer = setInterval(function () {
      left -= 1;
      if (left <= 0) return start();
      status.textContent = "Offline starter ready. GoldHEN starts in " + left + "…";
    }, 1000);
  }

  button.addEventListener("click", start);
  form.addEventListener("change", function (event) {
    window.exploitChain = event.target.value;
  });
  netctrl.checked = false;

  if (!supported()) {
    button.disabled = true;
    status.textContent = "STOP: this starter is only for PS4 firmware 11.00.";
    return;
  }

  var cache = window.applicationCache;
  if (!cache) return countdown(4);
  if (!navigator.onLine || cache.status === cache.IDLE || cache.status === cache.UPDATEREADY) {
    try { if (cache.status === cache.UPDATEREADY) cache.swapCache(); } catch (_) {}
    return countdown(4);
  }

  status.textContent = "Saving the complete starter for offline use…";
  cache.addEventListener("progress", function (event) {
    if (event && event.total) {
      status.textContent = "Saving for offline use: " + Math.round(event.loaded / event.total * 100) + "%";
    }
  }, false);
  cache.addEventListener("cached", function () { countdown(4); }, false);
  cache.addEventListener("noupdate", function () { countdown(4); }, false);
  cache.addEventListener("updateready", function () {
    try { cache.swapCache(); } catch (_) {}
    countdown(4);
  }, false);
  cache.addEventListener("error", function () {
    status.textContent = "Offline cache failed. Check the connection and reload this page.";
  }, false);
})();

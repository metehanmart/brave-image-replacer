(() => {
  "use strict";
  const storage = globalThis.ScenerySwap.storage;
  const enabled = document.getElementById("enabled");
  const status = document.getElementById("status");
  function error(message) { status.textContent = message; status.classList.add("error"); }
  async function refresh() {
    try {
      const settings = await storage.read();
      enabled.checked = settings.enabled;
      enabled.disabled = false;
      document.getElementById("count").textContent = settings.people.length;
      document.getElementById("state").textContent = settings.enabled
        ? `${settings.people.filter(person => person.enabled).length} active people · Changes apply to open webpages.`
        : "Paused · Original images restored on open webpages.";
    } catch { error("Could not load settings. Reopen the popup to try again."); }
  }
  enabled.addEventListener("change", async () => {
    enabled.disabled = true;
    status.textContent = "";
    try { await storage.setEnabled(enabled.checked); }
    catch { error("Could not save the switch. Please try again."); }
    await refresh();
  });
  document.getElementById("options").addEventListener("click", async () => {
    try { await chrome.runtime.openOptionsPage(); }
    catch { error("Could not open Options. Use the extension's Details page."); }
  });
  storage.subscribe(refresh);
  refresh();
})();

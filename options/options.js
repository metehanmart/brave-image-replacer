(() => {
  "use strict";
  const storage = globalThis.ScenerySwap.storage;
  const byId = id => document.getElementById(id);
  let people = [];
  let busy = false;
  const label = category => category[0].toUpperCase() + category.slice(1);

  function status(message, error = false) {
    byId("status").textContent = message;
    byId("status").classList.toggle("error", error);
  }

  function setBusy(value) {
    busy = value;
    byId("add-fields").disabled = value;
    byId("import-fields").disabled = value;
    byId("enabled").disabled = value;
    byId("people").querySelectorAll("input,select,button").forEach(control => { control.disabled = value; });
  }

  function render() {
    byId("people").replaceChildren();
    byId("count").textContent = `${people.length} configured · ${people.filter(person => person.enabled).length} active`;
    byId("empty").hidden = people.length > 0;
    byId("people-table").hidden = people.length === 0;
    for (const person of people) {
      const row = document.createElement("tr");
      const cells = Array.from({ length: 4 }, () => row.appendChild(document.createElement("td")));
      const toggle = document.createElement("input");
      toggle.type = "checkbox";
      toggle.checked = person.enabled;
      toggle.setAttribute("aria-label", `Enable ${person.name}`);
      toggle.addEventListener("change", () => changePerson(person.name, { enabled: toggle.checked }));
      cells[0].append(toggle);
      cells[1].textContent = person.name;
      const select = document.createElement("select");
      select.setAttribute("aria-label", `Replacement for ${person.name}`);
      storage.categories.forEach(category => select.add(new Option(label(category), category)));
      select.value = person.category;
      select.addEventListener("change", () => changePerson(person.name, { category: select.value }));
      cells[2].append(select);
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "remove";
      remove.textContent = "Remove";
      remove.setAttribute("aria-label", `Remove ${person.name}`);
      remove.addEventListener("click", () => changePerson(person.name, null));
      cells[3].append(remove);
      byId("people").append(row);
    }
  }

  async function refresh() {
    const settings = await storage.read();
    people = settings.people;
    byId("enabled").checked = settings.enabled;
    render();
  }

  async function save(action, message) {
    if (busy) return;
    setBusy(true);
    try {
      await action();
      await refresh();
      status(typeof message === "function" ? message() : message);
    } catch (error) {
      status(error.message || "Could not save settings. Please try again.", true);
      try { await refresh(); } catch { /* Keep the error visible if storage is unavailable. */ }
    } finally { setBusy(false); }
  }

  function changePerson(name, patch) {
    return save(async () => {
      const current = (await storage.read()).people;
      await storage.savePeople(patch === null ? current.filter(person => person.name !== name)
        : current.map(person => person.name === name ? { ...person, ...patch } : person));
    }, patch === null ? `${name} removed.` : `Saved changes for ${name}.`);
  }

  byId("enabled").addEventListener("change", () => {
    const enabled = byId("enabled").checked;
    save(() => storage.setEnabled(enabled), enabled ? "Image replacement enabled." : "Paused. Original images restored.");
  });

  byId("add-form").addEventListener("submit", event => {
    event.preventDefault();
    const name = storage.normalizeName(byId("name").value);
    const category = byId("category").value;
    save(async () => {
      if (!name || name.length > 120 || name.includes("|")) throw new Error("Enter a name of 1–120 characters without a | separator.");
      const current = (await storage.read()).people;
      if (current.some(person => storage.nameKey(person.name) === storage.nameKey(name))) throw new Error("That name is already in your list.");
      await storage.savePeople([...current, { name, category, enabled: true }]);
      byId("name").value = "";
    }, `${name} added.`);
  });

  byId("import-form").addEventListener("submit", event => {
    event.preventDefault();
    const file = byId("import-file").files[0];
    let message = "";
    save(async () => {
      if (!file || !/\.txt$/i.test(file.name)) throw new Error("Choose a .txt file.");
      if (file.size > 1024 * 1024) throw new Error("The file must be 1 MB or smaller.");
      const parsed = storage.parseImport(await file.text());
      if (parsed.errors.length) throw new Error(`Nothing imported. Fix these lines and try again:\n${parsed.errors.slice(0, 10).join("\n")}${parsed.errors.length > 10 ? `\n…and ${parsed.errors.length - 10} more invalid lines.` : ""}`);
      if (!parsed.people.length) throw new Error("The file contains no names.");
      const current = (await storage.read()).people;
      const existing = new Set(current.map(person => storage.nameKey(person.name)));
      const added = parsed.people.filter(person => !existing.has(storage.nameKey(person.name)));
      const skipped = parsed.people.length - added.length + parsed.duplicates;
      await storage.savePeople([...current, ...added]);
      message = `Imported ${added.length} people. Skipped ${skipped} duplicate names; existing settings were kept.`;
      byId("import-file").value = "";
    }, () => message);
  });

  storage.subscribe(async () => {
    if (busy) return;
    try { await refresh(); } catch { status("Could not refresh settings. Reload this page.", true); }
  });
  refresh().then(() => setBusy(false)).catch(() => status("Could not load settings. Reload this page to try again.", true));
})();

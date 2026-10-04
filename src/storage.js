(() => {
  "use strict";
  const app = globalThis.ScenerySwap = globalThis.ScenerySwap || {};
  const categories = ["galaxy", "nature", "planets", "forest", "random"];
  const normalizeName = value => String(value || "").normalize("NFKC").replace(/\s+/gu, " ").trim();
  const nameKey = value => normalizeName(value).toLocaleLowerCase("und");

  function sanitizePeople(value) {
    const seen = new Set();
    if (!Array.isArray(value)) return [];
    return value.flatMap(person => {
      if (!person || typeof person.name !== "string") return [];
      const name = normalizeName(person.name);
      const key = nameKey(name);
      if (!name || name.length > 120 || seen.has(key)) return [];
      seen.add(key);
      return [{ name, enabled: person.enabled !== false, category: categories.includes(person.category) ? person.category : "random" }];
    });
  }

  async function read() {
    const data = await chrome.storage.local.get({ enabled: true, people: [] });
    return { enabled: data.enabled !== false, people: sanitizePeople(data.people) };
  }

  function parseImport(text) {
    const people = [];
    const errors = [];
    String(text).replace(/^\uFEFF/u, "").split(/\r?\n|\r/u).forEach((line, index) => {
      if (!line.trim()) return;
      const parts = line.split("|").map(part => part.trim());
      const name = normalizeName(parts[0]);
      const category = parts.length === 1 ? "random" : parts[1].toLowerCase();
      if (parts.length > 2 || !name || name.length > 120 || !categories.includes(category)) {
        errors.push(`Line ${index + 1}: use a name (1–120 characters), optionally followed by | and a valid category.`);
        return;
      }
      people.push({ name, enabled: true, category });
    });
    return { people: sanitizePeople(people), errors, duplicates: people.length - sanitizePeople(people).length };
  }

  app.storage = {
    categories, normalizeName, nameKey, sanitizePeople, parseImport, read,
    setEnabled: enabled => chrome.storage.local.set({ enabled: Boolean(enabled) }),
    savePeople: people => chrome.storage.local.set({ people: sanitizePeople(people) }),
    subscribe(listener) {
      const callback = (changes, area) => {
        if (area === "local" && (changes.enabled || changes.people)) listener(changes);
      };
      chrome.storage.onChanged.addListener(callback);
      return () => chrome.storage.onChanged.removeListener(callback);
    }
  };
})();

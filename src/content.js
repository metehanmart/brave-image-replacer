(() => {
  "use strict";
  const app = globalThis.ScenerySwap;
  const replacements = app.replacements.create();
  const processed = new WeakMap();
  const pending = new Set();
  const force = new WeakSet();
  let settings = { enabled: false, people: [] };
  let people = [];
  let revision = 0;
  let timer = null;
  let stopped = false;
  let readVersion = 0;
  const observer = new MutationObserver(handleMutations);
  const observerOptions = {
    subtree: true, childList: true, characterData: true, attributes: true,
    attributeFilter: ["src", "srcset", "sizes", "alt", "title", "aria-label", "media", "type"]
  };

  function queue(image, changed = false) {
    if (image.tagName !== "IMG") return;
    pending.add(image);
    if (changed) force.add(image);
  }

  function queueSubtree(node) {
    if (node.nodeType !== 1) return;
    if (node.tagName === "IMG") queue(node, true);
    node.querySelectorAll("img").forEach(image => queue(image, true));
  }

  function queueNearby(node) {
    let element = node.nodeType === 1 ? node : node.parentElement;
    for (let depth = 0; depth < 4 && element; depth++, element = element.parentElement) {
      // Revisit old matches even if a second image or longer text invalidated their context.
      const nearby = app.matcher.inspectContainer(element, true);
      if (!nearby) break;
      nearby.images.forEach(image => queue(image, true));
    }
  }

  function handleMutations(records) {
    if (stopped || !settings.enabled) return;
    for (const record of records) {
      if (record.type === "attributes") {
        const owner = replacements.captureChange(record);
        if (owner) queue(owner, true);
        if (record.target.tagName === "IMG") queue(record.target, true);
        queueNearby(record.target);
      } else if (record.type === "childList") {
        record.addedNodes.forEach(queueSubtree);
        queueNearby(record.target);
      } else {
        queueNearby(record.target);
      }
    }
    schedule();
  }

  function schedule() {
    if (timer === null) timer = setTimeout(flush, 60);
  }

  function flush() {
    // Drain changes that happened since the callback before pausing observation.
    handleMutations(observer.takeRecords());
    if (timer !== null) clearTimeout(timer);
    timer = null;
    observer.disconnect();
    try {
      replacements.prune();
      if (!settings.enabled) {
        replacements.restoreAll();
        pending.clear();
        return;
      }
      // Bound work per tick on pages with very large image lists.
      let count = 0;
      for (const image of pending) {
        pending.delete(image);
        if (!image.isConnected) continue;
        const hints = app.matcher.context(image);
        const signature = JSON.stringify([revision, hints]);
        if (processed.get(image) !== signature || force.has(image)) {
          const person = app.matcher.match(hints, people);
          if (person) replacements.replace(image, person);
          else replacements.restore(image);
          processed.set(image, signature);
          force.delete(image);
        }
        if (++count >= 150) break;
      }
    } finally {
      if (!stopped && settings.enabled) observer.observe(document.documentElement, observerOptions);
      if (pending.size) schedule();
    }
  }

  async function reloadSettings() {
    const version = ++readVersion;
    try {
      const next = await app.storage.read();
      if (stopped || version !== readVersion) return;
      handleMutations(observer.takeRecords());
      settings = next;
      people = app.matcher.compile(settings.people);
      revision++;
      // Full scans are limited to startup and explicit configuration changes.
      if (settings.enabled) document.querySelectorAll("img").forEach(image => queue(image));
      flush();
    } catch (error) {
      stop();
      console.warn("Scenery Swap could not read settings; original images restored.", error);
    }
  }

  function stop() {
    handleMutations(observer.takeRecords());
    stopped = true;
    observer.disconnect();
    if (timer !== null) clearTimeout(timer);
    pending.clear();
    replacements.restoreAll();
  }

  app.storage.subscribe(reloadSettings);
  reloadSettings();
})();

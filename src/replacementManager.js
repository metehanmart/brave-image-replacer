(() => {
  "use strict";
  const app = globalThis.ScenerySwap;
  const imageAttributes = ["src", "srcset", "sizes"];
  const sourceAttributes = ["srcset"];
  const snapshot = (element, attributes) => new Map(attributes.map(name => [name, element.getAttribute(name)]));
  const write = (element, name, value) => {
    if (element.getAttribute(name) === value) return;
    if (value === null) element.removeAttribute(name);
    else element.setAttribute(name, value);
  };
  const restoreAttributes = (element, attributes) => attributes.forEach((value, name) => write(element, name, value));

  function create() {
    const active = new Map();
    const sourceOwners = new WeakMap();

    function releaseSource(source, attributes) {
      restoreAttributes(source, attributes);
      sourceOwners.delete(source);
    }

    function synchronizeSources(image, state) {
      const picture = image.parentElement?.tagName === "PICTURE" ? image.parentElement : null;
      const sources = picture ? Array.from(picture.children).filter(child => child.tagName === "SOURCE") : [];
      for (const [source, attributes] of state.sources) {
        if (!sources.includes(source)) {
          releaseSource(source, attributes);
          state.sources.delete(source);
        }
      }
      for (const source of sources) {
        if (!state.sources.has(source)) {
          state.sources.set(source, snapshot(source, sourceAttributes));
          sourceOwners.set(source, image);
        }
        write(source, "srcset", null);
      }
    }

    function restore(image) {
      const state = active.get(image);
      if (!state) return;
      restoreAttributes(image, state.attributes);
      state.sources.forEach((attributes, source) => releaseSource(source, attributes));
      active.delete(image);
    }

    function replace(image, person) {
      let state = active.get(image);
      const key = `${person.name}|${person.category}`;
      if (!state) {
        state = { attributes: snapshot(image, imageAttributes), sources: new Map(), key: null, url: null };
        active.set(image, state);
      }
      if (state.key !== key) {
        state.key = key;
        state.url = app.pickImage(person.category);
      }
      if (!state.url) { restore(image); return; }
      synchronizeSources(image, state);
      write(image, "srcset", null);
      write(image, "sizes", null);
      write(image, "src", state.url);
    }

    // Called only for page-authored mutations: our own writes happen with the observer paused.
    function captureChange(record) {
      const { target, attributeName } = record;
      const state = active.get(target);
      if (state && imageAttributes.includes(attributeName)) {
        state.attributes.set(attributeName, target.getAttribute(attributeName));
      }
      const owner = sourceOwners.get(target);
      if (owner && sourceAttributes.includes(attributeName)) {
        active.get(owner)?.sources.get(target)?.set(attributeName, target.getAttribute(attributeName));
      }
      return owner;
    }

    return {
      replace, restore, captureChange,
      has: image => active.has(image),
      restoreAll() { for (const image of active.keys()) restore(image); },
      prune() { for (const image of active.keys()) if (!image.isConnected) restore(image); }
    };
  }
  app.replacements = { create };
})();

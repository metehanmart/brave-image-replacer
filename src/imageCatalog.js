(() => {
  "use strict";
  const catalog = {
    galaxy: ["assets/galaxy/spiral.svg", "assets/galaxy/nebula.svg"],
    nature: ["assets/nature/mountains.svg", "assets/nature/meadow.svg"],
    planets: ["assets/planets/saturn.svg", "assets/planets/worlds.svg"],
    forest: ["assets/forest/pines.svg", "assets/forest/mist.svg"]
  };
  globalThis.ScenerySwap.catalog = catalog;
  globalThis.ScenerySwap.pickImage = category => {
    const choices = category === "random" ? Object.values(catalog).flat() : catalog[category];
    if (!choices?.length) return null;
    return chrome.runtime.getURL(choices[Math.floor(Math.random() * choices.length)]);
  };
})();

(() => {
  "use strict";
  const app = globalThis.ScenerySwap;
  const excluded = "SCRIPT,STYLE,NOSCRIPT,TEMPLATE,NAV,HEADER,FOOTER".split(",");
  const broadContainers = new Set(["HTML", "BODY", "MAIN", ...excluded]);

  // A strict traversal budget prevents a feed or page wrapper from becoming context.
  function inspectContainer(element, mutationCandidates = false) {
    if (!element || broadContainers.has(element.tagName)) return null;
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        return node.nodeType === 1 && excluded.includes(node.tagName)
          ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
      }
    });
    let node, visited = 0, text = "";
    const images = [];
    if (element.tagName === "IMG") images.push(element);
    while ((node = walker.nextNode())) {
      if (++visited > 100) return null;
      if (node.nodeType === 3) text += ` ${node.textContent}`;
      if (node.nodeType === 1 && node.tagName === "IMG") images.push(node);
      if ((!mutationCandidates && text.length > 800) || images.length > (mutationCandidates ? 8 : 1)) return null;
    }
    return { text, images };
  }

  function context(image) {
    const hints = ["alt", "title", "aria-label"].map(name => image.getAttribute(name) || "");
    let container = image.parentElement;
    for (let depth = 0; depth < 3 && container; depth++, container = container.parentElement) {
      const nearby = inspectContainer(container);
      if (!nearby || nearby.images[0] !== image) break;
      const caption = container.querySelector("figcaption");
      if (caption) hints.push(caption.textContent);
      const heading = container.querySelector("h1,h2,h3,h4,h5,h6,[role='heading']");
      if (heading) hints.push(heading.textContent);
      hints.push(container.getAttribute("aria-label") || "", container.getAttribute("title") || "", nearby.text);
    }
    return hints.map(app.storage.normalizeName);
  }

  function compile(people) {
    return people.filter(person => person.enabled).map(person => {
      const escaped = app.storage.normalizeName(person.name).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return { ...person, pattern: new RegExp(`(?:^|[^\\p{L}\\p{N}\\p{M}_])${escaped}(?=$|[^\\p{L}\\p{N}\\p{M}_])`, "iu") };
    });
  }

  function match(hints, people) {
    // Direct image metadata wins over surrounding text; list order breaks ties.
    for (const hint of hints) {
      const person = people.find(entry => entry.pattern.test(hint));
      if (person) return person;
    }
    return null;
  }
  app.matcher = { context, compile, match, inspectContainer };
})();

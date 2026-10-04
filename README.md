# Scenery Swap

A complete, build-free Manifest V3 extension for Brave and Chromium browsers. Replaces images associated with names you choose with locally bundled galaxy, nature, planet, or forest illustrations. Vanilla JavaScript, HTML, and CSS; no facial recognition, remote AI, telemetry, or external image requests.

## Vibe Coding Disclaimer

This project is fully vibe-coded.

I provide the idea and prompts, and AI generates the implementation. I do not manually review or write the code in any meaningful way.

Use at your own risk.

## Install in Brave

1. Open `brave://extensions`.
2. Turn on **Developer mode**.
3. Click **Load unpacked** and select this project folder (the folder containing `manifest.json`).
4. Pin **Scenery Swap** from the browser's Extensions menu if desired.
5. Open the popup, choose **Manage people & scenery**, and add names or import a text file.
6. Reload webpages that were already open before installation. Later settings changes apply automatically to pages with an active content script.

For Chrome, use `chrome://extensions`; for Edge, use `edge://extensions`. No build, dependency installation, API key, or service worker is required. The initial list is empty and the extension is enabled; nothing is replaced until you add an enabled person.

Use the **popup switch** or **Options switch** to pause replacements and restore original image attributes in open tabs. Disabling/uninstalling the extension through the browser's extension manager stops its scripts, so it cannot reliably run cleanup then: reload affected webpages to restore originals. Reload pages after updating/reloading the unpacked extension as well.

## Everyday use

- Add a full name, choose a category, and click **Add person**.
- Use each person's checkbox to enable or disable their matches.
- Change their dropdown to **Galaxy**, **Nature**, **Planets**, **Forest**, or **Random**.
- **Random** chooses uniformly from all registered images across all four categories.
- Remove a person to restore images that no longer match another enabled person.
- Changes save automatically in `chrome.storage.local` and are not synced to an account.
- The popup shows the total number of configured people and the active count.

## TXT import

Choose a UTF-8 `.txt` file up to 1 MB in Options, then select **Import names**. Both formats can be mixed:

```text
Person A
Person B
Person C | planets
Person D | galaxy
Person E | nature
Person F | forest
Person G | random
```

Names without a category use `random`. Category values are case-insensitive: `galaxy`, `nature`, `planets`, `forest`, `random`. Blank lines and a UTF-8 byte-order mark are ignored. Windows, Unix, and old-style Mac line endings are supported. Names are trimmed, Unicode-normalized (NFKC), and repeated whitespace is collapsed; names must contain 1–120 characters.

Duplicate names are compared case-insensitively. The first occurrence in a file wins, and an already-configured person keeps their existing category and enabled state. New imported people are enabled. Invalid lines cancel the entire import and display line numbers, so there are no partially applied imports. Comments and extra `|` separators are not supported. Try [examples/people.txt](examples/people.txt).

## How matching works

The matcher checks, in order:

1. The image's `alt`, `title`, and `aria-label`.
2. A nearby `figcaption` and heading.
3. Text, `title`, and `aria-label` in a small parent container.

Matching is case-insensitive, with Unicode-aware whole-name boundaries. For example, `Ann` matches `Ann speaks`, but not `Annabelle`. Regex characters in names are escaped. There is no fuzzy matching, automatic nickname expansion, or accent removal. Each text hint is matched independently; names are not formed by concatenating separate hints.

Context traversal climbs at most three parents, stops at broad containers (`body`, `main`, navigation, etc.), and rejects containers with more than one image, more than 800 characters, or more than 100 visited nodes. Script/style/template/navigation text is excluded. This deliberately favors avoiding false positives in multi-image feeds. Direct metadata wins over surrounding text; if multiple people match the same hint, the first configured person wins. One random image is chosen per match and remains stable until the person/category changes, the image is restored, or the page is reloaded.

## Architecture

```text
manifest.json               MV3 entry points, storage permission, exposed local assets
src/storage.js              Settings defaults, validation, TXT parser, storage subscription
src/imageCatalog.js         Category-to-file registry and random selection
src/imageMatcher.js         Bounded context extraction and whole-name matching
src/replacementManager.js   Responsive image replacement and original attribute snapshots
src/content.js              Initial scan, batched mutation handling, settings updates
popup/                     Global switch, people count, Options shortcut
options/                   People editor, per-person switches/categories, TXT import
shared/ui.css              Shared accessible UI styling
assets/{category}/         Eight original SVG illustrations, two in each category
icons/                     PNG extension icons at 16, 32, 48, and 128 pixels
examples/                  Sample names file
tests/                     Static and real-browser integration checks
tools/generate-assets.cjs  Reproducible artwork/icon generator (Node.js only)
```

Manifest content scripts execute in dependency order in Chromium's isolated world. Files share a small `ScenerySwap` namespace in that world; page JavaScript does not receive it. Popup and Options load the same storage helper with external, deferred scripts. No module loader, bundler, remote code, inline handlers, `eval`, or framework is used.

`chrome.storage.local` contains two keys: `enabled` (boolean, defaults to true) and `people` (array of `{ name, enabled, category }`, defaults to empty). All consumers listen for storage changes. Popup and Options write separate keys for the global switch and people list. People edits read the latest list before saving; simultaneous edits from multiple Options tabs are still last-write-wins.

### Dynamic pages and restoration

The content script scans all images once at startup and again on explicit settings changes. A `MutationObserver` then processes only added subtrees, modified images, and bounded nearby containers. It observes relevant attributes and text changes to support lazy loaders, caption updates, and reused image nodes. Work is coalesced over 60 ms and processed in batches of at most 150 images; there is no polling or continuous whole-document scan.

Processed fingerprints live in a `WeakMap`, so website attributes are not used as trusted markers. An active replacement map stores original `src`, `srcset`, and `sizes` attributes, preserving missing versus empty attributes. `<picture>` source `srcset` values are also saved and temporarily removed so they cannot override the replacement. Alt text, titles, styles, classes, links, and other original metadata are left intact.

The observer is paused during the extension's synchronous writes to avoid feedback loops, after draining pending page-authored changes. If the site changes image/source attributes while an image is replaced, those new values become the restore target. Removed replacement nodes are restored and released after the next mutation batch; reinserted images are processed again. Source nodes moved out of a picture are restored when that image is reconsidered. Turning off the switch disconnects observation and restores all tracked images. Re-enabling performs a fresh scan.

## Add replacement images

1. Put files into `assets/galaxy/`, `assets/nature/`, `assets/planets/`, or `assets/forest/`. PNG, JPG, WebP, GIF, and self-contained SVG images work. Prefer landscape images with reasonable dimensions/file sizes and no external resources.
2. Add their exact, case-sensitive relative paths to the appropriate array in `src/imageCatalog.js`:

   ```js
   galaxy: [
     "assets/galaxy/spiral.svg",
     "assets/galaxy/nebula.svg",
     "assets/galaxy/my-photo.jpg"
   ]
   ```

3. Reload the extension from `brave://extensions`, then reload your webpages.

Browsers cannot enumerate packaged directories at runtime; placing a file in a folder alone is not enough. The manifest already exposes files in the four category folders to webpages, so adding files inside them does not require a manifest change. Keep at least one registered image in each category and verify every path. The eight bundled SVGs are original code-generated illustrations, not downloaded photographs. Their generator can be rerun with `node tools/generate-assets.cjs`; it overwrites the bundled artwork and icons, but not custom filenames.

## Permissions and CSP

The only API permission is `storage`. Static content-script matches cover HTTP and HTTPS pages, including matching frames, so the browser asks for access to those websites. The extension does not need `tabs`, `scripting`, `activeTab`, remote hosts, or a background service worker. Grant website access in the browser if you have restricted it.

The extension page CSP allows scripts only from the extension package and disables objects. Only the four image directories are web-accessible. User names and import errors are rendered using text APIs, never interpreted as HTML. Settings stay local; packaged replacement images require no network access. Original page images may already have downloaded before the content script runs; this extension is not a network blocker.

Manifest structure follows Chrome's [content-script documentation](https://developer.chrome.com/docs/extensions/reference/manifest/content-scripts) and [web-accessible resource documentation](https://developer.chrome.com/docs/extensions/reference/manifest/web-accessible-resources).

## Verification

Run the dependency-free checks:

```sh
node tests/validate.cjs
```

Optional real-browser integration checks require Playwright as a **development-only** dependency and a local Brave installation:

```sh
npm install --no-save playwright
node tests/browser.cjs
```

Set `BROWSER_PATH` to another extension-capable Chromium executable if Brave is installed elsewhere. The default is `C:\Program Files\BraveSoftware\Brave-Browser\Application\brave.exe`. `PLAYWRIGHT_MODULE` optionally points to an existing Playwright package. The test starts a loopback-only HTTP fixture, loads the actual unpacked extension into an isolated `.browser-test-profile`, and creates ignored screenshots in `test-results/`. It does not use your normal browser profile. Some branded Chromium releases restrict command-line extension loading; use Brave or an automation-compatible Chromium build.

The tests cover manifest paths, JavaScript syntax, no inline scripts, categories, TXT parsing, Unicode and boundary matching, real image loading, metadata/context matching, dynamic insertion and text changes, responsive and lazy-load restoration, live settings, popup counts/switches, CRUD/import UI, mobile overflow, and runtime JavaScript errors.

## Known limitations

- Text is a heuristic: a named person may merely be mentioned beside an unrelated image; a portrait without identifying text will be missed. Full names help but cannot guarantee correct identification.
- Multiple images in a shared container are intentionally excluded from surrounding-text matching. Their own metadata can still match. Distant captions/headings and long or deeply nested articles may be missed.
- Only ordinary DOM `<img>` elements are supported. CSS backgrounds, canvas, SVG `<image>`, videos/posters, shadow roots, browser UI pages, the browser's PDF viewer, and restricted extension/store pages are outside scope. File URLs and non-HTTP(S) frames are not enabled.
- Since replacement starts at `document_idle`, an original image may briefly appear. Websites that continually rewrite images, use custom lazy-loading, or impose unusual rendering policies may interfere. Broken custom replacement paths are not automatically repaired.
- Layout follows the site's existing image styles and dimensions. Replacement aspect ratios can change layouts that rely on natural dimensions; cropping and presentation may differ between sites.
- Native extension disable/uninstall/reload cannot guarantee cleanup in existing documents; reload affected tabs. Use the built-in switch for immediate restoration.
- A site's lightbox, download links, or direct image URLs remain original. Replacement is visual, not access control, content removal, or a privacy filter.
- Very large name lists increase per-image matching time. Imports are capped at 1 MB, storage failures are reported, and multi-tab edits use last-write-wins semantics.

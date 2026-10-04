# Verification results

Verified on 2026-10-04 using Node.js 22.23.1 and locally installed Brave 154.1.96.61 (headless, isolated test profile).

- `node tests/validate.cjs`: PASS.
- `node tests/browser.cjs` with the bundled Playwright package: PASS.
- The actual unpacked MV3 extension loaded without manifest errors.
- Referenced scripts, styles, icons, and registered replacement image paths exist.
- All replacement images loaded successfully in a real webpage.
- Alt, title, aria-label, figcaption, heading, and small-container text matches worked.
- Whole-name boundaries, Unicode names, escaped regular-expression characters, and disabled people passed.
- Shared multi-image context was rejected; adding/removing a second image correctly restored/reapplied a previous context match.
- Dynamically inserted images, edited captions, changed metadata, detached/reinserted nodes, and images without an original src passed.
- Responsive `<picture>` sources and page-updated src/srcset/sizes values were restored after disabling.
- Random choices stayed stable while idle; no observer feedback loop occurred.
- Popup counts and switches, Options add/remove/toggle/category edits, duplicate imports, and atomic invalid-import rejection passed.
- No runtime JavaScript errors were observed in the integration run.
- Extension HTML contains no inline scripts or event handlers; the MV3 CSP uses packaged scripts only.
- Desktop and narrow Options layouts plus popup screenshots were generated and visually reviewed. No document-level horizontal overflow at 390 px was detected.

Generated screenshots are in the ignored `test-results/` directory. The isolated browser profile is in the ignored `.browser-test-profile/` directory. These are development artifacts and are not needed to install the extension.

Testing used controlled HTTP fixtures; it does not guarantee compatibility with every website. See the README's limitations, especially text-match ambiguity, unsupported image types, and restoration after native browser-level extension disable/uninstall.

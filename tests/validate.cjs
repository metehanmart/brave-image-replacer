const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
assert.equal(manifest.manifest_version, 3);
assert.deepEqual(manifest.permissions, ['storage']);
const exists = file => assert.ok(fs.existsSync(path.join(root, file)), `Missing ${file}`);
[...manifest.content_scripts.flatMap(script => script.js), ...Object.values(manifest.icons),
  ...Object.values(manifest.action.default_icon), manifest.action.default_popup, manifest.options_ui.page].forEach(exists);
const sandbox = { chrome: { runtime: { getURL: file => `chrome-extension://test/${file}` } } };
vm.createContext(sandbox);
for (const file of manifest.content_scripts[0].js) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  new vm.Script(source, {filename: file});
  if (!file.endsWith('content.js')) vm.runInContext(source, sandbox);
}
const app = sandbox.ScenerySwap;
Object.values(app.catalog).flat().forEach(exists);
for (const category of [...Object.keys(app.catalog), 'random']) assert.match(app.pickImage(category), /^chrome-extension:\/\/test\/assets\//);
const imported = app.storage.parseImport('\uFEFFPerson A\r\nPerson B | NATURE\nPerson A\n\nPerson C | planets');
assert.equal(imported.people.length, 3);
assert.equal(imported.duplicates, 1);
assert.equal(imported.people[0].category, 'random');
assert.equal(imported.people[1].category, 'nature');
assert.equal(imported.errors.length, 0);
assert.equal(app.storage.parseImport('Name | sea\nName | galaxy | bad\n | forest').errors.length, 3);
assert.equal(app.storage.sanitizePeople([{name:'  PERSON   A '}, {name:'person a'}, {name:''}, null]).length, 1);
const people = app.matcher.compile([{name:'Ann',enabled:true,category:'forest'}, {name:'A. (B)',enabled:true}, {name:'Person C',enabled:false}, {name:'İpek Yılmaz', enabled:true}]);
assert.equal(app.matcher.match(['Annabelle'], people), null);
assert.equal(app.matcher.match(['Joann'], people), null);
assert.equal(app.matcher.match(['ANN at a conference'], people).name, 'Ann');
assert.equal(app.matcher.match(['About A. (B).'], people).name, 'A. (B)');
assert.equal(app.matcher.match(['Person C'], people), null);
assert.equal(app.matcher.match(['İpek Yılmaz at work'], people).name, 'İpek Yılmaz');
for (const folder of ['popup', 'options']) {
  const html = fs.readFileSync(path.join(root, folder, `${folder}.html`), 'utf8');
  assert.ok(!/\son\w+\s*=|<script(?![^>]*\bsrc=)/i.test(html), 'Inline script or event handler');
  for (const match of html.matchAll(/(?:src|href)="([^"#]+)"/g)) exists(path.join(folder, match[1]));
  new vm.Script(fs.readFileSync(path.join(root, folder, `${folder}.js`), 'utf8'));
}
console.log('PASS: manifest, packaged paths, script syntax, CSP markup, catalog, imports, duplicates, Unicode and whole-name matching.');

// Optional integration test: npm install --no-save playwright, then node tests/browser.cjs.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const root = path.join(__dirname, '..');
const executablePath = process.env.BROWSER_PATH || 'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe';
const fixture = `<!doctype html><html><body>
<figure><picture><source srcset="/original.svg?wide 2x" media="(min-width: 1px)"><img id="direct" src="/original.svg" srcset="/original.svg?small 1x" sizes="50vw" alt="Person A speaking"></picture><figcaption>Conference</figcaption></figure>
<figure><img id="caption" src="/original.svg"><figcaption>Person B at work</figcaption></figure>
<article><h2>Person C in the news</h2><img id="heading" src="/original.svg"></article>
<div><img id="title" src="/original.svg" title="Person A"></div>
<div><img id="aria" src="/original.svg" aria-label="Person A"></div>
<div><img id="parent" src="/original.svg"><p>Interview with Person B.</p></div>
<div><img id="unmatched" src="/original.svg" alt="Person ABC"></div>
<div><h2>Person A</h2><img id="group1" src="/original.svg"><img id="group2" src="/original.svg"></div>
<div id="dynamic"></div></body></html>`;
const server = http.createServer((req, res) => {
  if (req.url.startsWith('/original.svg')) { res.setHeader('Content-Type', 'image/svg+xml'); res.end('<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="red"/></svg>'); }
  else { res.setHeader('Content-Type', 'text/html'); res.end(fixture); }
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let context;
  try {
    context = await chromium.launchPersistentContext(path.join(root, '.browser-test-profile'), {
      executablePath, headless: true,
      args: [`--disable-extensions-except=${root}`, `--load-extension=${root}`, '--no-first-run'],
      viewport: {width: 1120, height: 1100}
    });
    const errors = [];
    context.on('page', page => page.on('pageerror', error => errors.push(error.message)));
    const management = await context.newPage();
    await management.goto('chrome://extensions/');
    const extensions = await management.evaluate(() => new Promise(resolve => chrome.developerPrivate.getExtensionsInfo({includeDisabled:true}, resolve)));
    const extension = extensions.find(item => item.name === 'Scenery Swap');
    assert.ok(extension, 'Extension loaded');
    assert.equal(extension.manifestErrors?.length || 0, 0);
    const options = await context.newPage();
    await options.goto(`chrome-extension://${extension.id}/options/options.html`);
    await options.locator('#name').waitFor();
    await options.evaluate(async () => chrome.storage.local.set({ enabled: true, people: [
      {name:'Person A',enabled:true,category:'galaxy'}, {name:'Person B',enabled:true,category:'nature'}, {name:'Person C',enabled:true,category:'planets'}
    ] }));
    const page = await context.newPage();
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    const swapped = async (id, category) => page.waitForFunction(({id, category}) => document.getElementById(id)?.src.includes(`/assets/${category}/`), {id, category});
    for (const [id, category] of [['direct','galaxy'], ['caption','nature'], ['heading','planets'], ['title','galaxy'], ['aria','galaxy'], ['parent','nature']]) await swapped(id, category);
    for (const id of ['unmatched','group1','group2']) assert.equal(await page.locator(`#${id}`).getAttribute('src'), '/original.svg');
    assert.equal(await page.locator('source').getAttribute('srcset'), null);
    assert.equal(await page.locator('#direct').getAttribute('srcset'), null);
    await page.waitForFunction(() => [...document.images].every(image => image.complete && image.naturalWidth > 0));
    await page.evaluate(() => {
      const figure = document.createElement('figure');
      figure.innerHTML = '<img id="late" src="/original.svg"><figcaption>Person B</figcaption>';
      document.getElementById('dynamic').append(figure);
    });
    await swapped('late','nature');
    await page.locator('#late + figcaption').evaluate(node => { node.firstChild.data = 'Unrelated landscape'; });
    await page.waitForFunction(() => document.getElementById('late').getAttribute('src') === '/original.svg');
    await page.locator('#late').evaluate(node => node.setAttribute('alt','Person C'));
    await swapped('late','planets');
    await page.evaluate(() => {
      const figure = document.createElement('figure');
      figure.id = 'changing-context';
      figure.innerHTML = '<img id="context-only" src="/original.svg"><figcaption>Person B</figcaption>';
      document.getElementById('dynamic').append(figure);
    });
    await swapped('context-only', 'nature');
    await page.locator('#changing-context').evaluate(node => {
      const second = document.createElement('img'); second.src = '/original.svg'; node.append(second);
    });
    await page.waitForFunction(() => document.getElementById('context-only').getAttribute('src') === '/original.svg');
    await page.locator('#changing-context img:last-child').evaluate(node => node.remove());
    await swapped('context-only', 'nature');
    await page.locator('#late').evaluate(node => { window.detachedImage = node; node.remove(); });
    await page.waitForFunction(() => window.detachedImage.getAttribute('src') === '/original.svg');
    await page.evaluate(() => document.getElementById('dynamic').append(window.detachedImage));
    await swapped('late', 'planets');
    await page.evaluate(() => {
      const image = document.createElement('img'); image.id = 'no-original'; image.alt = 'Person C';
      document.getElementById('dynamic').append(image);
    });
    await swapped('no-original', 'planets');
    await page.locator('#direct').evaluate(node => { node.src = '/original.svg?updated'; node.srcset = '/original.svg?updated-2x 2x'; node.sizes = '80vw'; });
    await page.locator('source').evaluate(node => node.setAttribute('srcset','/original.svg?new-wide 2x'));
    await swapped('direct','galaxy');
    const stable = await page.locator('#direct').getAttribute('src');
    await page.waitForTimeout(250);
    assert.equal(await page.locator('#direct').getAttribute('src'), stable, 'Replacement stable across observer ticks');
    await options.evaluate(() => chrome.storage.local.set({enabled:false}));
    await page.waitForFunction(() => document.getElementById('direct').getAttribute('src') === '/original.svg?updated');
    assert.equal(await page.locator('#direct').getAttribute('srcset'), '/original.svg?updated-2x 2x');
    assert.equal(await page.locator('#direct').getAttribute('sizes'), '80vw');
    assert.equal(await page.locator('source').getAttribute('srcset'), '/original.svg?new-wide 2x');
    assert.equal(await page.locator('#no-original').getAttribute('src'), null, 'Missing original src remains missing');
    await options.evaluate(() => chrome.storage.local.set({enabled:true}));
    await swapped('direct','galaxy');
    await options.getByRole('combobox', {name:'Replacement for Person A', exact:true}).selectOption('forest');
    await swapped('direct','forest');
    await options.getByRole('checkbox', {name:'Enable Person A', exact:true}).uncheck();
    await page.waitForFunction(() => document.getElementById('direct').getAttribute('src') === '/original.svg?updated');
    await options.locator('#name').fill('Person D');
    await options.getByRole('button', {name:'Add person', exact:true}).click();
    await options.getByRole('button', {name:'Remove Person D', exact:true}).waitFor();
    await options.getByRole('button', {name:'Remove Person D', exact:true}).click();
    await options.getByRole('button', {name:'Remove Person D', exact:true}).waitFor({state:'detached'});
    await options.locator('#import-file').setInputFiles({name:'names.txt',mimeType:'text/plain',buffer:Buffer.from('Person A | nature\nPerson D | forest\nPerson E')});
    await options.getByRole('button', {name:'Import names', exact:true}).click();
    await options.getByRole('button', {name:'Remove Person E', exact:true}).waitFor();
    assert.match(await options.locator('#status').textContent(), /Imported 2 people/);
    await options.locator('#import-file').setInputFiles({name:'invalid.txt',mimeType:'text/plain',buffer:Buffer.from('Bad Person | invalid\nPerson F')});
    await options.getByRole('button', {name:'Import names', exact:true}).click();
    await options.waitForFunction(() => document.getElementById('status').textContent.includes('Nothing imported'));
    assert.equal(await options.getByRole('button', {name:'Remove Person F',exact:true}).count(), 0);
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extension.id}/popup/popup.html`);
    await popup.waitForFunction(() => document.getElementById('count').textContent === '5');
    await popup.locator('#enabled').uncheck();
    await page.waitForFunction(() => ![...document.images].some(image => image.src.startsWith('chrome-extension:')));
    await popup.locator('#enabled').check();
    await swapped('caption', 'nature');
    fs.mkdirSync(path.join(root, 'test-results'), {recursive:true});
    await options.screenshot({path:path.join(root,'test-results','options.png'),fullPage:true});
    await popup.setViewportSize({width:360,height:530});
    await popup.screenshot({path:path.join(root,'test-results','popup.png')});
    await options.setViewportSize({width:390,height:844});
    await options.screenshot({path:path.join(root,'test-results','options-mobile.png'),fullPage:true});
    assert.equal(await options.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'No mobile horizontal overflow');
    assert.deepEqual(errors, [], 'No runtime JavaScript errors');
    console.log('PASS: real Brave MV3 load, all text signals, conservative context, dynamic nodes and text, responsive/lazy restoration, settings, popup, CRUD, imports, local assets, mobile layout and runtime errors.');
  } finally { if (context) await context.close(); server.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

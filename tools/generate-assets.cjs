// Rebuild the bundled original vector illustrations and PNG icons. No dependencies.
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const root = path.join(__dirname, '..');
function svg(category, name, background, artwork) {
  const folder = path.join(root, 'assets', category);
  fs.mkdirSync(folder, { recursive: true });
  fs.writeFileSync(path.join(folder, `${name}.svg`), `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800"><defs><linearGradient id="sky" x2="0" y2="1">${background.map((color, i) => `<stop offset="${i / (background.length - 1)}" stop-color="${color}"/>`).join('')}</linearGradient></defs><path fill="url(#sky)" d="M0 0h1200v800H0z"/>${artwork}</svg>\n`);
}
const stars = Array.from({length: 95}, (_, i) => `<circle cx="${(i * 137 + 31) % 1200}" cy="${(i * 89 + 43) % 800}" r="${i % 4 === 0 ? 2.4 : 1.2}" fill="#f5edff" opacity="${.35 + (i % 5) * .14}"/>`).join('');
svg('galaxy', 'spiral', ['#161c3f', '#483766'], `${stars}<g transform="translate(620 405) rotate(-24)"><ellipse rx="400" ry="155" fill="#8471b0" opacity=".15"/><ellipse rx="310" ry="100" fill="#bca0d8" opacity=".2"/><ellipse rx="200" ry="60" fill="#d5bbdc" opacity=".3"/><ellipse rx="95" ry="28" fill="#fff0dc" opacity=".6"/><path d="M-400 60C-390-120 230-190 300-30S-150 135-185 30 105-65 130 0" fill="none" stroke="#c2a3d8" stroke-width="18" opacity=".45"/><ellipse rx="35" ry="18" fill="#fff1d4"/></g>`);
svg('galaxy', 'nebula', ['#11293e', '#46305e'], `<path d="M-60 570Q210 20 560 280T1280 120L1240 400Q860 730 570 470T-60 780" fill="#6879a2" opacity=".4"/><path d="M-70 690Q260 220 600 400T1280 230" fill="none" stroke="#bf94bd" stroke-width="120" opacity=".2"/>${stars}`);
svg('nature', 'mountains', ['#e0e9da', '#b9caba'], '<circle cx="870" cy="205" r="92" fill="#eed5a3"/><path d="M0 510L225 210 480 485 750 275 1200 540V800H0" fill="#8fa9a0"/><path d="M0 675L360 330 760 700 1030 400 1200 600V800H0" fill="#547e72"/><path d="M0 710Q280 490 600 680T1200 630V800H0" fill="#315a50"/><path d="M480 800Q710 640 920 710T1200 730V800" fill="#acc7b8"/>');
svg('nature', 'meadow', ['#b9d7d2', '#e0e7c3'], '<circle cx="870" cy="230" r="88" fill="#f5e2af"/><path d="M0 520Q280 310 590 520T1200 460V800H0" fill="#91af8b"/><path d="M0 660Q320 470 650 640T1200 560V800H0" fill="#547e60"/><path d="M0 790Q310 620 600 750T1200 690V800H0" fill="#345e4a"/>' + Array.from({length:35}, (_,i) => `<circle cx="${(i*97)%1200}" cy="${620+(i*43)%175}" r="4" fill="#edcf8e"/>`).join(''));
svg('planets', 'saturn', ['#162e43', '#44566a'], `${stars}<g transform="translate(610 400) rotate(-24)"><ellipse rx="400" ry="100" fill="none" stroke="#d1bba3" stroke-width="38"/><circle r="190" fill="#ceaa85"/><path d="M-170-85Q0-30 170-85M-187-20Q0 50 187-20M-174 75Q0 130 174 75" fill="none" stroke="#e6c5a0" stroke-width="24"/><path d="M-400 0A400 100 0 0 0 400 0" fill="none" stroke="#e6d4b8" stroke-width="38"/></g>`);
svg('planets', 'worlds', ['#152b3f', '#47516c'], `${stars}<circle cx="520" cy="450" r="230" fill="#71a2a4"/><path d="M360 280Q490 190 560 310T720 420Q610 520 580 630T360 610Q440 480 340 440T360 280" fill="#a0baa1"/><circle cx="890" cy="205" r="80" fill="#dcbb94"/><circle cx="950" cy="620" r="36" fill="#b5aaca"/>`);
function trees(color, baseline, step, height) { return `<g fill="${color}">` + Array.from({length: Math.ceil(1200/step)+1}, (_,i) => { const x=i*step; const h=height+(i%3)*22; return `<path d="M${x} ${baseline-h}l${step*.65} ${h}H${x-step*.65}z"/>`; }).join('') + '</g>'; }
svg('forest', 'pines', ['#d4dfcf', '#819e8a'], '<circle cx="830" cy="200" r="85" fill="#eee3bc"/>' + trees('#8ca998', 580, 120, 280) + trees('#597f6c', 710, 155, 390) + trees('#2d5749', 860, 195, 470));
svg('forest', 'mist', ['#dfe5d9', '#9eb9b0'], trees('#a4bcb1', 570, 105, 270) + '<path d="M0 460h1200v140H0z" fill="#e4e9de" opacity=".45"/>' + trees('#77998e', 710, 150, 330) + trees('#436d62', 870, 220, 430));

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0); }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const name = Buffer.from(type), length = Buffer.alloc(4), crc = Buffer.alloc(4);
  length.writeUInt32BE(data.length); crc.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, crc]);
}
fs.mkdirSync(path.join(root, 'icons'), {recursive: true});
for (const size of [16,32,48,128]) {
  const raw = Buffer.alloc((size*4+1)*size);
  for (let y=0;y<size;y++) for (let x=0;x<size;x++) {
    const a=x/size, b=y/size;
    let color=[40,92,72,255];
    if ((a-.72)**2+(b-.28)**2 < .013) color=[239,212,155,255];
    if (b > .77-Math.max(0, .35-Math.abs(a-.32))) color=[181,206,183,255];
    if (b > .94-Math.max(0, .39-Math.abs(a-.75))) color=[115,157,135,255];
    raw.set(color, y*(size*4+1)+1+x*4);
  }
  const ihdr=Buffer.alloc(13); ihdr.writeUInt32BE(size); ihdr.writeUInt32BE(size,4); ihdr[8]=8; ihdr[9]=6;
  const png=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',zlib.deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);
  fs.writeFileSync(path.join(root,'icons',`icon${size}.png`),png);
}
console.log('Created eight SVG illustrations and four PNG icons.');

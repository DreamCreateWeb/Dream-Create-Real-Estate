/* Render an asset from many angles and composite a labelled contact sheet.
   usage: node sheet.js "<query>" <outname> [extraQuery]
   e.g.   node sheet.js "rig=towtruck" towtruck
          node sheet.js "rig=towtruck" towtruck-wire "wire=1"
*/
const { chromium } = require('playwright-core');
const { execFileSync } = require('child_process');
const fs = require('fs');

const q = process.argv[2];
const out = process.argv[3] || 'sheet';
const extra = process.argv[4] ? '&' + process.argv[4] : '';
const TMP = '/tmp/claude-0/-home-user-Dream-Create-Real-Estate/8e82b1ec-b208-5a92-88de-028ae025534a/scratchpad/_tiles';

// azimuth, elevation(deg), zoom, label
const VIEWS = [
  [0,    2,  1.0, 'front'],
  [90,   2,  1.0, 'side R'],
  [180,  2,  1.0, 'back'],
  [270,  2,  1.0, 'side L'],
  [40,   22, 1.0, '3/4 high'],
  [40,   22, 2.0, '3/4 close'],
  [220,  22, 1.0, 'rear 3/4'],
  [0,    82, 1.0, 'top'],
];

(async () => {
  fs.mkdirSync(TMP, { recursive: true });
  const b = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'],
  });
  const files = [];
  for (const [a, el, zoom, label] of VIEWS) {
    const p = await b.newPage({ viewport: { width: 700, height: 560 }, deviceScaleFactor: 1.5 });
    const errs = [];
    p.on('pageerror', e => errs.push(e.message));
    p.setDefaultTimeout(90000);
    const url = `http://localhost:8123/lab/asset.html?${q}&a=${a}&el=${el}&zoom=${zoom}&grid=0&hud=0${extra}`;
    await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await p.waitForTimeout(9000);
    const f = `${TMP}/${out}-${label.replace(/[^a-z0-9]/gi,'')}.png`;
    await p.screenshot({ path: f });
    files.push([f, label]);
    if (errs.length) console.log(' ERR', label, errs[0].slice(0, 90));
    await p.close();
  }
  await b.close();

  // composite with PIL
  const py = `
from PIL import Image, ImageDraw
tiles = ${JSON.stringify(files)}
ims = [(Image.open(f), lb) for f, lb in tiles]
w, h = ims[0][0].size
cols, rows = 4, 2
sheet = Image.new("RGB", (w*cols, h*rows), (12,14,26))
d = ImageDraw.Draw(sheet)
for i, (im, lb) in enumerate(ims):
    x, y = (i % cols) * w, (i // cols) * h
    sheet.paste(im, (x, y))
    d.rectangle([x+6, y+6, x+16+9*len(lb), y+30], fill=(10,12,26))
    d.text((x+12, y+12), lb, fill=(255,201,138))
    d.rectangle([x, y, x+w-1, y+h-1], outline=(60,70,110))
sheet.thumbnail((2400, 2400), Image.LANCZOS)
sheet.save("/home/user/Dream-Create-Real-Estate/.preview/${out}-sheet.png", optimize=True)
print("sheet:", sheet.size)
`;
  console.log(execFileSync('python3', ['-c', py]).toString().trim());
})();

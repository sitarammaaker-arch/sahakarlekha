/* Export PNG versions of the logo masters into ../png/. */
import { Resvg } from '@resvg/resvg-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const LOGO = path.join(DIR, '..');
const OUT = path.join(LOGO, 'png');
fs.mkdirSync(OUT, { recursive: true });

const jobs = [
  // [svg, out, width, background]
  ['SL_B-02_tile_v1.0.svg', 'SL_B-02_tile_512.png', 512, null],
  ['SL_B-02_tile_v1.0.svg', 'SL_B-02_tile_1024.png', 1024, null],
  ['SL_B-02_tile_v1.0.svg', 'SL_B-02_tile_dp_800_white-bg.png', 800, '#ffffff'],
  ['SL_B-02_logo-horizontal_v1.0.svg', 'SL_B-02_logo-horizontal_2000.png', 2000, null],
  ['SL_B-02_logo-horizontal-reversed_v1.0.svg', 'SL_B-02_logo-horizontal-reversed_2000_navy-bg.png', 2000, '#153f79'],
  ['SL_B-02_logo-stacked_v1.0.svg', 'SL_B-02_logo-stacked_1200.png', 1200, null],
  ['SL_B-02_logo-with-tagline_v1.0.svg', 'SL_B-02_logo-with-tagline_2000.png', 2000, null],
  ['SL_B-02_tile-mono-white_v1.0.svg', 'SL_B-02_tile-mono-white_512.png', 512, null],
  ['SL_B-02_tile-mono-navy_v1.0.svg', 'SL_B-02_tile-mono-navy_512.png', 512, null],
];

for (const [svgFile, outFile, width, background] of jobs) {
  const svg = fs.readFileSync(path.join(LOGO, svgFile), 'utf8');
  const opts = { fitTo: { mode: 'width', value: width } };
  if (background) opts.background = background;
  const png = new Resvg(svg, opts).render().asPng();
  fs.writeFileSync(path.join(OUT, outFile), png);
  console.log('wrote png/' + outFile, `${(png.length / 1024).toFixed(0)}KB`);
}

/**
 * Consumer — Code 39 barcode encoder (pure, self-contained; no dependency).
 *
 * Code 39 is a checksum-free, widely-scannable symbology. Each character is 9 elements
 * (5 bars + 4 spaces, alternating bar,space,…,bar), 3 of which are wide (ratio 3:1). The
 * value is wrapped with the '*' start/stop character and a 1-unit inter-character gap.
 * Charset: 0-9 A-Z space - . $ / + % (input is upper-cased; unsupported chars are dropped).
 */

// Canonical Code 39 widths — 'n' = narrow, 'w' = wide, per element (bar,space,bar,…,bar).
const CODE39: Record<string, string> = {
  '0': 'nnnwwnwnn', '1': 'wnnwnnnnw', '2': 'nnwwnnnnw', '3': 'wnwwnnnnn', '4': 'nnnwwnnnw',
  '5': 'wnnwwnnnn', '6': 'nnwwwnnnn', '7': 'nnnwnnwnw', '8': 'wnnwnnwnn', '9': 'nnwwnnwnn',
  'A': 'wnnnnwnnw', 'B': 'nnwnnwnnw', 'C': 'wnwnnwnnn', 'D': 'nnnnwwnnw', 'E': 'wnnnwwnnn',
  'F': 'nnwnwwnnn', 'G': 'nnnnnwwnw', 'H': 'wnnnnwwnn', 'I': 'nnwnnwwnn', 'J': 'nnnnwwwnn',
  'K': 'wnnnnnnww', 'L': 'nnwnnnnww', 'M': 'wnwnnnnwn', 'N': 'nnnnwnnww', 'O': 'wnnnwnnwn',
  'P': 'nnwnwnnwn', 'Q': 'nnnnnnwww', 'R': 'wnnnnnwwn', 'S': 'nnwnnnwwn', 'T': 'nnnnwnwwn',
  'U': 'wwnnnnnnw', 'V': 'nwwnnnnnw', 'W': 'wwwnnnnnn', 'X': 'nwnnwnnnw', 'Y': 'wwnnwnnnn',
  'Z': 'nwwnwnnnn', '-': 'nwnnnnwnw', '.': 'wwnnnnwnn', ' ': 'nwwnnnwnn', '$': 'nwnwnwnnn',
  '/': 'nwnwnnnwn', '+': 'nwnnnwnwn', '%': 'nnnwnwnwn', '*': 'nwnnwnwnn',
};

export interface BarSegment { black: boolean; units: number; }

/** Sanitise to the Code 39 charset (upper-cased; unsupported chars dropped). */
export const sanitizeCode39 = (raw: string): string =>
  (raw || '').toUpperCase().split('').filter(c => c !== '*' && CODE39[c]).join('');

/** Segments for the full symbol (start '*' + chars + stop '*', 1-unit inter-char gaps). */
export function code39Segments(raw: string): BarSegment[] {
  const value = `*${sanitizeCode39(raw)}*`;
  const segs: BarSegment[] = [];
  for (let ci = 0; ci < value.length; ci++) {
    const pattern = CODE39[value[ci]];
    for (let ei = 0; ei < 9; ei++) {
      segs.push({ black: ei % 2 === 0, units: pattern[ei] === 'w' ? 3 : 1 });
    }
    if (ci < value.length - 1) segs.push({ black: false, units: 1 }); // inter-character gap
  }
  return segs;
}

/** Render the Code 39 symbol as an inline SVG string (for print labels). */
export function code39Svg(raw: string, opts: { unit?: number; height?: number; quiet?: number } = {}): string {
  const unit = opts.unit ?? 2, height = opts.height ?? 40, quiet = opts.quiet ?? 10;
  const segs = code39Segments(raw);
  const rects: string[] = [];
  let x = quiet;
  for (const s of segs) {
    if (s.black) rects.push(`<rect x="${x * unit}" y="0" width="${s.units * unit}" height="${height}" fill="#000"/>`);
    x += s.units;
  }
  const w = (x + quiet) * unit;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${height}" viewBox="0 0 ${w} ${height}">${rects.join('')}</svg>`;
}

// Loads NotoSansDevanagari TTF from CDN and caches it for jsPDF use.
// Called once at app startup; PDF functions use the cached base64 synchronously.

const FONT_URL =
  'https://cdn.jsdelivr.net/gh/googlefonts/noto-fonts@main/hinted/ttf/NotoSansDevanagari/NotoSansDevanagari-Regular.ttf';

let cachedFont: string | null = null;
let loadPromise: Promise<void> | null = null;

export function preloadHindiFont(): Promise<void> {
  if (cachedFont) return Promise.resolve();
  if (loadPromise) return loadPromise;

  loadPromise = fetch(FONT_URL)
    .then(res => {
      if (!res.ok) throw new Error(`Font fetch failed: ${res.status}`);
      return res.arrayBuffer();
    })
    .then(buffer => {
      const bytes = new Uint8Array(buffer);
      let binary = '';
      const chunk = 8192;
      for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode(...(bytes.subarray(i, i + chunk) as unknown as number[]));
      }
      cachedFont = btoa(binary);
    })
    .catch(err => {
      console.warn('[PDF] Hindi font could not be loaded — PDF will use English fallback.', err);
      loadPromise = null;
    });

  return loadPromise;
}

/** Returns the base64-encoded TTF string, or null if not yet loaded. */
export function getHindiFont(): string | null {
  return cachedFont;
}

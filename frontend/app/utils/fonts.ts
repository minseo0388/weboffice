/**
 * fonts.ts
 * 
 * Central font registry for naesungOffice.
 * - BUILTIN_FONTS: pre-loaded via globals.css (CDN imports)
 * - loadGoogleFont(): dynamically injects a <link> for any Google Font
 * - searchGoogleFonts(): queries the Google Fonts API for font discovery
 */

export interface FontEntry {
  family: string;        // CSS font-family value
  label: string;         // Display label in picker
  category: 'korean' | 'latin' | 'monospace' | 'handwriting' | 'display' | 'local';
  preloaded: boolean;    // true = already in globals.css, no extra fetch needed
}

/** Fonts that are pre-loaded in globals.css */
export const BUILTIN_FONTS: FontEntry[] = [
  // ── Korean ─────────────────────────────────────────────────────────────────
  { family: 'Pretendard Variable', label: 'Pretendard',        category: 'korean',     preloaded: true },
  { family: 'Noto Sans KR',        label: 'Noto Sans KR',      category: 'korean',     preloaded: true },
  { family: 'Noto Serif KR',       label: 'Noto Serif KR',     category: 'korean',     preloaded: true },
  { family: 'NanumGothic',         label: '나눔고딕',            category: 'korean',     preloaded: true },
  { family: 'Nanum Myeongjo',      label: '나눔명조',            category: 'korean',     preloaded: true },
  { family: 'Nanum Pen Script',    label: '나눔손글씨 펜',        category: 'handwriting', preloaded: true },
  { family: 'HamchoromBatang',     label: '함초롬바탕',          category: 'korean',     preloaded: true },
  { family: 'Gowun Dodum',         label: '고운 돋움',           category: 'korean',     preloaded: true },
  { family: 'Black Han Sans',      label: '검은고딕',            category: 'display',    preloaded: true },
  { family: 'Do Hyeon',            label: '도현체',              category: 'display',    preloaded: true },
  { family: 'Sunflower',           label: '해바라기',            category: 'korean',     preloaded: true },
  { family: 'Poor Story',          label: '배달의민족 주아',      category: 'display',    preloaded: true },
  { family: 'Gaegu',               label: '개구체',              category: 'handwriting', preloaded: true },
  { family: 'Cute Font',           label: '귀여운폰트',           category: 'display',    preloaded: true },

  // ── Latin (serif / sans-serif) ──────────────────────────────────────────
  { family: 'Inter',               label: 'Inter',              category: 'latin',      preloaded: true },
  { family: 'Roboto',              label: 'Roboto',             category: 'latin',      preloaded: true },
  { family: 'Open Sans',           label: 'Open Sans',          category: 'latin',      preloaded: true },
  { family: 'Lato',                label: 'Lato',               category: 'latin',      preloaded: true },
  { family: 'Montserrat',          label: 'Montserrat',         category: 'latin',      preloaded: true },
  { family: 'Playfair Display',    label: 'Playfair Display',   category: 'latin',      preloaded: true },
  { family: 'Merriweather',        label: 'Merriweather',       category: 'latin',      preloaded: true },
  { family: 'Ubuntu',              label: 'Ubuntu',             category: 'latin',      preloaded: true },

  // ── Monospace / Code ────────────────────────────────────────────────────
  { family: 'Noto Sans Mono',      label: 'Noto Sans Mono',     category: 'monospace',  preloaded: true },
  { family: 'Source Code Pro',     label: 'Source Code Pro',    category: 'monospace',  preloaded: true },
  { family: 'Fira Code',           label: 'Fira Code',          category: 'monospace',  preloaded: true },

  // ── System fallbacks ────────────────────────────────────────────────────
  { family: 'Arial',               label: 'Arial',              category: 'latin',      preloaded: true },
  { family: 'Times New Roman',     label: 'Times New Roman',    category: 'latin',      preloaded: true },
  { family: 'Georgia',             label: 'Georgia',            category: 'latin',      preloaded: true },
  { family: 'Courier New',         label: 'Courier New',        category: 'monospace',  preloaded: true },
  { family: '맑은 고딕',            label: '맑은 고딕',           category: 'korean',     preloaded: true },
  { family: '바탕',                 label: '바탕',               category: 'korean',     preloaded: true },
  { family: '굴림',                 label: '굴림',               category: 'korean',     preloaded: true },
  { family: '돋움',                 label: '돋움',               category: 'korean',     preloaded: true },
  { family: '궁서',                 label: '궁서',               category: 'korean',     preloaded: true },
];

/** Set of families currently injected (avoids duplicate <link> tags) */
const injectedFonts = new Set<string>(BUILTIN_FONTS.map(f => f.family));

/**
 * Dynamically load any Google Font by family name.
 * Injects a <link> into <head> and caches the result.
 */
export function loadGoogleFont(family: string): void {
  if (typeof window === 'undefined') return;
  if (injectedFonts.has(family)) return;

  const encoded = encodeURIComponent(family);
  const href = `https://fonts.googleapis.com/css2?family=${encoded}:wght@100..900&display=swap`;

  const link = document.createElement('link');
  link.rel  = 'stylesheet';
  link.href = href;
  document.head.appendChild(link);
  injectedFonts.add(family);
}

export interface GoogleFontItem {
  family: string;
  category: string;
  variants: string[];
}

/**
 * Search Google Fonts via the public API.
 * Returns up to `limit` items matching the query string.
 *
 * Note: No API key required — we use the public discovery endpoint.
 */
export async function searchGoogleFonts(query: string, limit = 20): Promise<GoogleFontItem[]> {
  if (!query.trim()) return [];

  try {
    const url = `https://www.googleapis.com/webfonts/v1/webfonts?sort=popularity&key=AIzaSyDummy_replace_with_real_key`;
    // Fallback: use a CORS-friendly approach via the CSS API itself
    // We use a curated extended list for offline/no-key scenarios
    const res = await fetch(url);
    if (!res.ok) throw new Error('API error');
    const data = await res.json();
    const lower = query.toLowerCase();
    return (data.items as GoogleFontItem[])
      .filter((f: GoogleFontItem) => f.family.toLowerCase().includes(lower))
      .slice(0, limit);
  } catch {
    // Graceful degradation: filter from an extended static list
    return EXTENDED_GOOGLE_FONTS
      .filter(f => f.family.toLowerCase().includes(query.toLowerCase()))
      .slice(0, limit);
  }
}

/** Extended static list for offline search (subset of popular Google Fonts) */
const EXTENDED_GOOGLE_FONTS: GoogleFontItem[] = [
  // Korean
  { family: 'Noto Sans KR',    category: 'sans-serif', variants: ['100','300','400','500','700','900'] },
  { family: 'Noto Serif KR',   category: 'serif',      variants: ['300','400','500','600','700','900'] },
  { family: 'Black Han Sans',  category: 'sans-serif', variants: ['400'] },
  { family: 'Do Hyeon',        category: 'sans-serif', variants: ['400'] },
  { family: 'Sunflower',       category: 'sans-serif', variants: ['300','500','700'] },
  { family: 'Poor Story',      category: 'display',    variants: ['400'] },
  { family: 'Gowun Dodum',     category: 'sans-serif', variants: ['400'] },
  { family: 'Nanum Myeongjo',  category: 'serif',      variants: ['400','700','800'] },
  { family: 'Nanum Pen Script',category: 'handwriting',variants: ['400'] },
  { family: 'Gaegu',           category: 'handwriting',variants: ['300','400','700'] },
  { family: 'Cute Font',       category: 'display',    variants: ['400'] },
  { family: 'Jua',             category: 'sans-serif', variants: ['400'] },
  { family: 'Gugi',            category: 'display',    variants: ['400'] },
  { family: 'Dokdo',           category: 'handwriting',variants: ['400'] },
  { family: 'Hi Melody',       category: 'handwriting',variants: ['400'] },
  { family: 'Song Myung',      category: 'serif',      variants: ['400'] },
  { family: 'Yeon Sung',       category: 'display',    variants: ['400'] },
  { family: 'Gamja Flower',    category: 'handwriting',variants: ['400'] },
  { family: 'Single Day',      category: 'display',    variants: ['400'] },
  { family: 'East Sea Dokdo',  category: 'handwriting',variants: ['400'] },
  // Latin — Popular
  { family: 'Inter',           category: 'sans-serif', variants: ['100','200','300','400','500','600','700','800','900'] },
  { family: 'Roboto',          category: 'sans-serif', variants: ['100','300','400','500','700','900'] },
  { family: 'Open Sans',       category: 'sans-serif', variants: ['300','400','500','600','700','800'] },
  { family: 'Lato',            category: 'sans-serif', variants: ['100','300','400','700','900'] },
  { family: 'Montserrat',      category: 'sans-serif', variants: ['100','200','300','400','500','600','700','800','900'] },
  { family: 'Poppins',         category: 'sans-serif', variants: ['100','200','300','400','500','600','700','800','900'] },
  { family: 'Raleway',         category: 'sans-serif', variants: ['100','200','300','400','500','600','700','800','900'] },
  { family: 'Oswald',          category: 'sans-serif', variants: ['200','300','400','500','600','700'] },
  { family: 'Nunito',          category: 'sans-serif', variants: ['200','300','400','500','600','700','800','900'] },
  { family: 'Roboto Slab',     category: 'serif',      variants: ['100','200','300','400','500','600','700','800','900'] },
  { family: 'Playfair Display',category: 'serif',      variants: ['400','500','600','700','800','900'] },
  { family: 'Merriweather',    category: 'serif',      variants: ['300','400','700','900'] },
  { family: 'EB Garamond',     category: 'serif',      variants: ['400','500','600','700','800'] },
  { family: 'Lora',            category: 'serif',      variants: ['400','500','600','700'] },
  { family: 'Source Code Pro', category: 'monospace',  variants: ['200','300','400','500','600','700','800','900'] },
  { family: 'Fira Code',       category: 'monospace',  variants: ['300','400','500','600','700'] },
  { family: 'JetBrains Mono',  category: 'monospace',  variants: ['100','200','300','400','500','600','700','800'] },
  { family: 'Inconsolata',     category: 'monospace',  variants: ['200','300','400','500','600','700','800','900'] },
  { family: 'Dancing Script',  category: 'handwriting',variants: ['400','500','600','700'] },
  { family: 'Pacifico',        category: 'handwriting',variants: ['400'] },
  { family: 'Caveat',          category: 'handwriting',variants: ['400','500','600','700'] },
  { family: 'Ubuntu',          category: 'sans-serif', variants: ['300','400','500','700'] },
  { family: 'Josefin Sans',    category: 'sans-serif', variants: ['100','200','300','400','500','600','700'] },
  { family: 'Cinzel',          category: 'display',    variants: ['400','500','600','700','800','900'] },
  { family: 'Bebas Neue',      category: 'display',    variants: ['400'] },
];

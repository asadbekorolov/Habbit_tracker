// Poster PNG uchun shriftlar: html-to-image SVG ichida veb-shriftlarni
// faqat ichiga joylangan (data URL) holda ko'radi. Google Fonts'dan faqat
// kerakli shrift/qalinlik va lotin + kirill to'plamlari olinadi, bir marta
// xotirada saqlanadi. Yuklanmasa (oflayn) — null, poster tizim shrifti bilan.
const CSS_URL =
  "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Geist+Mono:wght@500;700&display=swap";
const KEEP_SUBSETS = new Set(["latin", "latin-ext", "cyrillic", "cyrillic-ext"]);

let cached: Promise<string | null> | null = null;

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return await Promise.race([p, new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);
}

async function toDataUrl(url: string): Promise<string> {
  const blob = await (await fetch(url)).blob();
  return await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

/** "/* latin *\/ @font-face {...}" bloklaridan keraklilarini ajratadi */
export function pickFontFaces(css: string): string[] {
  const out: string[] = [];
  const re = /\/\*\s*([a-z-]+)\s*\*\/\s*(@font-face\s*\{[^}]*\})/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(css))) if (KEEP_SUBSETS.has(m[1])) out.push(m[2]);
  return out;
}

async function build(): Promise<string | null> {
  try {
    const css = await withTimeout(fetch(CSS_URL).then((r) => (r.ok ? r.text() : Promise.reject(new Error(String(r.status))))), 4000);
    const faces = pickFontFaces(css);
    if (!faces.length) return null;
    const embedded = await withTimeout(
      Promise.all(
        faces.map(async (face) => {
          const url = /url\((['"]?)([^)'"]+)\1\)/.exec(face)?.[2];
          if (!url) return face;
          return face.replace(url, await toDataUrl(url));
        }),
      ),
      8000,
    );
    return embedded.join("\n");
  } catch {
    return null;
  }
}

export function getPosterFontCSS(): Promise<string | null> {
  if (!cached) {
    cached = build().then((css) => {
      if (!css) cached = null; // keyingi safar qayta urinish
      return css;
    });
  }
  return cached;
}

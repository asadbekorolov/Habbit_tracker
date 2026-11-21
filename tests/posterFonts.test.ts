// Ishga tushirish: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickFontFaces } from '../src/utils/posterFonts.ts';

test("poster shriftlari: faqat lotin va kirill to'plamlari olinadi", () => {
  const css = [
    "/* cyrillic */\n@font-face { font-family: 'Inter'; src: url(https://x/c.woff2) format('woff2'); }",
    "/* greek */\n@font-face { font-family: 'Inter'; src: url(https://x/g.woff2) format('woff2'); }",
    "/* vietnamese */\n@font-face { font-family: 'Inter'; src: url(https://x/v.woff2) format('woff2'); }",
    "/* latin-ext */\n@font-face { font-family: 'Geist Mono'; src: url(https://x/le.woff2) format('woff2'); }",
    "/* latin */\n@font-face { font-family: 'Geist Mono'; src: url(https://x/l.woff2) format('woff2'); }",
  ].join('\n');
  const faces = pickFontFaces(css);
  assert.equal(faces.length, 3);
  assert.ok(faces.every((f) => f.startsWith('@font-face')));
  assert.ok(faces.some((f) => f.includes('c.woff2')) && faces.some((f) => f.includes('l.woff2')) && faces.some((f) => f.includes('le.woff2')));
  assert.ok(!faces.some((f) => f.includes('g.woff2') || f.includes('v.woff2')));
  assert.deepEqual(pickFontFaces(''), []);
});

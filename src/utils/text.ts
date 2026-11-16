// O‘ / oʻ / o’ / g‘ kabi turli apostroflarni ilovadagi yagona standart — oddiy
// ' belgisiga keltiradi (nomlar, qidiruv va kategoriya aniqlash bir xil ishlashi uchun).
export function normalizeApostrophes(s: string): string {
  return (s || '').replace(/[‘’ʻʼ`]/g, "'");
}

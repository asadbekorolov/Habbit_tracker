// Boshqa foydalanuvchining ko'rinadigan ismi: haqiqiy to'liq ism (full_name),
// bo'lmasa display_name, oxirida @username. Ro'yxatlar, guruhlar va reyting uchun yagona manba.

export interface NamedProfile {
  full_name?: string | null;
  display_name?: string | null;
  username?: string | null;
}

export function publicName(p: NamedProfile | null | undefined, fallback = '?'): string {
  if (!p) return fallback;
  const full = (p.full_name || '').trim();
  if (full) return full;
  const display = (p.display_name || '').trim();
  if (display) return display;
  const u = (p.username || '').trim();
  return u ? `@${u}` : fallback;
}

/** "Ali Valiyev" -> "AV" */
export function nameInitials(name: string): string {
  return name.replace(/^@/, '').split(/\s+/).filter(Boolean).map((w) => w[0]).join('').toUpperCase().slice(0, 2) || '?';
}

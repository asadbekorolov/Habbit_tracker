export function getHabitOrder(userId: string): string[] {
  try {
    const raw = localStorage.getItem(`habit_order_${userId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function setHabitOrder(userId: string, habitIds: string[]): void {
  try {
    localStorage.setItem(`habit_order_${userId}`, JSON.stringify(habitIds));
  } catch {
    // private-browsing yoki to'lgan storage — tartib faqat shu sessiya uchun saqlanmaydi
  }
}

export function sortByOrder<T extends { id: string }>(items: T[], userId: string): T[] {
  const order = getHabitOrder(userId);
  if (!order.length) return items;
  return [...items].sort((a, b) => {
    const ai = order.indexOf(a.id);
    const bi = order.indexOf(b.id);
    if (ai === -1 && bi === -1) return 0;
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
}

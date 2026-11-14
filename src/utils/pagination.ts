// PostgREST bitta javobda ko'pi bilan 1000 qator qaytaradi; undan ortig'i
// jimgina kesilib qolardi. Bu yordamchi barqaror tartib bilan 1000 lik
// bo'laklarni ketma-ket so'raydi (so'rov `.order(...)` bilan berilishi shart).

export const PAGE_SIZE = 1000;
const MAX_PAGES = 200; // xavfsizlik chegarasi: 200 000 qator

export async function fetchAllPages<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }>,
  pageSize: number = PAGE_SIZE
): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < MAX_PAGES; i++) {
    const from = i * pageSize;
    const { data, error } = await page(from, from + pageSize - 1);
    if (error) throw error;
    const rows = data || [];
    out.push(...rows);
    if (rows.length < pageSize) break;
  }
  return out;
}

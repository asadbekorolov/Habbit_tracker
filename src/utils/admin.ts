// Admin Panel faqat bitta hisobga tegishli. Baza darajasida ham xuddi shu
// email bilan cheklangan (051_admin_email_guard.sql: is_site_admin()).
export const SITE_ADMIN_EMAIL = 'asadbekorolov0@gmail.com';

export function isSiteAdminEmail(email: string | null | undefined): boolean {
  return !!email && email.trim().toLowerCase() === SITE_ADMIN_EMAIL;
}

/** Admin: bazadagi belgi (profiles.is_admin) VA kirgan emaili — ikkalasi ham shart. */
export function isSiteAdmin(profile: { is_admin?: boolean | null } | null | undefined, email: string | null | undefined): boolean {
  return !!profile?.is_admin && isSiteAdminEmail(email);
}

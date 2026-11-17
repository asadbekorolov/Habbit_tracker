import { useUser } from '../store/UserContext';
import { isSiteAdmin } from '../utils/admin';

/** Joriy foydalanuvchi Admin Panelni ko'ra oladimi (email + bazadagi belgi). */
export function useIsSiteAdmin(): boolean {
  const { profile, session } = useUser();
  return isSiteAdmin(profile, session?.user?.email);
}

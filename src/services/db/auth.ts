// db/auth.ts — Kirish, ro'yxatdan o'tish, Google, sessiya.
// Eski importlar uchun hammasi src/services/db.ts orqali qayta eksport qilinadi.

import { supabase } from '../supabase'
import type { Profile } from '../supabase'
import { AVATAR_COLORS, PUBLIC_PROFILE_COLUMNS, getMyProfile, getMyProfileOrThrow } from './core'

// ─── AUTH ──────────────────────────────────────────────────
export async function signInUser(email: string, password: string): Promise<Profile> {
  const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
  if (authError) throw authError

  const data = await getMyProfileOrThrow()

  if (data.is_banned) {
    await supabase.auth.signOut();
    throw new Error("Sizning akkauntingiz ma'muriyat tomonidan bloklangan.");
  }

  return data
}

export async function resetUserPassword(email: string) {
  const isMobile = window.location.protocol !== 'http:' && window.location.protocol !== 'https:';
  // Use custom deep-link scheme for native app or production URL for web
  const redirectToUrl = isMobile
    ? 'com.idrok.app://reset-password'
    : `${window.location.origin}/reset-password`;

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: redirectToUrl,
  });
  if (error) throw error;
}

export async function resendConfirmationEmail(email: string) {
  const { error } = await supabase.auth.resend({ type: 'signup', email });
  if (error) throw error;
}

// Ro'yxatdan o'tish endi to'g'ridan-to'g'ri emailga 6 xonali kod
// yuborishdan boshlanadi (avvalgi telefon-SMS OTP oqimi bilan bir xil
// shakl) — parol faqat kod tasdiqlangandan keyin o'rnatiladi, shuning
// uchun tasdiqlanmagan email bilan hech qachon ishlaydigan akkaunt
// yaratilmaydi.
export async function sendEmailOtp(email: string) {
  const { error } = await supabase.auth.signInWithOtp({ email });
  if (error) throw error;
}

export async function verifyEmailOtpAndCreateAccount(
  email: string,
  token: string,
  password: string,
  displayName: string,
  username: string
): Promise<Profile> {
  const { data: existingUsername } = await supabase
    .from('profiles')
    .select('username')
    .eq('username', username)
    .maybeSingle();
  if (existingUsername) throw new Error("Bu username allaqachon band. Iltimos, boshqasini tanlang");

  const { error: otpError } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
  if (otpError) throw otpError;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Foydalanuvchi topilmadi");

  // Agar bu email allaqachon ro'yxatdan o'tgan bo'lsa, signInWithOtp uni
  // shunchaki tizimga kiritadi (login sifatida) — profil borligini
  // tekshirmasak, "ro'yxatdan o'tish" oqimi uning mavjud parolini
  // qayta yozib yuborishi mumkin edi.
  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .maybeSingle();
  if (existingProfile) {
    await supabase.auth.signOut();
    throw new Error("Bu email allaqachon ro'yxatdan o'tgan — Kirish tabiga o'ting");
  }

  const { error: updateError } = await supabase.auth.updateUser({ password });
  if (updateError) throw updateError;

  const color = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
  const { error } = await supabase
    .from('profiles')
    .upsert({ id: user.id, username, display_name: displayName, avatar_color: color });
  if (error) throw error;
  return getMyProfileOrThrow();
}

export async function deleteOwnAccount() {
  const { error } = await supabase.rpc('delete_own_account');
  if (error) throw error;
  await supabase.auth.signOut();
}

export async function updateUserPassword(newPassword: string) {
  const { data, error } = await supabase.auth.updateUser({
    password: newPassword
  });
  if (error) throw error;
  return data;
}

export async function signOutUser() {
  try {
    await supabase.auth.signOut();
  } catch (e) {
    console.warn("signOutUser error:", e);
  }
}

export async function getProfileById(userId: string): Promise<Profile> {
  // O'z profili — to'liq (shaxsiy ustunlar bilan); boshqalarniki — faqat ochiq ustunlar.
  const { data: { session } } = await supabase.auth.getSession()
  let data: Profile
  if (session?.user?.id === userId) {
    data = await getMyProfileOrThrow()
  } else {
    const res = await supabase
      .from('profiles')
      .select(PUBLIC_PROFILE_COLUMNS)
      .eq('id', userId)
      .single()
    if (res.error) throw res.error
    data = res.data as unknown as Profile
  }

  // Merge local cached biometrics if database columns are awaiting schema cache refresh
  try {
    const rawLocal = localStorage.getItem(`user_biometrics_${userId}`);
    if (rawLocal) {
      const localBio = JSON.parse(rawLocal);
      return {
        ...data,
        birth_date: data.birth_date || localBio.birth_date || null,
        height_cm: data.height_cm || localBio.height_cm || null,
        weight_kg: data.weight_kg || localBio.weight_kg || null,
      };
    }
  } catch {}

  return data
}

export async function updateBiometrics(
  userId: string,
  heightCm: number,
  weightKg: number,
  birthDateStr: string
): Promise<Profile> {
  const numHeight = Number(heightCm);
  const numWeight = Number(weightKg);

  // 1. Format date strictly as YYYY-MM-DD
  let formattedDate = birthDateStr;
  let birthYear = 2000;
  try {
    const d = new Date(birthDateStr);
    if (!isNaN(d.getTime())) {
      const year = d.getFullYear();
      birthYear = year;
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      formattedDate = `${year}-${month}-${day}`;
    }
  } catch {}

  // Save to local storage cache so local UI profile state retains biometrics immediately
  try {
    localStorage.setItem(`user_biometrics_${userId}`, JSON.stringify({
      height_cm: numHeight,
      weight_kg: numWeight,
      birth_date: formattedDate,
      birth_year: birthYear,
    }));
  } catch (e) {
    console.warn("LocalStorage biometrics caching warning:", e);
  }

  // 2. Update (047 migratsiyasi birth_date/birth_year/height_cm/weight_kg
  //    ustunlari mavjudligini kafolatlaydi). Natija get_my_profile() orqali
  //    o'qiladi — profiles'dan select('*') endi ruxsat etilmaydi.
  try {
    const payload: Record<string, any> = {
      birth_date: formattedDate,
      height_cm: numHeight,
      weight_kg: numWeight,
    };
    if (!isNaN(birthYear) && birthYear > 1900) {
      payload.birth_year = birthYear;
    }

    const { error } = await supabase
      .from('profiles')
      .update(payload)
      .eq('id', userId);

    if (error) {
      console.error("Supabase Biometrics Update Error:", error);
    } else {
      const fresh = await getMyProfile();
      if (fresh) {
        return {
          ...fresh,
          birth_date: formattedDate,
          height_cm: numHeight,
          weight_kg: numWeight,
        };
      }
    }

    // Return locally cached metrics if DB schema rejected column
    return {
      id: userId,
      birth_date: formattedDate,
      height_cm: numHeight,
      weight_kg: numWeight,
    } as any;

  } catch (err: any) {
    console.error("Uncaught Biometrics Update Exception:", err);

    // Return locally augmented profile so user is NEVER blocked from onboarding
    return {
      id: userId,
      birth_date: formattedDate,
      height_cm: numHeight,
      weight_kg: numWeight,
    } as any;
  }
}

export async function ensureProfileForUser(user: any): Promise<Profile> {
  const existingProfile = await getMyProfile().catch(() => null);

  if (existingProfile) {
    if (existingProfile.is_banned) {
      await supabase.auth.signOut();
      throw new Error("Sizning akkauntingiz ma'muriyat tomonidan bloklangan.");
    }
    return existingProfile;
  }

  const meta = user.user_metadata || {};
  const email = user.email || '';
  const rawName = meta.full_name || meta.name || email.split('@')[0] || 'User';
  const cleanUsername = (email.split('@')[0] || 'user').toLowerCase().replace(/[^a-z0-9_]/g, '') + '_' + Math.floor(Math.random() * 1000);
  const color = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];

  const { error } = await supabase
    .from('profiles')
    .upsert({
      id: user.id,
      display_name: rawName,
      full_name: rawName,
      username: cleanUsername,
      avatar_url: meta.avatar_url || meta.picture || null,
      avatar_color: color,
    });

  if (error) throw error;
  return getMyProfileOrThrow();
}

export async function createProfileForGoogleUser(
  user: any,
  displayName: string,
  username: string
): Promise<Profile> {
  const { data: existingUsername } = await supabase
    .from('profiles')
    .select('username')
    .eq('username', username)
    .maybeSingle();
  if (existingUsername) {
    throw new Error("Bu username allaqachon band. Iltimos, boshqasini tanlang");
  }

  const meta = user.user_metadata || {};
  const color = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];

  const { error } = await supabase
    .from('profiles')
    .upsert({
      id: user.id,
      display_name: displayName,
      full_name: displayName,
      username: username,
      avatar_url: meta.avatar_url || meta.picture || null,
      avatar_color: color,
    });

  if (error) throw error;

  try {
    await supabase.auth.updateUser({ data: { registration_completed: true } });
  } catch (_) {}

  return getMyProfileOrThrow();
}

// Faqat foydalanuvchi o'zgartira oladigan ustunlar (047 GRANT UPDATE ro'yxati).
// Ramka/unvon — equipCosmetic(), yaltiroq ism — purchaseShopItem() orqali.
export async function updateUserProfile(
  userId: string,
  updates: {
    display_name?: string; full_name?: string; username?: string; avatar_url?: string | null;
    bio?: string | null; telegram_username?: string | null;
    instagram_username?: string | null; telegram_private?: boolean;
    profile_private?: boolean; avatar_color?: string;
    height_cm?: number | null;
    weight_kg?: number | null;
    birth_date?: string | null;
  }
): Promise<Profile> {
  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
  if (error) throw error
  return getMyProfileOrThrow()
}

// Ramka yoki unvonni taqish/yechish — egalik serverda tekshiriladi.
export async function equipCosmetic(kind: 'frame' | 'title', itemId: string | null): Promise<Profile> {
  const { error } = await supabase.rpc('equip_cosmetic', { p_kind: kind, p_item_id: itemId })
  if (error) throw new Error(error.message.includes('not_owned') ? "Bu buyum sizda yo'q yoki muddati tugagan" : error.message)
  return getMyProfileOrThrow()
}

export async function uploadAvatar(userId: string, file: File): Promise<string> {
  if (file.size > 2 * 1024 * 1024) throw new Error("Rasm hajmi 2MB dan oshmasligi kerak")
  const ext = file.name.split('.').pop()?.toLowerCase()
  if (!ext || !['jpg', 'jpeg', 'png', 'webp'].includes(ext))
    throw new Error("Faqat JPG, PNG yoki WebP formatdagi rasmlar qabul qilinadi")

  const fileName = `${userId}/${Date.now()}.${ext}`
  const { error: uploadError } = await supabase.storage.from('avatars').upload(fileName, file, { upsert: true })

  if (uploadError) {
    const msg = (uploadError.message || '').toLowerCase()
    if (msg.includes('bucket') || msg.includes('not found'))
      throw new Error("'avatars' storage bucket topilmadi. Supabase Dashboard → Storage → New Bucket: \"avatars\" (Public: ✓)")
    if (msg.includes('policy') || msg.includes('permission') || msg.includes('unauthorized') || msg.includes('403'))
      throw new Error("Storage ruxsati yo'q. Supabase Dashboard → Storage → avatars → Policies da INSERT ruxsatini bering.")
    throw new Error("Yuklashda xatolik: " + uploadError.message)
  }

  const { data } = supabase.storage.from('avatars').getPublicUrl(fileName)
  return data.publicUrl
}

import React, { useState, useRef, useEffect } from "react";
import { useLang } from "../../store/LangContext";
import { useUser } from "../../store/UserContext";
import {
  Save, Loader2, Camera, ArrowLeft, User as UserIcon, Send,
  Instagram, Lock, Unlock, Check, Trash2, Image as ImageIcon
} from "lucide-react";
import { updateUserProfile, uploadAvatar, getOwnedItemIds } from "../../services/db";
import { FREE_AVATAR_COLORS, PREMIUM_AVATAR_COLORS } from "../../utils/cosmetics";
import type { Profile } from "../../services/supabase";
import { AvatarCropperModal } from "../../components/AvatarCropperModal";
import { toast } from "sonner";

interface EditProfilePageProps {
  isDark: boolean;
  profile: Profile;
  onProfileUpdate: (newProfile: Profile) => void;
  onBack: () => void;
}

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <label className="text-xs font-semibold mb-1.5 block text-slate-300 dark:text-slate-300">
      {label}
    </label>
    {children}
  </div>
);

export function EditProfilePage({ isDark, profile, onProfileUpdate, onBack }: EditProfilePageProps) {
  const { t } = useLang();
  const { refreshUserProfile, setProfile } = useUser();

  const [displayName, setDisplayName] = useState(profile.display_name || profile.full_name || "");
  const [bio, setBio] = useState(profile.bio || "");
  const [telegram, setTelegram] = useState(profile.telegram_username || "");
  const [instagram, setInstagram] = useState(profile.instagram_username || "");
  const [tgPrivate, setTgPrivate] = useState(profile.telegram_private ?? false);
  const [profilePrivate, setProfilePrivate] = useState(profile.profile_private ?? false);

  // Avatar Crop State
  const [rawSelectedImageSrc, setRawSelectedImageSrc] = useState<string | null>(null);
  const [showCropperModal, setShowCropperModal] = useState<boolean>(false);

  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(profile.avatar_url || null);
  const [avatarRemoved, setAvatarRemoved] = useState(false);
  const [avatarColor, setAvatarColor] = useState(profile.avatar_color || FREE_AVATAR_COLORS[0]);
  const [ownedColorIds, setOwnedColorIds] = useState<Set<string>>(new Set());

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getOwnedItemIds(profile.id).then(setOwnedColorIds).catch(() => {});
  }, [profile.id]);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 10 * 1024 * 1024) {
        toast.error("Rasm hajmi 10MB dan oshmasligi kerak");
        return;
      }
      const rawUrl = URL.createObjectURL(file);
      setRawSelectedImageSrc(rawUrl);
      setShowCropperModal(true);
      setError("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleCropComplete = (croppedFile: File, croppedUrl: string) => {
    setAvatarFile(croppedFile);
    setAvatarPreview(croppedUrl);
    setAvatarRemoved(false);
    toast.success("Rasm muvaffaqiyatli qirqildi");
  };

  const handleRemoveAvatarDirect = () => {
    setAvatarFile(null);
    setAvatarPreview(null);
    setAvatarRemoved(true);
    if (fileInputRef.current) fileInputRef.current.value = "";
    toast.info("Rasm olib tashlandi. O'zgarishlarni saqlash uchun 'Saqlash' tugmasini bosing.");
  };

  function cleanHandle(val: string) {
    return val.replace(/^@/, "").replace(/[^a-zA-Z0-9_.]/g, "");
  }

  // Form dirtiness / state change detection
  const isDirty =
    avatarFile !== null ||
    avatarRemoved ||
    displayName.trim() !== (profile.display_name || profile.full_name || "") ||
    bio.trim() !== (profile.bio || "") ||
    telegram.trim() !== (profile.telegram_username || "") ||
    instagram.trim() !== (profile.instagram_username || "") ||
    tgPrivate !== (profile.telegram_private ?? false) ||
    profilePrivate !== (profile.profile_private ?? false) ||
    avatarColor !== (profile.avatar_color || FREE_AVATAR_COLORS[0]);

  const handleSave = async () => {
    if (!displayName.trim()) {
      setError(t('ep_name_required') || "Ism bo'sh bo'lishi mumkin emas.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      let avatar_url = profile.avatar_url;

      // 1. Upload cropped file if selected
      if (avatarFile) {
        avatar_url = await uploadAvatar(profile.id, avatarFile);
      } else if (avatarRemoved) {
        avatar_url = null;
      }

      // 2. Update Supabase profiles table
      const updatedProfile = await updateUserProfile(profile.id, {
        display_name: displayName.trim(),
        full_name: displayName.trim(),
        avatar_url,
        avatar_color: avatarColor,
        bio: bio.trim() || null,
        telegram_username: telegram.trim() || null,
        instagram_username: instagram.trim() || null,
        telegram_private: tgPrivate,
        profile_private: profilePrivate,
      });

      // 3. Refresh global user context & local storage
      await refreshUserProfile();
      setProfile(updatedProfile);
      onProfileUpdate(updatedProfile);

      toast.success(t('ep_success') || "Profil muvaffaqiyatli saqlandi ✨");
      onBack();
    } catch (e: any) {
      console.error("Save profile error:", e);
      setError(e.message || t('ep_error') || "Saqlashda xatolik yuz berdi.");
      toast.error(e.message || "Saqlashda xatolik yuz berdi.");
    } finally {
      setLoading(false);
    }
  };

  const initials = (displayName || profile.display_name || "A")
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const bioCharCount = bio.length;
  const bioColorClass = bioCharCount >= 160 ? "text-rose-400 font-bold" : bioCharCount >= 140 ? "text-amber-400" : "text-slate-400";

  return (
    <div className="max-w-2xl mx-auto pb-32 sm:pb-24">
      {/* Header Bar */}
      <div className="flex items-center gap-3 mb-6">
        <button
          type="button"
          onClick={onBack}
          className="w-10 h-10 rounded-2xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-all active:scale-95"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h2 className="text-base font-bold text-white">{t('ep_title') || "Profilni Tahrirlash"}</h2>
          <p className="text-xs text-slate-400">{t('ep_sub') || "Rasm, ism, bio va ijtimoiy tarmoqlar"}</p>
        </div>
      </div>

      <div className="p-6 rounded-3xl bg-slate-950/80 border border-slate-800 shadow-2xl">
        {/* Avatar Section with Camera Badge & Clean Action Bar */}
        <div className="flex flex-col items-center gap-4 mb-6">
          <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
            <div className="relative">
              {avatarPreview ? (
                <img
                  src={avatarPreview}
                  alt="Avatar"
                  className="w-28 h-28 rounded-3xl object-cover border-4 border-emerald-500/40 shadow-xl"
                />
              ) : (
                <div
                  className="w-28 h-28 rounded-3xl flex items-center justify-center text-3xl font-black shadow-xl border-4 border-emerald-500/40"
                  style={{ background: avatarColor, color: "#0E1117" }}
                >
                  {initials}
                </div>
              )}

              {/* Interactive Camera Overlay Badge */}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                className="absolute -bottom-2 -right-2 p-2.5 rounded-2xl bg-emerald-500 text-slate-950 border-2 border-slate-900 shadow-lg hover:scale-110 active:scale-95 transition-all"
                title="Rasmni tanlash va qirqish"
              >
                <Camera size={16} strokeWidth={2.5} />
              </button>
            </div>
          </div>

          {/* Integrated Action Buttons (Yangi rasm / O'chirish) */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 border border-slate-700 transition-all active:scale-95"
            >
              <ImageIcon size={14} className="text-emerald-400" />
              <span>Yangi rasm</span>
            </button>

            {avatarPreview && (
              <button
                type="button"
                onClick={handleRemoveAvatarDirect}
                className="px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-bold flex items-center gap-1.5 border border-rose-500/20 transition-all active:scale-95"
              >
                <Trash2 size={14} />
                <span>O'chirish</span>
              </button>
            )}
          </div>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleAvatarChange}
            accept="image/png, image/jpeg, image/webp"
            className="hidden"
          />

          {/* Custom Avatar Colors Selection */}
          {!avatarPreview && (
            <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
              {FREE_AVATAR_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setAvatarColor(c)}
                  className="w-8 h-8 rounded-full flex items-center justify-center transition-all hover:scale-110"
                  style={{
                    background: c,
                    border: avatarColor === c ? "2px solid #FFFFFF" : "2px solid transparent",
                  }}
                >
                  {avatarColor === c && <Check size={13} color="#0E1117" strokeWidth={3} />}
                </button>
              ))}
              {PREMIUM_AVATAR_COLORS.map((c) => {
                const owned = ownedColorIds.has(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    disabled={!owned}
                    onClick={() => setAvatarColor(c.gradient)}
                    title={owned ? c.name : `${c.name} — 🪙${c.price}`}
                    className="w-8 h-8 rounded-full flex items-center justify-center transition-all relative"
                    style={{
                      background: c.gradient,
                      border: avatarColor === c.gradient ? "2px solid #FFFFFF" : "2px solid transparent",
                      opacity: owned ? 1 : 0.35,
                    }}
                  >
                    {avatarColor === c.gradient ? (
                      <Check size={13} color="#fff" strokeWidth={3} />
                    ) : (
                      !owned && <Lock size={10} color="#fff" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Form Fields */}
        <div className="space-y-4">
          {/* Full Name */}
          <Field label={t('ep_fullname') || "To'liq ism"}>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={t('ep_fullname_ph') || "Ismingizni kiriting"}
              className="w-full p-3.5 rounded-2xl bg-slate-900/60 dark:bg-slate-900/60 bg-slate-100 border border-slate-700/80 text-foreground text-xs leading-relaxed outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
            />
          </Field>

          {/* Username (Readonly) */}
          <Field label="Username">
            <div className="flex items-center gap-2 p-3.5 rounded-2xl bg-slate-900/30 border border-slate-800/80 text-slate-400 text-xs font-mono opacity-70 cursor-not-allowed">
              <UserIcon size={14} className="text-slate-500 shrink-0" />
              <span>@{profile.username}</span>
            </div>
          </Field>

          {/* Bio Field with Character Counter */}
          <Field label={t('ep_bio') || "Bio"}>
            <div className="relative">
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder={t('ep_bio_ph') || "O'zingiz haqida qisqacha..."}
                maxLength={160}
                rows={3}
                className="w-full p-3.5 rounded-2xl bg-slate-900/60 dark:bg-slate-900/60 bg-slate-100 border border-slate-700/80 text-foreground text-xs leading-relaxed outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all resize-none min-h-[90px]"
              />
              <p className={`text-[10px] mt-1 text-right font-mono ${bioColorClass}`}>
                {bioCharCount}/160
              </p>
            </div>
          </Field>

          {/* Profile Privacy Toggle */}
          <Field label={t('ep_privacy_label') || "Profil maxfiyligi"}>
            <button
              type="button"
              onClick={() => setProfilePrivate(!profilePrivate)}
              className={`w-full flex items-center justify-between gap-2 px-4 py-3 rounded-2xl text-xs font-bold transition-all border ${
                profilePrivate
                  ? "bg-rose-500/10 border-rose-500/30 text-rose-400"
                  : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
              }`}
            >
              <span className="flex items-center gap-2">
                {profilePrivate ? <Lock size={14} /> : <Unlock size={14} />}
                {profilePrivate ? (t('ep_privacy_private') || "Yuqori maxfiylik") : (t('ep_privacy_public') || "Ochiq profil")}
              </span>
            </button>
            <p className="text-[11px] mt-1.5 leading-relaxed text-slate-400">
              {profilePrivate
                ? (t('ep_privacy_private_hint') || "🔒 Global reytingda ismingiz qisqartirilgan holda ko'rinadi")
                : (t('ep_privacy_public_hint') || "🌐 Begonalar ham profilingizni ko'ra oladi")}
            </p>
          </Field>

          {/* Divider */}
          <div className="pt-3 pb-1 border-t border-slate-800">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t('ep_social') || "Ijtimoiy tarmoqlar"}</p>
          </div>

          {/* Telegram Handle */}
          <Field label="Telegram username">
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-sky-400 pointer-events-none">
                @
              </span>
              <input
                type="text"
                value={telegram}
                onChange={(e) => setTelegram(cleanHandle(e.target.value))}
                placeholder="username"
                maxLength={32}
                className="w-full pl-8 pr-4 py-3.5 rounded-2xl bg-slate-900/60 border border-slate-700/80 text-foreground text-xs outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all font-mono"
              />
            </div>
            {telegram && (
              <div className="mt-2 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setTgPrivate(!tgPrivate)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                    tgPrivate
                      ? "bg-rose-500/10 border-rose-500/30 text-rose-400"
                      : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                  }`}
                >
                  {tgPrivate ? <Lock size={12} /> : <Unlock size={12} />}
                  {tgPrivate ? (t('ep_tg_private') || "Maxfiy — so'rov orqali") : (t('ep_tg_public') || "Ochiq — to'g'ridan to'g'ri")}
                </button>
                <a
                  href={`https://t.me/${telegram}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-bold text-sky-400 flex items-center gap-1 hover:underline"
                >
                  <Send size={12} /> {t('ep_tg_view') || "Ko'rish"}
                </a>
              </div>
            )}
          </Field>

          {/* Instagram Handle */}
          <Field label="Instagram username">
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-rose-400 pointer-events-none">
                @
              </span>
              <input
                type="text"
                value={instagram}
                onChange={(e) => setInstagram(cleanHandle(e.target.value))}
                placeholder="username"
                maxLength={30}
                className="w-full pl-8 pr-4 py-3.5 rounded-2xl bg-slate-900/60 border border-slate-700/80 text-foreground text-xs outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all font-mono"
              />
            </div>
            {instagram && (
              <div className="mt-2 flex justify-end">
                <a
                  href={`https://instagram.com/${instagram}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-bold text-rose-400 flex items-center gap-1 hover:underline"
                >
                  <Instagram size={12} /> {t('ep_tg_view') || "Ko'rish"}
                </a>
              </div>
            )}
          </Field>
        </div>

        {error && (
          <p className="text-xs mt-4 text-center font-bold text-rose-400 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20">
            {error}
          </p>
        )}
      </div>

      {/* Sticky Floating Action Bar at the Bottom */}
      <div className="sticky bottom-20 md:bottom-6 z-30 my-4 p-3 rounded-2xl bg-slate-900/90 dark:bg-slate-900/90 bg-white/90 backdrop-blur-md border border-slate-700/80 shadow-2xl flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          disabled={loading}
          className="px-5 py-3 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all active:scale-95 disabled:opacity-50"
        >
          {t('cancel') || "Bekor qilish"}
        </button>

        <button
          type="button"
          onClick={handleSave}
          disabled={!isDirty || loading || !displayName.trim()}
          className="flex-1 py-3 px-4 rounded-xl text-xs font-black bg-emerald-500 hover:bg-emerald-400 text-slate-950 flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              <span>Saqlanmoqda...</span>
            </>
          ) : (
            <>
              <Save size={16} />
              <span>{t('save') || "Saqlash"}</span>
            </>
          )}
        </button>
      </div>

      {/* Avatar Cropper Modal */}
      <AvatarCropperModal
        imageSrc={rawSelectedImageSrc}
        isOpen={showCropperModal}
        onClose={() => setShowCropperModal(false)}
        onCropComplete={handleCropComplete}
      />
    </div>
  );
}

export default EditProfilePage;

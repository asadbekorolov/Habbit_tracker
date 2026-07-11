import { useState, useRef } from "react";
import { useLang } from "../../store/LangContext";
import { Save, Loader2, Camera, ArrowLeft, User, Send, Instagram, Lock, Unlock } from "lucide-react";
import { updateUserProfile, uploadAvatar } from "../../services/db";
import type { Profile } from "../../services/supabase";

interface EditProfilePageProps {
  isDark: boolean;
  profile: Profile;
  onProfileUpdate: (newProfile: Profile) => void;
  onBack: () => void;
}

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <label className="text-xs font-medium mb-1.5 block" style={{ color: "var(--muted-foreground)" }}>
      {label}
    </label>
    {children}
  </div>
);

export function EditProfilePage({ isDark, profile, onProfileUpdate, onBack }: EditProfilePageProps) {
  const { t } = useLang();
  const [displayName, setDisplayName] = useState(profile.display_name);
  const [bio, setBio] = useState(profile.bio || "");
  const [telegram, setTelegram] = useState(profile.telegram_username || "");
  const [instagram, setInstagram] = useState(profile.instagram_username || "");
  const [tgPrivate, setTgPrivate] = useState(profile.telegram_private ?? false);
  const [profilePrivate, setProfilePrivate] = useState(profile.profile_private ?? false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(profile.avatar_url || null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  const cardStyle: React.CSSProperties = {
    background: isDark ? "rgba(22,27,34,0.85)" : "var(--card)",
    border: `1px solid ${isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.07)"}`,
    borderRadius: 14,
  };

  const inputStyle: React.CSSProperties = {
    background: isDark ? "rgba(255,255,255,0.05)" : "#F9FAFB",
    border: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}`,
    color: "var(--foreground)",
    borderRadius: 8,
    padding: "9px 12px",
    fontSize: 13,
    outline: "none",
    width: "100%",
  };

  const prefixInputStyle: React.CSSProperties = {
    ...inputStyle,
    paddingLeft: 32,
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
    }
  };

  function cleanHandle(val: string) {
    return val.replace(/^@/, "").replace(/[^a-zA-Z0-9_.]/g, "");
  }

  const handleSave = async () => {
    if (!displayName.trim()) { setError(t('ep_name_required')); return; }
    setLoading(true); setError(""); setSuccess("");
    try {
      let avatar_url = profile.avatar_url;
      if (avatarFile) avatar_url = await uploadAvatar(profile.id, avatarFile);

      const updatedProfile = await updateUserProfile(profile.id, {
        display_name: displayName.trim(),
        avatar_url,
        bio: bio.trim() || null,
        telegram_username: telegram.trim() || null,
        instagram_username: instagram.trim() || null,
        telegram_private: tgPrivate,
        profile_private: profilePrivate,
      });

      onProfileUpdate(updatedProfile);
      setSuccess(t('ep_success'));
      setAvatarFile(null);
    } catch (e: any) {
      setError(e.message || t('ep_error'));
    } finally {
      setLoading(false);
    }
  };

  const initials = (displayName || profile.display_name)
    .split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onBack}
          className="w-9 h-9 rounded-xl flex items-center justify-center transition-all"
          style={{ background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)", color: "var(--muted-foreground)" }}>
          <ArrowLeft size={16} />
        </button>
        <div>
          <h2 className="text-base font-semibold" style={{ color: "var(--foreground)" }}>{t('ep_title')}</h2>
          <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>{t('ep_sub')}</p>
        </div>
      </div>

      <div style={cardStyle} className="p-6">
        {/* Avatar */}
        <div className="flex flex-col items-center gap-3 mb-6">
          <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
            {avatarPreview ? (
              <img src={avatarPreview} alt="Avatar" className="w-28 h-28 rounded-2xl object-cover"
                style={{ border: "3px solid rgba(74,222,128,0.3)" }} />
            ) : (
              <div className="w-28 h-28 rounded-2xl flex items-center justify-center text-3xl font-bold"
                style={{ background: profile.avatar_color || "#4ADE80", color: "#0E1117", border: "3px solid rgba(74,222,128,0.3)" }}>
                {initials}
              </div>
            )}
            <div className="absolute inset-0 rounded-2xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ background: "rgba(0,0,0,0.45)" }}>
              <Camera size={22} color="#fff" />
            </div>
          </div>
          <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
            {t('ep_avatar_hint')}
          </p>
          <input type="file" ref={fileInputRef} onChange={handleAvatarChange}
            accept="image/png, image/jpeg, image/webp" className="hidden" />
        </div>

        <div className="space-y-4">
          {/* Name */}
          <Field label={t('ep_fullname')}>
            <input style={inputStyle} value={displayName}
              onChange={(e) => setDisplayName(e.target.value)} placeholder={t('ep_fullname_ph')} />
          </Field>

          {/* Username (readonly) */}
          <Field label="Username">
            <div className="flex items-center gap-2"
              style={{ ...inputStyle, padding: "9px 12px", opacity: 0.6, cursor: "not-allowed" }}>
              <User size={13} style={{ color: "var(--muted-foreground)", flexShrink: 0 }} />
              <span>@{profile.username}</span>
            </div>
          </Field>

          {/* Bio */}
          <Field label={t('ep_bio')}>
            <textarea style={{ ...inputStyle, resize: "none", minHeight: 80, lineHeight: 1.5 }}
              value={bio} onChange={(e) => setBio(e.target.value)}
              placeholder={t('ep_bio_ph')} maxLength={160} rows={3} />
            <p className="text-[11px] mt-1 text-right" style={{ color: "var(--muted-foreground)" }}>
              {bio.length}/160
            </p>
          </Field>

          {/* Profil maxfiyligi */}
          <Field label={t('ep_privacy_label')}>
            <button type="button" onClick={() => setProfilePrivate(!profilePrivate)}
              className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-xs font-medium transition-all min-h-[44px]"
              style={{
                background: profilePrivate
                  ? (isDark ? "rgba(248,113,113,0.1)" : "rgba(248,113,113,0.08)")
                  : (isDark ? "rgba(74,222,128,0.1)" : "rgba(74,222,128,0.08)"),
                color: profilePrivate ? "#F87171" : "#4ADE80",
                border: `1px solid ${profilePrivate ? "rgba(248,113,113,0.25)" : "rgba(74,222,128,0.25)"}`,
              }}>
              <span className="flex items-center gap-2">
                {profilePrivate ? <Lock size={13} /> : <Unlock size={13} />}
                {profilePrivate ? t('ep_privacy_private') : t('ep_privacy_public')}
              </span>
            </button>
            <p className="text-[11px] mt-1.5 leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
              {profilePrivate ? t('ep_privacy_private_hint') : t('ep_privacy_public_hint')}
            </p>
          </Field>

          {/* Divider */}
          <div className="pt-2 pb-1 border-t" style={{ borderColor: isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)" }}>
            <p className="text-xs font-semibold" style={{ color: "var(--muted-foreground)" }}>{t('ep_social')}</p>
          </div>

          {/* Telegram */}
          <Field label="Telegram username">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium pointer-events-none"
                style={{ color: "#60A5FA" }}>@</span>
              <input style={prefixInputStyle} value={telegram}
                onChange={(e) => setTelegram(cleanHandle(e.target.value))}
                placeholder="username" maxLength={32} />
            </div>
            {telegram && (
              <div className="mt-2 flex items-center justify-between">
                {/* Privacy toggle */}
                <button type="button" onClick={() => setTgPrivate(!tgPrivate)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
                  style={{
                    background: tgPrivate
                      ? (isDark ? "rgba(248,113,113,0.1)" : "rgba(248,113,113,0.08)")
                      : (isDark ? "rgba(74,222,128,0.1)" : "rgba(74,222,128,0.08)"),
                    color: tgPrivate ? "#F87171" : "#4ADE80",
                    border: `1px solid ${tgPrivate ? "rgba(248,113,113,0.25)" : "rgba(74,222,128,0.25)"}`,
                  }}>
                  {tgPrivate ? <Lock size={12} /> : <Unlock size={12} />}
                  {tgPrivate ? t('ep_tg_private') : t('ep_tg_public')}
                </button>
                <a href={`https://t.me/${telegram}`} target="_blank" rel="noreferrer"
                  className="text-xs flex items-center gap-1"
                  style={{ color: "#60A5FA" }}>
                  <Send size={11} /> {t('ep_tg_view')}
                </a>
              </div>
            )}
            {telegram && (
              <p className="text-[11px] mt-1.5 leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
                {tgPrivate ? t('ep_tg_private_hint') : t('ep_tg_public_hint')}
              </p>
            )}
          </Field>

          {/* Instagram */}
          <Field label="Instagram username">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium pointer-events-none"
                style={{ color: "#E1306C" }}>@</span>
              <input style={prefixInputStyle} value={instagram}
                onChange={(e) => setInstagram(cleanHandle(e.target.value))}
                placeholder="username" maxLength={30} />
            </div>
            {instagram && (
              <div className="mt-2 flex justify-end">
                <a href={`https://instagram.com/${instagram}`} target="_blank" rel="noreferrer"
                  className="text-xs flex items-center gap-1"
                  style={{ color: "#E1306C" }}>
                  <Instagram size={11} /> {t('ep_tg_view')}
                </a>
              </div>
            )}
          </Field>
        </div>

        {error && <p className="text-xs mt-4 text-center" style={{ color: "var(--coral-red)" }}>{error}</p>}
        {success && <p className="text-xs mt-4 text-center" style={{ color: "var(--neon-green)" }}>{success}</p>}

        <div className="mt-6 flex gap-2">
          <button onClick={onBack}
            className="px-4 py-2.5 rounded-xl text-sm font-medium"
            style={{
              background: isDark ? "rgba(255,255,255,0.05)" : "#F3F4F6",
              color: "var(--muted-foreground)",
              border: `1px solid ${isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.07)"}`,
            }}>
            {t('cancel')}
          </button>
          <button onClick={handleSave} disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold"
            style={{
              background: loading ? "rgba(74,222,128,0.4)" : "var(--neon-green)",
              color: "#0E1117",
              cursor: loading ? "not-allowed" : "pointer",
            }}>
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {t('save')}
          </button>
        </div>
      </div>
    </div>
  );
}

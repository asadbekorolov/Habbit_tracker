import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Zap, Eye, EyeOff, ArrowRight, Loader2, ArrowLeft,
  Mail, User as UserIcon, Lock, CheckCircle2, AtSign, ShieldCheck, Sparkles, AlertCircle
} from "lucide-react";
import {
  signInUser, resetUserPassword, resendConfirmationEmail,
  sendEmailOtp, verifyEmailOtpAndCreateAccount,
  createProfileForGoogleUser,
} from "../../services/db";
import { signInWithGoogle } from "../../services/authService";
import { supabase } from "../../services/supabase";
import type { Profile } from "../../services/supabase";
import { useLang } from "../../store/LangContext";
import { openPublicPage, PRIVACY_PATH } from "../../utils/openPublicPage";
import { trackEvent } from "../../utils/analytics";
import { soundService } from "../../services/soundService";
import { toast } from "sonner";

const InputField = ({
  label,
  type = "text",
  value,
  onChange,
  placeholder,
  icon: Icon,
  isPassword = false,
  showPassword = false,
  onTogglePassword = () => {},
  autoFocus = false,
  hint,
}: any) => (
  <div className="relative mb-3.5 w-full">
    <div className="flex items-center justify-between mb-1.5 px-0.5">
      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
        {label}
      </label>
      {hint && <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">{hint}</span>}
    </div>
    <div className="relative flex items-center group">
      {Icon && (
        <div className="absolute left-3.5 text-slate-400 dark:text-slate-500 group-focus-within:text-emerald-500 transition-colors pointer-events-none z-10">
          <Icon size={18} />
        </div>
      )}
      <input
        type={isPassword ? (showPassword ? "text" : "password") : type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className={`w-full py-3.5 ${Icon ? "pl-11" : "pl-4"} ${isPassword ? "pr-11" : "pr-4"} text-sm font-medium rounded-2xl bg-slate-100/80 dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/10 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none focus:border-emerald-500/60 focus:ring-4 focus:ring-emerald-500/10 transition-all shadow-sm`}
      />
      {isPassword && (
        <button
          type="button"
          onClick={onTogglePassword}
          className="absolute right-3.5 p-1 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-white transition-colors rounded-lg"
        >
          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      )}
    </div>
  </div>
);

interface LoginPageProps {
  onLogin: (profile: Profile) => void;
}

type Tab = "login" | "register" | "forgot" | "verify-email" | "complete-google";

export function LoginPage({ onLogin }: LoginPageProps) {
  const { t, lang } = useLang();
  const [tab, setTab] = useState<Tab>("login");

  // Login
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showLoginPass, setShowLoginPass] = useState(false);
  const [emailNotConfirmed, setEmailNotConfirmed] = useState(false);
  const [resendSent, setResendSent] = useState(false);

  // Register
  const [regName, setRegName] = useState("");
  const [regUsername, setRegUsername] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirm, setRegConfirm] = useState("");
  const [showRegPass, setShowRegPass] = useState(false);
  const [showRegConfirm, setShowRegConfirm] = useState(false);

  // Email OTP verification
  const [pendingReg, setPendingReg] = useState<{
    name: string; username: string; email: string; password: string;
  } | null>(null);
  const [regOtp, setRegOtp] = useState("");
  const [otpCountdown, setOtpCountdown] = useState(0);

  // Google Registration Complete State
  const [googleUser, setGoogleUser] = useState<any>(null);
  const [googleRegName, setGoogleRegName] = useState("");
  const [googleRegUsername, setGoogleRegUsername] = useState("");

  // Forgot
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSent, setForgotSent] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (otpCountdown <= 0) return;
    const t = setTimeout(() => setOtpCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [otpCountdown]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        const isCompleted = session.user.user_metadata?.registration_completed === true;
        if (!isCompleted) {
          const user = session.user;
          setGoogleUser(user);
          const meta = user.user_metadata || {};
          const email = user.email || "";
          const rawName = meta.full_name || meta.name || email.split("@")[0] || "";
          const cleanUsername = (email.split("@")[0] || "user")
            .toLowerCase()
            .replace(/[^a-z0-9_]/g, "");

          setGoogleRegName(rawName);
          setGoogleRegUsername(cleanUsername);
          setTab("complete-google");
        }
      }
    });
  }, []);

  function parseError(msg: string): string {
    if (msg.includes("Invalid login credentials") || msg.includes("invalid_grant"))
      return t('auth_err_invalid_credentials');
    if (msg.includes("Email not confirmed"))
      return t('auth_err_email_not_confirmed');
    if (msg.includes("already registered") || msg.includes("already been registered") || msg.includes("User already registered"))
      return t('auth_err_already_registered');
    if (msg.includes("Password should be at least"))
      return t('auth_err_password_too_short');
    if (msg.includes("Unable to validate email"))
      return t('auth_err_invalid_email_format');
    if (msg.includes("profiles_username_key"))
      return t('auth_err_username_taken');
    if (msg.includes("Token has expired") || msg.includes("otp_expired"))
      return t('auth_err_otp_expired');
    if (msg.includes("invalid") && msg.toLowerCase().includes("otp"))
      return t('auth_err_otp_invalid');
    if (msg.toLowerCase().includes("error sending") && msg.toLowerCase().includes("email"))
      return t('auth_err_email_send_failed');
    if (msg.includes("bloklangan"))
      return msg;
    return msg || t('auth_err_generic');
  }

  function switchTab(newTab: Tab) {
    soundService.play('tab_click');
    setTab(newTab);
    setError("");
    setEmailNotConfirmed(false);
    setResendSent(false);
  }

  async function handleLogin() {
    setError("");
    setEmailNotConfirmed(false);
    if (!loginEmail.trim()) return setError(t('auth_err_email_required'));
    if (!loginPassword) return setError(t('auth_err_password_required'));
    setLoading(true);
    soundService.play('button_tap');
    try {
      const profile = await signInUser(loginEmail.trim(), loginPassword);
      trackEvent('login_success', {}, profile.id);
      onLogin(profile);
    } catch (e: any) {
      const msg = e.message || "";
      if (msg.includes("Email not confirmed")) setEmailNotConfirmed(true);
      setError(parseError(msg));
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (!loginEmail.trim()) return setError(t('auth_err_email_required'));
    setLoading(true);
    setError("");
    try {
      await resendConfirmationEmail(loginEmail.trim());
      setResendSent(true);
    } catch (e: any) {
      setError(parseError(e.message || ""));
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister() {
    setError("");
    if (!regName.trim()) return setError(t('auth_err_fullname_required'));
    if (!regUsername.trim()) return setError(t('auth_err_username_required'));
    if (!/^[a-z0-9_]{3,20}$/.test(regUsername))
      return setError(t('auth_err_username_format'));
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(regEmail))
      return setError(t('auth_err_email_invalid'));
    if (regPassword.length < 6) return setError(t('auth_err_password_min'));
    if (regPassword !== regConfirm) return setError(t('auth_err_password_mismatch'));

    setLoading(true);
    try {
      await sendEmailOtp(regEmail.trim());
      trackEvent('signup_started');
      setPendingReg({ name: regName, username: regUsername, email: regEmail.trim(), password: regPassword });
      setRegOtp("");
      setOtpCountdown(60);
      setError("");
      setTab("verify-email");
    } catch (e: any) {
      setError(parseError(e.message || ""));
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyEmail() {
    if (!pendingReg) return;
    const cleanOtp = regOtp.replace(/\D/g, "");
    if (cleanOtp.length < 6) return setError(t('auth_err_otp_incomplete'));
    setError("");
    setLoading(true);
    try {
      const profile = await verifyEmailOtpAndCreateAccount(
        pendingReg.email, cleanOtp,
        pendingReg.password, pendingReg.name, pendingReg.username
      );
      trackEvent('signup_completed', {}, profile.id);
      onLogin(profile);
    } catch (e: any) {
      setError(parseError(e.message || ""));
    } finally {
      setLoading(false);
    }
  }

  async function handleResendOtp() {
    if (!pendingReg || otpCountdown > 0) return;
    setLoading(true);
    try {
      await sendEmailOtp(pendingReg.email);
      setOtpCountdown(60);
      setRegOtp("");
      setError("");
    } catch (e: any) {
      setError(parseError(e.message || ""));
    } finally {
      setLoading(false);
    }
  }

  async function handleForgot() {
    setError("");
    if (!forgotEmail.trim()) return setError(t('auth_err_email_for_reset'));
    setLoading(true);
    try {
      await resetUserPassword(forgotEmail.trim());
      setForgotSent(true);
    } catch (e: any) {
      setError(parseError(e.message || ""));
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleLogin() {
    try {
      setLoading(true);
      setError("");

      const res = await signInWithGoogle();

      if (res?.profile) {
        // Registered user -> log in immediately
        trackEvent("login_success", { method: "google" }, res.profile.id);
        onLogin(res.profile);
      } else if (res?.isNewUser && res?.data?.user) {
        // Unregistered email -> DO NOT create account automatically!
        // Transition to Registration completion form (Name & Username)
        const user = res.data.user;
        setGoogleUser(user);

        const meta = user.user_metadata || {};
        const email = user.email || "";
        const rawName = meta.full_name || meta.name || email.split("@")[0] || "";
        const cleanUsername = (email.split("@")[0] || "user")
          .toLowerCase()
          .replace(/[^a-z0-9_]/g, "");

        setGoogleRegName(rawName);
        setGoogleRegUsername(cleanUsername);

        soundService.play("tab_click");
        setTab("complete-google");
      }
    } catch (err: any) {
      const msg = err?.message || "";
      if (msg === "USER_CANCELLED") {
        return;
      }
      console.error("Google Auth error:", msg);
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleCompleteGoogleRegistration() {
    if (!googleUser) return;
    setError("");
    if (!googleRegName.trim()) return setError(t('auth_err_fullname_required'));
    if (!googleRegUsername.trim()) return setError(t('auth_err_username_required'));
    if (!/^[a-z0-9_]{3,20}$/.test(googleRegUsername))
      return setError(t('auth_err_username_format'));

    setLoading(true);
    soundService.play('button_tap');
    try {
      const newProfile = await createProfileForGoogleUser(
        googleUser,
        googleRegName.trim(),
        googleRegUsername.trim()
      );
      trackEvent('signup_completed', { method: "google" }, newProfile.id);
      onLogin(newProfile);
    } catch (e: any) {
      setError(parseError(e.message || ""));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen w-full bg-slate-950 text-white flex flex-col justify-center items-center px-4 py-8 relative overflow-hidden font-sans">
      {/* Ambient Radial Gradient Background Elements */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-emerald-500/15 rounded-full blur-[128px] pointer-events-none" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-teal-500/15 rounded-full blur-[128px] pointer-events-none" />

      {/* Top Branding Section */}
      <div className="flex flex-col items-center text-center w-full max-w-sm mb-6 z-10">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-400/20 to-teal-600/10 border border-emerald-500/30 flex items-center justify-center shadow-xl shadow-emerald-500/10 mb-4 relative overflow-hidden group"
        >
          <div className="absolute inset-0 bg-emerald-500/10 blur-md group-hover:opacity-100 transition-opacity" />
          <Zap size={32} className="text-emerald-400 relative z-10 fill-emerald-400/20" />
        </motion.div>

        <motion.h1
          key={tab + "-title"}
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-2xl font-extrabold tracking-tight text-white"
        >
          {tab === "forgot" ? t('login_title_reset') :
           tab === "verify-email" ? t('login_title_verify') :
           tab === "complete-google" ? t('login_title_setup') : "IDROK"}
        </motion.h1>
        <motion.p
          key={tab + "-sub"}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-xs text-slate-400 mt-1.5 max-w-xs mx-auto font-medium leading-relaxed"
        >
          {tab === "forgot" ? t('auth_reset_hint') :
           tab === "verify-email" ? t('login_otp_sent').replace('{email}', pendingReg?.email ?? '') :
           tab === "complete-google" ? t('login_complete_google_hint') :
           t('login_tagline')}
        </motion.p>
      </div>

      {/* Main Glass Card */}
      <div className="w-full max-w-sm rounded-3xl bg-slate-900/80 backdrop-blur-2xl border border-white/10 p-6 shadow-2xl relative z-10 overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full -mr-16 -mt-16 blur-2xl pointer-events-none" />

        {/* Top Segmented Tab Switcher for Login / Register */}
        {(tab === "login" || tab === "register") && (
          <div className="flex items-center p-1 rounded-2xl bg-white/[0.05] border border-white/10 mb-6 relative">
            <button
              type="button"
              onClick={() => switchTab("login")}
              className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all relative z-10 ${
                tab === "login"
                  ? "text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {tab === "login" && (
                <motion.div
                  layoutId="active-pill"
                  className="absolute inset-0 bg-emerald-500/20 border border-emerald-500/30 rounded-xl -z-10 shadow-sm"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              <span>{t('auth_tab_login')}</span>
            </button>
            <button
              type="button"
              onClick={() => switchTab("register")}
              className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all relative z-10 ${
                tab === "register"
                  ? "text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {tab === "register" && (
                <motion.div
                  layoutId="active-pill"
                  className="absolute inset-0 bg-emerald-500/20 border border-emerald-500/30 rounded-xl -z-10 shadow-sm"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              <span>{t('auth_tab_register')}</span>
            </button>
          </div>
        )}

        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="relative z-10"
          >

            {/* Google Fast Auth Option */}
            {(tab === "login" || tab === "register") && (
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={loading}
                  className="w-full py-3.5 px-4 rounded-2xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 hover:border-emerald-500/40 text-white font-bold text-sm flex items-center justify-center gap-3 shadow-md active:scale-[0.98] transition-all disabled:opacity-50 group"
                >
                  {loading ? (
                    <Loader2 className="animate-spin text-emerald-400" size={18} />
                  ) : (
                    <svg className="w-4 h-4 shrink-0 transition-transform group-hover:scale-110" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      />
                    </svg>
                  )}
                  <span>
                    {tab === "register"
                      ? t('login_google_register')
                      : t('auth_google_login')}
                  </span>
                </button>

                <div className="flex items-center my-5">
                  <div className="flex-1 h-[1px] bg-white/10" />
                  <span className="text-[10px] uppercase text-slate-500 font-extrabold tracking-[0.2em] px-3">
                    {t('login_or_email')}
                  </span>
                  <div className="flex-1 h-[1px] bg-white/10" />
                </div>
              </div>
            )}

            {/* ─── Login Form ─── */}
            {tab === "login" && (
              <div className="flex flex-col">
                <InputField
                  icon={Mail}
                  label={t('login_email_label')}
                  placeholder={t('login_email_ph')}
                  value={loginEmail}
                  onChange={setLoginEmail}
                />
                <InputField
                  icon={Lock}
                  label={t('login_password_label')}
                  placeholder="••••••••"
                  isPassword
                  showPassword={showLoginPass}
                  onTogglePassword={() => setShowLoginPass(!showLoginPass)}
                  value={loginPassword}
                  onChange={setLoginPassword}
                />
                <div className="flex justify-end mt-0.5">
                  <button
                    type="button"
                    onClick={() => switchTab("forgot")}
                    className="text-xs text-emerald-400 font-semibold hover:underline transition-all"
                  >
                    {t('auth_forgot_password')}
                  </button>
                </div>
              </div>
            )}

            {/* ─── Register Form ─── */}
            {tab === "register" && (
              <div className="flex flex-col">
                <InputField
                  icon={UserIcon}
                  label={t('login_full_name_ph')}
                  placeholder={t('login_name_ph')}
                  value={regName}
                  onChange={setRegName}
                />
                <InputField
                  icon={AtSign}
                  label={t('login_username_label')}
                  placeholder="username"
                  value={regUsername}
                  onChange={(v: string) => setRegUsername(v.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                  hint="Faqat lotin va sonlar"
                />
                <InputField
                  icon={Mail}
                  label={t('login_email_label')}
                  placeholder={t('login_email_ph')}
                  value={regEmail}
                  onChange={setRegEmail}
                />
                <InputField
                  icon={Lock}
                  label={t('login_password_label')}
                  placeholder={t('login_password_min_ph')}
                  isPassword
                  showPassword={showRegPass}
                  onTogglePassword={() => setShowRegPass(!showRegPass)}
                  value={regPassword}
                  onChange={setRegPassword}
                />
                <InputField
                  icon={ShieldCheck}
                  label={t('login_confirm_label')}
                  placeholder={t('login_repeat_ph')}
                  isPassword
                  showPassword={showRegConfirm}
                  onTogglePassword={() => setShowRegConfirm(!showRegConfirm)}
                  value={regConfirm}
                  onChange={setRegConfirm}
                />
              </div>
            )}

            {/* ─── Forgot Form ─── */}
            {tab === "forgot" && (
              <div className="flex flex-col">
                <button
                  type="button"
                  onClick={() => switchTab("login")}
                  className="flex items-center gap-2 text-xs text-slate-400 mb-4 hover:text-white transition-colors w-fit"
                >
                  <ArrowLeft size={14} /> {t('login_go_back')}
                </button>
                <InputField
                  icon={Mail}
                  label={t('login_email_label')}
                  placeholder={t('login_email_ph')}
                  value={forgotEmail}
                  onChange={setForgotEmail}
                  autoFocus
                />
                {forgotSent && (
                  <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium text-center mt-2 flex items-center justify-center gap-2">
                    <CheckCircle2 size={16} />
                    <span>{t('auth_reset_sent')}</span>
                  </div>
                )}
              </div>
            )}

            {/* ─── Verify OTP Form ─── */}
            {tab === "verify-email" && (
              <div className="flex flex-col items-center">
                <p className="text-xs text-slate-400 mb-4 text-center">
                  {t('login_enter_code')}
                </p>
                <input
                  type="text" inputMode="numeric" placeholder="••••••" maxLength={6}
                  value={regOtp} onChange={(e) => setRegOtp(e.target.value.replace(/\D/g, ""))}
                  className="w-full bg-white/[0.04] border border-white/10 text-center text-3xl font-extrabold tracking-[0.4em] py-4 rounded-2xl text-white outline-none focus:border-emerald-500/60 focus:ring-4 focus:ring-emerald-500/10 mb-5 shadow-inner"
                />
                <button
                  disabled={otpCountdown > 0 || loading}
                  onClick={handleResendOtp}
                  className="text-xs font-semibold text-slate-400 hover:text-emerald-400 transition-colors disabled:opacity-50"
                >
                  {otpCountdown > 0 ? t('login_resend_code').replace('{s}', String(otpCountdown)) : t('login_resend_plain')}
                </button>
              </div>
            )}

            {/* ─── Complete Google Registration Form ─── */}
            {tab === "complete-google" && (
              <div className="flex flex-col">
                <button
                  type="button"
                  onClick={async () => {
                    await supabase.auth.signOut();
                    setGoogleUser(null);
                    switchTab("login");
                  }}
                  className="flex items-center gap-2 text-xs text-slate-400 mb-4 hover:text-white transition-colors w-fit"
                >
                  <ArrowLeft size={14} /> {t('cancel')}
                </button>

                <div className="mb-4 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-medium leading-relaxed flex items-start gap-2.5">
                  <Sparkles size={18} className="text-amber-400 shrink-0 mt-0.5" />
                  <span>
                    {t('login_google_not_registered')}
                  </span>
                </div>

                <div className="mb-4 p-3 rounded-2xl bg-white/[0.04] border border-white/10 text-xs text-white font-semibold flex items-center justify-between">
                  <span className="text-slate-300 truncate">{googleUser?.email}</span>
                  <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded-full shrink-0 ml-2">
                    Google
                  </span>
                </div>

                <InputField
                  icon={UserIcon}
                  label={t('login_full_name_ph')}
                  placeholder={t('login_name_ph')}
                  value={googleRegName}
                  onChange={setGoogleRegName}
                />
                <InputField
                  icon={AtSign}
                  label={t('login_username_ph')}
                  placeholder="username"
                  value={googleRegUsername}
                  onChange={(v: string) => setGoogleRegUsername(v.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                  hint="Faqat lotin va sonlar"
                />
              </div>
            )}

            {error && (
              <div className="mt-4 p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-medium text-center flex items-center justify-center gap-2">
                <AlertCircle size={16} className="shrink-0 text-rose-400" />
                <div className="flex-1">
                  <span>{error}</span>
                  {emailNotConfirmed && !resendSent && (
                    <button onClick={handleResend} className="block w-full mt-2 text-[10px] font-black uppercase text-rose-200 hover:underline">
                      {t('auth_resend_confirm_btn')}
                    </button>
                  )}
                </div>
              </div>
            )}

            {resendSent && (
              <div className="mt-4 p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-medium text-center flex items-center justify-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                <span>{t('auth_confirm_sent')}</span>
              </div>
            )}

            {/* Primary Action Button */}
            <button
              onClick={() => {
                if (tab === "login") handleLogin();
                else if (tab === "register") handleRegister();
                else if (tab === "forgot") handleForgot();
                else if (tab === "verify-email") handleVerifyEmail();
                else if (tab === "complete-google") handleCompleteGoogleRegistration();
              }}
              disabled={loading}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-extrabold text-sm shadow-lg shadow-emerald-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 mt-5 disabled:opacity-50"
            >
              {loading ? <Loader2 className="animate-spin text-slate-950" size={18} /> : (
                <>
                  <span>
                    {tab === "login" ? t('auth_tab_login') :
                     tab === "register" ? t('auth_tab_register') :
                     tab === "forgot" ? t('login_send_link') :
                     tab === "complete-google" ? t('login_finish_register') : t('login_confirm_btn')}
                  </span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Footer Switcher */}
      <div className="mt-6 text-center z-10">
        {(tab === "login" || tab === "register") && (
          <div className="text-xs text-slate-400 font-medium">
            {tab === "login" ? (
              <>
                {t('login_no_account')}{" "}
                <button onClick={() => switchTab("register")} className="text-emerald-400 font-bold hover:underline ml-1">
                  {t('login_sign_up_link')}
                </button>
              </>
            ) : (
              <>
                {t('login_have_account')}{" "}
                <button onClick={() => switchTab("login")} className="text-emerald-400 font-bold hover:underline ml-1">
                  {t('auth_tab_login')}
                </button>
              </>
            )}
          </div>
        )}
        <button
          type="button"
          onClick={() => openPublicPage(PRIVACY_PATH, lang)}
          className="mt-3 text-[11px] text-slate-500 hover:text-slate-300 underline underline-offset-2 cursor-pointer"
        >
          {t('login_privacy_link')}
        </button>
      </div>
    </div>
  );
}

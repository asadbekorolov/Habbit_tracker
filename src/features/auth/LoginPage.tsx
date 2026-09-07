import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Zap, Eye, EyeOff, ArrowRight, Loader2, ArrowLeft,
  Mail, User as UserIcon, Chrome, Lock, Send
} from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { GoogleAuth } from "@codetrix-studio/capacitor-google-auth";
import {
  signInUser, resetUserPassword, resendConfirmationEmail,
  sendEmailOtp, verifyEmailOtpAndCreateAccount, ensureProfileForUser,
} from "../../services/db";
import { signInWithGoogle } from "../../services/authService";
import { supabase } from "../../services/supabase";
import type { Profile } from "../../services/supabase";
import { useLang } from "../../store/LangContext";
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
  isDark = true
}: any) => (
  <div className="relative mb-3.5 w-full">
    <label className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5 block">{label}</label>
    <div className="relative">
      <input
        type={isPassword ? (showPassword ? "text" : "password") : type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="w-full premium-input py-3.5 px-4 text-sm transition-all"
      />

      {isPassword && (
        <button
          type="button"
          onClick={onTogglePassword}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-white transition-colors"
        >
          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      )}
    </div>
  </div>
);

interface LoginPageProps {
  isDark: boolean;
  onLogin: (profile: Profile) => void;
}

type Tab = "login" | "register" | "forgot" | "verify-email";

export function LoginPage({ isDark, onLogin }: LoginPageProps) {
  const { t } = useLang();
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

  useEffect(() => {
    try {
      GoogleAuth.initialize();
    } catch (e) {
      console.warn("GoogleAuth initialize warning:", e);
    }
  }, []);

  async function handleGoogleLogin() {
    try {
      setLoading(true);
      setError("");

      const profile = await signInWithGoogle();
      if (profile) {
        trackEvent('login_success', { method: 'google' }, profile.id);
        onLogin(profile);
      }
    } catch (err: any) {
      console.error("Google Auth error:", err);
      const exactMsg = err?.message || "Google orqali kirishda xatolik yuz berdi";
      setError(exactMsg);
      toast.error(exactMsg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen w-full bg-background flex flex-col justify-center items-center px-6 py-12 overflow-y-auto">
      {/* Top Branding Section */}
      <div className="flex flex-col items-center text-center w-full max-w-sm mb-8">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-20 h-20 rounded-3xl bg-primary/10 border border-primary/20 flex items-center justify-center shadow-xl mb-6 relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-transparent" />
          <Zap size={40} className="text-primary relative z-10 fill-primary/20" />
        </motion.div>

        <h1 className="text-3xl font-black tracking-tight">
          {tab === "forgot" ? "Parolni tiklash" : tab === "verify-email" ? "Emailni tasdiqlash" : "Tracker"}
        </h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-xs mx-auto font-medium">
          {tab === "forgot" ? t('auth_reset_hint') :
           tab === "verify-email" ? `Biz ${pendingReg?.email} manziliga kod yubordik.` :
           "Kichik odatlar orqali katta natijalarga erishing."}
        </p>
      </div>

      {/* Main Content Area */}
      <div className="w-full max-w-sm premium-card p-6 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 blur-3xl" />

        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="relative z-10"
          >

            {(tab === "login" || tab === "register") && (
              <div className="space-y-3">
                {/* Social Buttons */}
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={loading}
                  className="w-full py-3.5 px-4 rounded-2xl bg-card border border-border text-foreground font-bold text-sm flex items-center justify-center gap-3 shadow-sm active:scale-[0.98] transition-all disabled:opacity-50"
                >
                  {loading ? <Loader2 className="animate-spin" size={18} /> : <Chrome size={18} className="text-primary" />}
                  Google orqali davom etish
                </button>

                <div className="flex items-center my-6">
                  <div className="flex-1 h-[1px] bg-border" />
                  <span className="text-[10px] uppercase text-muted-foreground font-black tracking-[0.2em] px-3">
                    yoki email orqali
                  </span>
                  <div className="flex-1 h-[1px] bg-border" />
                </div>

              </div>
            )}

            {/* ─── Login Form ─── */}
            {tab === "login" && (
              <div className="flex flex-col">
                <InputField
                  isDark={isDark}
                  label="Email manzil"
                  placeholder="misol@gmail.com"
                  value={loginEmail}
                  onChange={setLoginEmail}
                />
                <InputField
                  isDark={isDark}
                  label="Parol"
                  placeholder="••••••••"
                  isPassword
                  showPassword={showLoginPass}
                  onTogglePassword={() => setShowLoginPass(!showLoginPass)}
                  value={loginPassword}
                  onChange={setLoginPassword}
                />
                <div className="flex justify-end mt-1">
                  <button
                    type="button"
                    onClick={() => switchTab("forgot")}
                    className="text-xs text-emerald-600 dark:text-emerald-400 font-medium hover:underline"
                  >
                    Parolni unutdingizmi?
                  </button>
                </div>
              </div>
            )}

            {/* ─── Register Form ─── */}
            {tab === "register" && (
              <div className="flex flex-col">
                <InputField isDark={isDark} label="To'liq ismingiz" placeholder="Ism Sharif" value={regName} onChange={setRegName} />
                <InputField isDark={isDark} label="Foydalanuvchi nomi" placeholder="username" value={regUsername} onChange={(v: string) => setRegUsername(v.toLowerCase().replace(/[^a-z0-9_]/g, ""))} />
                <InputField isDark={isDark} label="Email manzil" placeholder="misol@gmail.com" value={regEmail} onChange={setRegEmail} />
                <InputField isDark={isDark} label="Parol" placeholder="Kamida 6 belgi" isPassword showPassword={showRegPass} onTogglePassword={() => setShowRegPass(!showRegPass)} value={regPassword} onChange={setRegPassword} />
                <InputField isDark={isDark} label="Tasdiqlash" placeholder="Qayta kiriting" isPassword showPassword={showRegConfirm} onTogglePassword={() => setShowRegConfirm(!showRegConfirm)} value={regConfirm} onChange={setRegConfirm} />
              </div>
            )}

            {/* ─── Forgot Form ─── */}
            {tab === "forgot" && (
              <div className="flex flex-col">
                <button type="button" onClick={() => switchTab("login")} className="flex items-center gap-2 text-xs text-slate-500 mb-4 hover:text-white transition-colors">
                  <ArrowLeft size={14} /> Ortga qaytish
                </button>
                <InputField label="Email manzil" placeholder="misol@gmail.com" value={forgotEmail} onChange={setForgotEmail} autoFocus />
                {forgotSent && (
                  <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium text-center mt-2">
                    {t('auth_reset_sent')}
                  </div>
                )}
              </div>
            )}

            {/* ─── Verify OTP Form ─── */}
            {tab === "verify-email" && (
              <div className="flex flex-col items-center">
                <input
                  type="text" inputMode="numeric" placeholder="••••••" maxLength={6}
                  value={regOtp} onChange={(e) => setRegOtp(e.target.value.replace(/\D/g, ""))}
                  className="w-full bg-slate-100 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 text-center text-4xl font-bold tracking-[0.5em] py-5 rounded-3xl text-slate-900 dark:text-white outline-none focus:border-emerald-500/50 mb-6 shadow-inner dark:shadow-none"
                />
                <button
                  disabled={otpCountdown > 0 || loading}
                  onClick={handleResendOtp}
                  className="text-xs font-semibold text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors disabled:opacity-50"
                >
                  {otpCountdown > 0 ? `Kodni qayta yuborish (${otpCountdown}s)` : "Kodni qayta yuborish"}
                </button>
              </div>
            )}

            {error && (
              <div className="mt-4 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-medium text-center">
                {error}
                {emailNotConfirmed && !resendSent && (
                  <button onClick={handleResend} className="block w-full mt-2 text-[10px] font-black uppercase text-rose-300 hover:underline">
                    {t('auth_resend_confirm_btn')}
                  </button>
                )}
              </div>
            )}

            {resendSent && (
              <div className="mt-4 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium text-center">
                {t('auth_confirm_sent')}
              </div>
            )}

            <button
              onClick={() => {
                if (tab === "login") handleLogin();
                else if (tab === "register") handleRegister();
                else if (tab === "forgot") handleForgot();
                else if (tab === "verify-email") handleVerifyEmail();
              }}
              disabled={loading}
              className="w-full py-4 rounded-2xl bg-primary text-primary-foreground font-black text-base shadow-lg shadow-primary/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 mt-6 disabled:opacity-50"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : (
                <>
                  <span>
                    {tab === "login" ? "Kirish" :
                     tab === "register" ? "Ro'yxatdan o'tish" :
                     tab === "forgot" ? "Havolani yuborish" : "Tasdiqlash"}
                  </span>
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Footer Switcher */}
      <div className="mt-8 text-center">
        {(tab === "login" || tab === "register") && (
          <div className="text-sm text-muted-foreground font-medium">
            {tab === "login" ? (
              <>
                Hisobingiz yo'qmi?{" "}
                <button onClick={() => switchTab("register")} className="text-primary font-bold hover:underline">
                  Ro'yxatdan o'ting
                </button>
              </>
            ) : (
              <>
                Profilingiz bormi?{" "}
                <button onClick={() => switchTab("login")} className="text-primary font-bold hover:underline">
                  Kirish
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}


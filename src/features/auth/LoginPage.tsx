import { useState, useEffect } from "react";
import { Zap, Eye, EyeOff, ArrowRight, Loader2, ArrowLeft, Mail } from "lucide-react";
import {
  signInUser, resetUserPassword, resendConfirmationEmail,
  sendEmailOtp, verifyEmailOtpAndCreateAccount,
} from "../../services/db";
import type { Profile } from "../../services/supabase";
import { useLang } from "../../store/LangContext";
import { trackEvent } from "../../utils/analytics";

interface LoginPageProps {
  isDark: boolean;
  onLogin: (profile: Profile) => void;
}

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <label className="text-xs font-medium mb-1.5 block" style={{ color: "var(--muted-foreground)" }}>
      {label}
    </label>
    {children}
  </div>
);

const PasswordInput = ({
  value, onChange, show, onToggle, onEnter, inputStyle, placeholder = "••••••••",
}: {
  value: string; onChange: (v: string) => void; show: boolean; onToggle: () => void;
  onEnter?: () => void; inputStyle: React.CSSProperties; placeholder?: string;
}) => (
  <div className="relative">
    <input
      style={{ ...inputStyle, paddingRight: 40 }}
      type={show ? "text" : "password"}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => e.key === "Enter" && onEnter?.()}
    />
    <button type="button" onClick={onToggle}
      className="absolute right-3 top-1/2 -translate-y-1/2"
      style={{ color: "var(--muted-foreground)" }}
    >
      {show ? <EyeOff size={16} /> : <Eye size={16} />}
    </button>
  </div>
);

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

  const card: React.CSSProperties = {
    background: isDark ? "rgba(22,27,34,0.95)" : "#ffffff",
    border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"}`,
    borderRadius: 16,
  };

  const inputStyle: React.CSSProperties = {
    background: isDark ? "rgba(255,255,255,0.05)" : "#F9FAFB",
    border: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}`,
    color: "var(--foreground)",
    borderRadius: 10,
    padding: "10px 14px",
    width: "100%",
    fontSize: 14,
    outline: "none",
  };

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
    if (msg.includes("bloklangan"))
      return msg;
    return msg || t('auth_err_generic');
  }

  function switchTab(t: Tab) {
    setTab(t);
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

  const submitBtn = (label: string, onClick: () => void, disabled = false) => (
    <button
      type="button"
      onClick={onClick}
      disabled={loading || disabled}
      className="flex items-center justify-center gap-2 w-full py-3 rounded-xl font-semibold text-sm transition-all mt-1"
      style={{
        background: loading || disabled ? "rgba(74,222,128,0.4)" : "var(--neon-green)",
        color: "#0E1117",
        boxShadow: loading || disabled ? "none" : "0 0 20px rgba(74,222,128,0.3)",
        cursor: loading || disabled ? "not-allowed" : "pointer",
      }}
    >
      {loading ? <Loader2 size={16} className="animate-spin" /> : <><span>{label}</span><ArrowRight size={16} /></>}
    </button>
  );

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "var(--background)" }}>
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
            style={{ background: "var(--neon-green)", boxShadow: "0 0 32px rgba(74,222,128,0.4)" }}
          >
            <Zap size={28} className="text-black" fill="black" />
          </div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>HabitTracker</h1>
          <p className="text-sm mt-1" style={{ color: "var(--muted-foreground)" }}>{t('auth_tagline')}</p>
        </div>

        <div style={card} className="p-6">
          {/* Tabs — only login/register */}
          {tab !== "forgot" && tab !== "verify-email" && (
            <div className="flex rounded-xl p-1 mb-5" style={{ background: isDark ? "rgba(255,255,255,0.05)" : "#F3F4F6" }}>
              {(["login", "register"] as const).map((tb) => (
                <button
                  key={tb}
                  type="button"
                  onClick={() => switchTab(tb)}
                  className="flex-1 py-2 rounded-lg text-sm font-medium transition-all"
                  style={{
                    background: tab === tb ? (isDark ? "rgba(255,255,255,0.1)" : "#fff") : "transparent",
                    color: tab === tb ? "var(--foreground)" : "var(--muted-foreground)",
                    boxShadow: tab === tb ? "0 1px 4px rgba(0,0,0,0.1)" : "none",
                  }}
                >
                  {tb === "login" ? t('auth_tab_login') : t('auth_tab_register')}
                </button>
              ))}
            </div>
          )}

          {/* ─── Login ─── */}
          {tab === "login" && (
            <div className="flex flex-col gap-3">
              <Field label={t('auth_email_label')}>
                <input
                  style={inputStyle} type="email" placeholder={t('auth_email_label')}
                  value={loginEmail}
                  onChange={(e) => { setLoginEmail(e.target.value); setEmailNotConfirmed(false); }}
                  onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                  autoFocus
                />
              </Field>
              <Field label={t('auth_password_label')}>
                <PasswordInput
                  inputStyle={inputStyle} value={loginPassword} onChange={setLoginPassword}
                  show={showLoginPass} onToggle={() => setShowLoginPass(!showLoginPass)}
                  onEnter={handleLogin} placeholder={t('auth_password_label')}
                />
              </Field>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => { setForgotEmail(loginEmail); switchTab("forgot"); }}
                  className="text-xs font-medium"
                  style={{ color: "var(--neon-green)" }}
                >
                  {t('auth_forgot_password')}
                </button>
              </div>

              {error && (
                <div
                  className="text-xs px-3 py-2.5 rounded-lg"
                  style={{ color: "var(--coral-red)", background: isDark ? "rgba(248,113,113,0.1)" : "#FEF2F2" }}
                >
                  <p>⚠ {error}</p>
                  {emailNotConfirmed && !resendSent && (
                    <button
                      type="button"
                      onClick={handleResend}
                      disabled={loading}
                      className="mt-2 flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all w-full justify-center"
                      style={{ background: "rgba(248,113,113,0.15)", border: "1px solid rgba(248,113,113,0.3)", color: "var(--coral-red)" }}
                    >
                      <Mail size={13} /> {t('auth_resend_confirm_btn')}
                    </button>
                  )}
                </div>
              )}

              {resendSent && (
                <p className="text-xs px-3 py-2 rounded-lg" style={{ color: "var(--neon-green)", background: isDark ? "rgba(74,222,128,0.1)" : "#F0FDF4" }}>
                  {t('auth_confirm_sent')}
                </p>
              )}

              {submitBtn(t('auth_tab_login'), handleLogin)}
            </div>
          )}

          {/* ─── Forgot Password ─── */}
          {tab === "forgot" && (
            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={() => switchTab("login")}
                className="flex items-center gap-1.5 text-xs mb-1"
                style={{ color: "var(--muted-foreground)" }}
              >
                <ArrowLeft size={13} /> {t('auth_back_to_login')}
              </button>
              <div className="mb-1">
                <h2 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>{t('auth_reset_password_title')}</h2>
                <p className="text-xs mt-1" style={{ color: "var(--muted-foreground)" }}>
                  {t('auth_reset_hint')}
                </p>
              </div>
              <Field label={t('auth_email_label')}>
                <input
                  style={inputStyle} type="email" placeholder={t('auth_email_label')}
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleForgot()}
                  autoFocus
                />
              </Field>
              {error && (
                <p className="text-xs px-3 py-2 rounded-lg" style={{ color: "var(--coral-red)", background: isDark ? "rgba(248,113,113,0.1)" : "#FEF2F2" }}>
                  ⚠ {error}
                </p>
              )}
              {forgotSent ? (
                <p className="text-xs px-3 py-2 rounded-lg" style={{ color: "var(--neon-green)", background: isDark ? "rgba(74,222,128,0.1)" : "#F0FDF4" }}>
                  {t('auth_reset_sent')}
                </p>
              ) : submitBtn(t('auth_send_email_btn'), handleForgot)}
            </div>
          )}

          {/* ─── Register ─── */}
          {tab === "register" && (
            <div className="flex flex-col gap-3">
              <Field label={t('auth_fullname_label')}>
                <input style={inputStyle} placeholder={t('auth_fullname_label')} value={regName}
                  onChange={(e) => setRegName(e.target.value)} autoFocus />
              </Field>
              <Field label={t('auth_username_label')}>
                <input style={inputStyle} placeholder="username" value={regUsername}
                  onChange={(e) => setRegUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))} />
              </Field>
              <Field label={t('auth_email_label')}>
                <input style={inputStyle} type="email" placeholder={t('auth_email_label')} value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)} />
              </Field>
              <Field label={t('auth_password_min_label')}>
                <PasswordInput inputStyle={inputStyle} value={regPassword} onChange={setRegPassword}
                  show={showRegPass} onToggle={() => setShowRegPass(!showRegPass)} placeholder={t('auth_password_label')} />
              </Field>
              <Field label={t('auth_confirm_password_label')}>
                <PasswordInput inputStyle={inputStyle} value={regConfirm} onChange={setRegConfirm}
                  show={showRegConfirm} onToggle={() => setShowRegConfirm(!showRegConfirm)}
                  onEnter={handleRegister} placeholder={t('auth_confirm_password_label')} />
              </Field>
              {error && (
                <p className="text-xs px-3 py-2 rounded-lg" style={{ color: "var(--coral-red)", background: isDark ? "rgba(248,113,113,0.1)" : "#FEF2F2" }}>
                  ⚠ {error}
                </p>
              )}
              {submitBtn(t('auth_tab_register'), handleRegister)}
            </div>
          )}

          {/* ─── Email OTP Verify ─── */}
          {tab === "verify-email" && (
            <div className="flex flex-col gap-4">
              <button
                type="button"
                onClick={() => { setTab("register"); setError(""); }}
                className="flex items-center gap-1.5 text-xs"
                style={{ color: "var(--muted-foreground)" }}
              >
                <ArrowLeft size={13} /> {t('auth_back_btn')}
              </button>

              <div className="text-center py-2">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3"
                  style={{ background: isDark ? "rgba(74,222,128,0.1)" : "#F0FDF4", border: "1px solid rgba(74,222,128,0.3)" }}
                >
                  <Mail size={24} style={{ color: "var(--neon-green)" }} />
                </div>
                <h2 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                  {t('auth_email_verify_title')}
                </h2>
                <p className="text-xs mt-1.5" style={{ color: "var(--muted-foreground)" }}>
                  <span style={{ color: "var(--foreground)", fontWeight: 600 }}>
                    {pendingReg?.email}
                  </span>{" "}
                  {t('auth_email_sent_to')}
                </p>
              </div>

              <input
                style={{
                  ...inputStyle,
                  textAlign: "center",
                  fontSize: 28,
                  letterSpacing: 10,
                  fontFamily: "'Geist Mono', monospace",
                  fontWeight: 700,
                  padding: "14px",
                }}
                type="text"
                inputMode="numeric"
                placeholder="• • • • • •"
                value={regOtp}
                maxLength={6}
                autoFocus
                onChange={(e) => setRegOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                onKeyDown={(e) => e.key === "Enter" && handleVerifyEmail()}
              />

              {error && (
                <p className="text-xs px-3 py-2 rounded-lg" style={{ color: "var(--coral-red)", background: isDark ? "rgba(248,113,113,0.1)" : "#FEF2F2" }}>
                  ⚠ {error}
                </p>
              )}

              {submitBtn(t('auth_verify_btn'), handleVerifyEmail, regOtp.replace(/\D/g, "").length < 6)}

              <button
                type="button"
                onClick={handleResendOtp}
                disabled={otpCountdown > 0 || loading}
                className="text-xs text-center w-full py-1 rounded-lg transition-all"
                style={{
                  color: otpCountdown > 0 ? "var(--muted-foreground)" : "var(--neon-green)",
                  cursor: otpCountdown > 0 ? "default" : "pointer",
                }}
              >
                {otpCountdown > 0
                  ? t('auth_resend_in').replace('{n}', String(otpCountdown))
                  : t('auth_resend_code_btn')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

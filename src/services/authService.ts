import { Capacitor } from "@capacitor/core";
import { GoogleAuth } from "@codetrix-studio/capacitor-google-auth";
import { supabase } from "./supabase";
import { ensureProfileForUser } from "./db";
import type { Profile } from "./supabase";

export async function signInWithGoogle(): Promise<Profile | null> {
  if (Capacitor.isNativePlatform()) {
    try {
      GoogleAuth.initialize();
    } catch (e) {
      console.warn("GoogleAuth initialize warning:", e);
    }

    try {
      // Triggers the native Android account picker
      const res = await GoogleAuth.signIn();

      // Handle both direct and authentication nested object structures
      const idToken = res?.authentication?.idToken || (res as any)?.idToken;

      if (!idToken) {
        throw new Error("Google idToken bo'sh qaytdi (Android client/serverClientId sozlamasini tekshiring)");
      }

      // Exchange ID token with Supabase
      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: idToken,
      });

      if (error) {
        console.error("Supabase signInWithIdToken failed:", error);
        throw new Error(`Supabase xatosi: ${error.message}`);
      }

      if (data?.user) {
        return await ensureProfileForUser(data.user);
      }

      return null;
    } catch (err: any) {
      console.error("Native GoogleAuth exception:", err);
      if (err?.message && (err.message.startsWith("Supabase xatosi:") || err.message.startsWith("Google idToken"))) {
        throw err;
      }
      const rawMsg = err?.message || (typeof err === 'object' ? JSON.stringify(err) : String(err));
      throw new Error(`Google xatosi: ${rawMsg}`);
    }
  } else {
    // Web fallback
    const redirectUrl = window.location.origin;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
      },
    });

    if (error) throw new Error(`Supabase OAuth xatosi: ${error.message}`);
    return null;
  }
}

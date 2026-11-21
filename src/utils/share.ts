// Ulashish yordamchilari: matn/havola, PNG rasm, Telegram va nusxalash.
// Ilovada — Android ulashish oynasi (@capacitor/share), vebda — Web Share API,
// u bo'lmasa — nusxalash yoki yuklab olish.
import { Capacitor } from "@capacitor/core";
import { Share } from "@capacitor/share";
import { Browser } from "@capacitor/browser";
import { Filesystem, Directory } from "@capacitor/filesystem";

export type ShareOutcome = "shared" | "copied" | "saved" | "cancelled" | "failed";

function isCancel(e: unknown): boolean {
  const m = String((e as { message?: string })?.message ?? e ?? "").toLowerCase();
  return m.includes("cancel") || m.includes("abort");
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

/** Matn va havolani ulashish; imkon bo'lmasa — nusxalash */
export async function shareLink(opts: { title: string; text: string; url: string; dialogTitle?: string }): Promise<ShareOutcome> {
  try {
    if (Capacitor.isNativePlatform()) {
      await Share.share({ title: opts.title, text: opts.text, url: opts.url, dialogTitle: opts.dialogTitle ?? opts.title });
      return "shared";
    }
    if (typeof navigator.share === "function") {
      await navigator.share({ title: opts.title, text: opts.text, url: opts.url });
      return "shared";
    }
  } catch (e) {
    if (isCancel(e)) return "cancelled";
  }
  return (await copyText(`${opts.text}\n${opts.url}`)) ? "copied" : "failed";
}

export function telegramShareUrl(url: string, text: string): string {
  return `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
}

/** Tashqi havola: ilovada tizim brauzeri (Telegram o'zi ilovasini taklif qiladi), vebda yangi oyna */
export async function openExternal(url: string): Promise<void> {
  if (Capacitor.isNativePlatform()) await Browser.open({ url });
  else window.open(url, "_blank", "noopener,noreferrer");
}

function base64Of(dataUrl: string): string {
  return dataUrl.replace(/^data:image\/\w+;base64,/, "");
}

async function dataUrlToFile(dataUrl: string, fileName: string): Promise<File> {
  const blob = await (await fetch(dataUrl)).blob();
  return new File([blob], fileName, { type: blob.type || "image/png" });
}

function downloadDataUrl(dataUrl: string, fileName: string) {
  const a = document.createElement("a");
  a.download = fileName;
  a.href = dataUrl;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/** PNG rasmni ulashish (ilovada fayl sifatida, vebda Web Share bilan) */
export async function shareImage(dataUrl: string, opts: { fileName: string; title: string; text: string; dialogTitle?: string }): Promise<ShareOutcome> {
  try {
    if (Capacitor.isNativePlatform()) {
      const written = await Filesystem.writeFile({ path: opts.fileName, data: base64Of(dataUrl), directory: Directory.Cache });
      await Share.share({ title: opts.title, text: opts.text, url: written.uri, dialogTitle: opts.dialogTitle ?? opts.title });
      return "shared";
    }
    const file = await dataUrlToFile(dataUrl, opts.fileName);
    if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: opts.title, text: opts.text });
      return "shared";
    }
  } catch (e) {
    if (isCancel(e)) return "cancelled";
    if (Capacitor.isNativePlatform()) return "failed";
  }
  downloadDataUrl(dataUrl, opts.fileName);
  return "saved";
}

/** PNG rasmni qurilmaga saqlash: ilovada Documents/IDROK, vebda yuklab olish */
export async function saveImage(dataUrl: string, fileName: string): Promise<ShareOutcome> {
  if (!Capacitor.isNativePlatform()) {
    downloadDataUrl(dataUrl, fileName);
    return "saved";
  }
  try {
    await Filesystem.writeFile({ path: `IDROK/${fileName}`, data: base64Of(dataUrl), directory: Directory.Documents, recursive: true });
    return "saved";
  } catch {
    return "failed";
  }
}

// Minimal client-side CSV export — no dependency, just a Blob + <a download>.
// UTF-8 BOM prefix so Excel renders Cyrillic/Uzbek diacritics correctly.
export function downloadCsv(filename: string, headers: string[], rows: (string | number | null | undefined)[][]) {
  function escape(v: string | number | null | undefined): string {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }
  const lines = [headers.map(escape).join(","), ...rows.map((r) => r.map(escape).join(","))];
  const csv = "﻿" + lines.join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

import React from "react";
import { Bell } from "lucide-react";

export interface MinimalDashboardHeaderProps {
  avatarUrl?: string;
  displayName?: string;
  username?: string;
  level?: number;
  onNotificationClick?: () => void;
  onProfileClick?: () => void;
}

export function MinimalDashboardHeader({
  avatarUrl,
  displayName,
  username,
  level = 3,
  onNotificationClick,
  onProfileClick
}: MinimalDashboardHeaderProps) {
  const nameToDisplay = displayName || username || "Foydalanuvchi";
  const firstName = nameToDisplay.split(" ")[0];

  return (
    <header className="flex items-center justify-between py-2">
      {/* Left: Squircle User Avatar + Uzbek Greeting */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onProfileClick}
          className="relative shrink-0 active:scale-95 transition-transform cursor-pointer"
          aria-label="Profilga o'tish"
        >
          <div className="w-11 h-11 rounded-2xl bg-slate-900 border border-slate-800/80 flex items-center justify-center text-emerald-400 font-bold font-mono text-sm shadow-inner overflow-hidden">
            {avatarUrl ? (
              <img src={avatarUrl} alt={firstName} className="w-full h-full object-cover" />
            ) : (
              <span>{firstName[0]?.toUpperCase() || "A"}</span>
            )}
          </div>
        </button>

        <div>
          <p className="text-xs text-slate-400 font-medium leading-none">
            Assalomu alaykum
          </p>
          <h1 className="text-base font-bold text-slate-100 tracking-tight mt-1">
            Xayrli kun, {firstName}
          </h1>
        </div>
      </div>

      {/* Right: Level Indicator Badge in Geist Mono + Bell Notification Button */}
      <div className="flex items-center gap-2.5">
        <div className="font-['Geist_Mono',monospace] font-mono text-xs font-bold text-emerald-400 bg-emerald-950/40 border border-emerald-500/20 px-2.5 py-1 rounded-full shadow-sm tracking-wide uppercase">
          {level}-DARAJA
        </div>

        <button
          type="button"
          onClick={onNotificationClick}
          aria-label="Bildirishnomalar"
          className="w-10 h-10 rounded-2xl bg-slate-900/60 border border-slate-800/80 flex items-center justify-center text-slate-300 hover:text-emerald-400 hover:border-emerald-500/40 active:scale-95 transition-all shadow-sm cursor-pointer"
        >
          <Bell className="w-4 h-4 stroke-[2]" />
        </button>
      </div>
    </header>
  );
}

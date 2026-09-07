# Comprehensive UI/UX Refactoring & Feature Fixes (Habit Tracker)

This plan outlines the systemic fixes across layout, dashboard, habit manager, poster generator, analytics, profile, health module, and build/asset verification, incorporating light mode contrast fixes and gamification stage preservation.

## User Review Required

> [!IMPORTANT]
> - **Global Header Unification**: Header stats (Avatar, Name, Coins, Level, XP bar) will be consolidated into a single clean top bar, removing duplicate stat displays in individual page bodies.
> - **Dashboard Character Stage**: The dashboard hero container is preserved as a dedicated stage for the Gamified Character/Avatar system with clean Light/Dark tokens (`bg-white dark:bg-neutral-900 border border-slate-200 dark:border-white/10`), while removing duplicate coin/XP/level elements.
> - **Habit Grouping**: Distinctly separate "Ijobiy Odatlar" (Positive habits with XP/Coins) and "Cheklovlar va Salbiy Odatlar" (Negative/Limit habits with HP shield logic).
> - **Market Navigation**: Fixes the "Marketga o'tish" CTA button so it opens the Shop/Market modal instead of routing to Profile.
> - **Profile Redesign**: Removes duplicate profile edit button (editing is exclusively in Settings), removes redundant statistics (moved to Analytics), adds a Character/Avatar showcase, and revamps Badges with a "Barcha Nishonlar" modal.
> - **Localization & Raw Keys**: Replaces raw translation keys (`settings_theme`, `settings_theme_sub`, `PROFILE_BADGES`, etc.) with proper localized strings.

## Proposed Changes

### 1. Global Header & Navigation (`App.tsx`, `Sidebar.tsx`)
- **[MODIFY]** [App.tsx](file:///C:/Users/asadb/Downloads/Habbit_tracker-main/Habbit_tracker-main/src/App.tsx): Unify the global header layout to display Avatar, greeting, Level pill, Coin pill, and Notification bell cleanly. Ensure no header stat duplication. Fix Market CTA navigation handler.
- **[MODIFY]** [Sidebar.tsx](file:///C:/Users/asadb/Downloads/Habbit_tracker-main/Habbit_tracker-main/src/components/Sidebar.tsx): Verify all navigation routes and tabs.

### 2. Dashboard & Character Stage (`Dashboard.tsx`)
- **[MODIFY]** [Dashboard.tsx](file:///C:/Users/asadb/Downloads/Habbit_tracker-main/Habbit_tracker-main/src/features/dashboard/Dashboard.tsx):
  - Preserve the hero container as a dedicated stage for the Gamified Character/Avatar system with proper Light/Dark tokens (`bg-white dark:bg-neutral-900 border border-slate-200 dark:border-white/10`).
  - Remove duplicated coin/XP/level bars. Add an explicit HP bar next to XP with clear visual status.
  - Delineate "Ijobiy Odatlar" and "Cheklovlar va Salbiy Odatlar".
  - Fix "Marketga o'tish" CTA handler to open the Shop/Market modal (`CoinShopModal`).

### 3. Habit Management & Creation (`HabitsManager.tsx`, `AddHabitModal.tsx`)
- **[MODIFY]** [HabitsManager.tsx](file:///C:/Users/asadb/Downloads/Habbit_tracker-main/Habbit_tracker-main/src/features/habits/HabitsManager.tsx): Add a prominent Floating Action Button (FAB) or high-contrast top button labeled `"+ Yangi odat"` with an icon. Ensure edit and delete modal flows do not clip against the bottom navigation bar.

### 4. Poster Export & Time-Series Analytics (`Analytics.tsx`)
- **[MODIFY]** [Analytics.tsx](file:///C:/Users/asadb/Downloads/Habbit_tracker-main/Habbit_tracker-main/src/features/analytics/Analytics.tsx):
  - Replace failing DOM canvas/export mechanism with robust off-screen rendered modern SVG or HTML-to-Image canvas generator.
  - Structure poster around clear metrics (Active streak days, completion percentage, total focus hours, total habits tracked).
  - Relocate "Jami bajarildi", "Eng uzun seria", and "Faol kunlar" from Profile into Tab 4 (Analytics).

### 5. Leaderboard Periods (`GlobalLeaderboardPage.tsx`)
- **[MODIFY]** [GlobalLeaderboardPage.tsx](file:///C:/Users/asadb/Downloads/Habbit_tracker-main/Habbit_tracker-main/src/features/leaderboard/GlobalLeaderboardPage.tsx):
  - Add interval filters: "Kunlik", "Oylik", "6 Oylik", "Yillik".
  - Reset monthly competition standings on the 1st of each month in queries while maintaining historical all-time metrics.

### 6. Profile Screen Cleanup & Gamification (`ProfilePage.tsx`)
- **[MODIFY]** [ProfilePage.tsx](file:///C:/Users/asadb/Downloads/Habbit_tracker-main/Habbit_tracker-main/src/features/profile/ProfilePage.tsx):
  - Remove `profile_edit` button (profile editing is exclusively in Settings).
  - Replace raw coin/level buttons in profile body with a dedicated Character/Avatar showcase supporting unlockable frames and skins.
  - Move statistics to Analytics.
  - Revamp Badges: Container under "Qozonilgan Nishonlar" with a prominent "Barcha Nishonlar" button opening a modal with full roster and progress.

### 7. Health & Wellness Module (`HealthPage.tsx`)
- **[MODIFY]** [HealthPage.tsx](file:///C:/Users/asadb/Downloads/Habbit_tracker-main/Habbit_tracker-main/src/features/habits/HealthPage.tsx):
  - Add/refine dedicated Health & Wellness card: Sleep tracking (hours logged vs target), daily water intake (liters/glasses counter), and step counter.
  - Connect inputs to daily health streak indicators.

### 8. Localization & Build Verification (`i18n.ts`, Build)
- **[MODIFY]** [i18n.ts](file:///C:/Users/asadb/Downloads/Habbit_tracker-main/Habbit_tracker-main/src/utils/i18n.ts): Replace raw translation keys (`settings_theme`, `settings_theme_sub`, `PROFILE_BADGES`, etc.) with proper localized Uzbek strings.
- Verify all Lucide React icon imports.
- Run `npm run build && npx cap sync android`.

## Verification Plan

### Automated Tests
- Run `npx tsc --noEmit` and `npm run build` to verify TypeScript compilation and Vite build success.
- Run `npx cap sync android` to verify Capacitor synchronization.

### Manual Verification
- Deploy or preview the app to test all updated UI/UX features, header unification, character stage, modal routing, analytics metrics, leaderboard filters, badges modal, and health tracking.

# Tracker
### Turn accountability into a game. Turn habits into data.

**Live product:** [habit-tracker-asadbek.vercel.app](https://habit-tracker-asadbek.vercel.app)

> *"Isbotlash. Tasdiqlash. Tahlil qilish."*
> *Prove it. Approve it. Track it.*

---

## 1. Vision

**Tracker** is a gamified, group-first habit tracking platform built to answer one question: *why do people who genuinely want to change still give up within a few weeks?*

Our mission is simple — replace willpower with **structure**, replace guesswork with **data**, and replace silent failure with **social accountability**. Tracker turns the vague promise "I'll do better" into a daily, measurable, provable habit — verified by real people, rewarded with real progress, and backed by real numbers.

---

## 2. The Problem

Most habit-building attempts today don't fail because people lack motivation on day one — they fail because there is no *system* to sustain it past day one.

### Where it usually starts: the Telegram group

Ask any group of friends who've tried to build habits together, and the story is the same:

- 📸 Every day, members send proof into a group chat — a photo, a voice note, a screenshot of steps walked or pages read.
- 👀 One person (the "leader") is expected to manually check who did what.
- 🗑️ None of it is recorded anywhere. It scrolls away in the chat history within hours.

### Why this breaks down

| Pain Point | What actually happens |
|---|---|
| **No structure** | Habits are tracked as free-form messages, not standardized, comparable data |
| **No real accountability** | Anyone can claim they did something — there's no lightweight approval workflow, so verification quietly stops happening |
| **No competition or reward** | There's no score, no streak, no leaderboard — effort and laziness look identical from the outside |
| **No tracking or insight** | No one can answer "how many days did I actually succeed this month?" — so there's no way to feel proof of progress |
| **No lasting motivation** | Without visible progress, groups quietly go silent. In our own founding group of 7 people, this is exactly what happened — the habit-tracking chat died out after roughly 80 days, with zero data to show for it. |

**The core insight:** groups don't fail because people are lazy. They fail because there is no system that captures effort, verifies it, rewards it, and shows it back to people as visible progress.

---

## 3. The Solution — Tracker

Tracker takes the exact workflow that groups were already doing manually inside Telegram — *log it, prove it, get it checked* — and turns it into a real product with three upgrades that a group chat can never provide:

1. **Structured tracking** — every habit, log, and proof is stored as real data, not a message that disappears.
2. **Gamification** — points, levels, streaks, coins, and cosmetics turn consistency into something visibly rewarding.
3. **Verified accountability** — a group leader (or co-admin) reviews and approves proof directly in the app, so completions are trustworthy, not just self-reported.

The result: individuals get a personal habit-tracking system with real analytics, and groups get a lightweight, enforceable accountability loop — without a single message getting lost in a chat.

---

## 4. Core Features & Mechanics

### 📋 Habit Tracking & Daily Journal
- Three-state daily logging for every habit — **Done / Not Done / Pending** — applied consistently to both positive habits (drink water, wake up early) and negative ones (quit sugar, no phone after 10pm).
- Numeric habits supported natively (glasses of water, minutes run, pages read), not just yes/no checkboxes.
- Habits are created from a **standardized, categorized catalog** (Health, Focus & Learning, Consistency) rather than free text — which keeps data clean and comparable across users.
- A daily logging window (midnight → 9 AM the next day) keeps the data honest: once it closes, that day's log is locked and read-only forever.
- Month-view heatmap, weekly reflection ritual, and a personal daily journal (mood, notes) round out the day-to-day experience.

### 🪙 Coin Economy & Shop
Every approved positive habit earns **score**, and score converts into **coins** — Tracker's in-app currency. Coins are spent in the **Coin Shop** on cosmetic status symbols that expire, encouraging continued engagement rather than a one-time purchase:

| Item | Effect | Duration |
|---|---|---|
| 🥉 Bronze Frame | Bronze avatar border | 30 days |
| 🥈 Silver Frame | Silver avatar border | 30 days |
| 👑 Gold Frame | Gold avatar border + glow | 30 days |
| ✨ Neon Username | Glowing "neon" text effect on your display name | Permanent |
| 🎨 Premium avatar gradients | Exclusive color palettes (Sunset, Galaxy, Ocean) | Permanent |
| ❄️ Streak Freeze | Protects your streak for one missed day | Consumable |

This creates a self-sustaining loop: **do the habit → earn coins → show off progress → stay motivated to keep the streak alive.**

### 👥 Group Collaboration & Verified Accountability
This is Tracker's core differentiator versus every generic habit app on the market.

- **Groups** with a leader/admin and members, including support for **sub-teams** inside larger groups.
- **Custom group habits** the whole group commits to together (e.g. "60 push-ups a day").
- **Proof submission workflow:** a member logs a habit with an optional proof note → status becomes `pending` → the group admin or co-admin reviews it directly in the app and **Approves** or **Rejects** (with a reason).
- Only approved logs count toward score, streaks, and group analytics — closing the "anyone can claim anything" loophole that kills Telegram-based accountability groups.
- **Real-time sync:** member lists, pending approvals, and daily logs update live across every open device via Supabase Realtime — no manual refresh needed.
- **Group analytics dashboard:** monthly per-member breakdown, daily completion trend chart, per-habit performance, and a ranked leaderboard (weekly & all-time) with avatars.

### 🛠️ Advanced Admin Panel
A full operational back-office for platform owners, built directly into the app:

- **Overview / Statistics** — key platform metrics at a glance, with a moderation queue for pending group proof across *all* groups.
- **Users** — searchable table (avatar, status, role, coin/score balance, efficiency %, join date) with ban/unban, per-user bonus coin/score grants, and a detailed drill-down modal per user.
- **Habits** — a dedicated management table of every habit on the platform: name, creator (name & username), category, frequency, and creation date.
- **Feedback** — in-app user feedback with a full **admin reply workflow** that automatically notifies the author when their feedback receives a response.
- **Analytics** — a multi-card dashboard covering user growth, habit completion rates, gamification economy (coins, XP, active cosmetics in circulation), and group/social metrics.
- **Monitoring** — daily active users (DAU), most popular habits platform-wide, with visible error states instead of silently showing empty data.
- **Health Check** — surfaces inactive groups so admins can intervene or clean up stale groups.
- **CSV Export everywhere** — one-click export buttons at the top of the Users, Feedback, and Habits sections for external analysis.

### 🏆 Gamification Layer
- **5-tier level system** (🌱 New → ⚡ Explorer → 🔥 Consistent → 💎 Master → 👑 Champion) driven by score.
- **Streaks** with milestone celebrations (7 / 14 / 21 / 30 days) and smart at-risk warnings ("your 3-day streak is at risk!").
- **Global leaderboard** and a social **follow + feed** system to see friends' progress.
- **Achievements** — client-tracked badges (first habit, 7/30-day streaks, 100/500 score) plus server-verified special badges for genuinely hard milestones.
- **AI Coach** — a Claude-powered endpoint that gives personalized, data-driven feedback based on a user's actual habit history.

---

## 5. Tech Stack & Architecture

Tracker is built as a modern, production-grade web application — not a prototype — with real-time data, strict access control, and a deployment pipeline built for rapid iteration.

| Layer | Technology |
|---|---|
| **Frontend** | React 18 + TypeScript, built with Vite |
| **Styling** | Tailwind CSS + CSS variables — fully responsive, native **dark/light theme** support across every screen |
| **Icons / Charts** | Lucide React, Recharts (trend charts, heatmaps) |
| **Backend & Database** | Supabase — PostgreSQL, Auth, Row-Level Security (RLS), and Realtime subscriptions |
| **Serverless Functions** | Vercel Functions (`/api`) — AI Coach (Anthropic Claude), Telegram bot integration, group push notifications |
| **Hosting & CI/CD** | Vercel — Git-based deploys straight to production (`main` → live in seconds) |
| **PWA** | Installable as a Progressive Web App, with offline-aware handling |
| **Localization** | Fully synced i18n across Uzbek, Russian, and English |

**Security model:** every privileged action (admin bans, group approvals, score/coin grants) runs through `SECURITY DEFINER` Postgres RPC functions with explicit `auth.uid()` + role checks — not client-side trust. Row-Level Security policies enforce who can read or write every table at the database layer, independent of the frontend.

**Data model highlights:** `profiles`, `habits`, `habit_logs`, `groups` / `group_members` / `group_habits` / `group_habit_logs`, `health_logs`, `weekly_reflections`, `user_feedback`, `notifications`, `coin_purchases`, and `achievements` — all versioned through numbered SQL migrations for a fully auditable schema history.

---

## 6. Roadmap & Impact

### What's next
- **Mobile app** (React Native) for native push notifications and offline-first logging.
- **Monetization** via premium cosmetic tiers and advanced analytics for group leaders.
- **Deeper AI coaching** — proactive, personalized nudges rather than on-demand feedback.
- **Expanded integrations** beyond Telegram (WhatsApp, Discord) for group proof submission.

### Why this matters
Tracker was born from a real, lived failure — a 7-person accountability group that quietly died after 80 days because nothing was ever recorded. That failure is common, not unique: it's the default outcome for almost every self-organized habit group. Tracker directly fixes the three things that killed it — **structure, verification, and visible progress** — and packages the fix as a product real people already want to use.

For a platform like the **President Tech Award**, Tracker demonstrates a complete, working product: a real problem grounded in lived experience, a full-stack implementation with production-grade security and real-time infrastructure, a functioning admin operations layer, and a gamification loop designed to keep users — and groups — coming back every single day.

---

*Tracker — Prove it. Approve it. Track it.*

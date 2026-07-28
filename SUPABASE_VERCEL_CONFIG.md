# 🔑 Supabase & Vercel & GitHub Integratsiya Hujjatlari (Config)

Ushbu fayl loyihaning Git, Vercel hamda Supabase sozlamalari va koder/agentlar uchun kerakli kod namunalari uchun saqlandi.

---

## 📌 1. Loyiha Manzillari va ID'lari

* **GitHub Repository:** `git@github.com:asadbekorolov/Habbit_tracker.git`
* **Vercel Project ID:** `prj_H1dx1S567vr7eRCbz6yfhuCGoE0f`
* **Live App URL:** `https://habit-tracker-asadbek.vercel.app`

---

## ⚡ 2. Supabase Sozlamalari (Credentials)

```env
NEXT_PUBLIC_SUPABASE_URL=https://kiwrqzetpyobaemrsquq.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_-FM3LPMANMViaqDZ1IW2dw_vYOAJv1z
```

---

## 🛠️ 3. Packages & SSR Code Snippets (Kelajakdagi integratsiyalar uchun)

### 3.1 Kerakli Paketlarni o'rnatish
```bash
npm install @supabase/supabase-js @supabase/ssr
```

### 3.2 `utils/supabase/server.ts`
```typescript
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const createClient = (cookieStore: Awaited<ReturnType<typeof cookies>>) => {
  return createServerClient(
    supabaseUrl!,
    supabaseKey!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
          } catch {
            // The `setAll` method was called from a Server Component.
          }
        },
      },
    },
  );
};
```

### 3.3 `utils/supabase/client.ts`
```typescript
import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const createClient = () =>
  createBrowserClient(
    supabaseUrl!,
    supabaseKey!,
  );
```

### 3.4 `utils/supabase/middleware.ts`
```typescript
import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const createClient = (request: NextRequest) => {
  let supabaseResponse = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    supabaseUrl!,
    supabaseKey!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    },
  );

  return supabaseResponse
};
```

### 3.5 Sample Usage (`page.tsx`)
```typescript
import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'

export default async function Page() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { data: todos } = await supabase.from('todos').select()

  return (
    <ul>
      {todos?.map((todo) => (
        <li key={todo.id}>{todo.name}</li>
      ))}
    </ul>
  )
}
```

---

## 🤖 4. Supabase Agent Skills
```bash
npx skills add supabase/agent-skills
```

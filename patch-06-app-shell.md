# patch-06-app-shell.md

## src/app/layout.tsx

```typescript
import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Geist, Geist_Mono } from "next/font/google";
import { EazoProvider } from "@eazo/sdk/react";
import { cn } from "@/utils/utils";
import { Toaster } from "@/components/ui/sonner";
import { UserSyncEffect } from "@/components/user-profile/user-sync-effect";
import { I18nProvider } from "@/components/i18n/i18n-provider";
import { LocaleSyncEffect } from "@/components/i18n/locale-sync-effect";
import { getServerLocale } from "@/lib/i18n/server-preference";

const geist = Geist({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-geist",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-geist-mono",
});

const SITE_URL = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : undefined;

const SITE_TITLE = process.env.NEXT_PUBLIC_APP_TITLE?.trim() || "AutoTask";
const SITE_DESCRIPTION =
  process.env.NEXT_PUBLIC_APP_DESCRIPTION?.trim() ||
  "Type a goal, let AI plan the rest.";

export const metadata: Metadata = {
  ...(SITE_URL ? { metadataBase: new URL(SITE_URL) } : {}),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  icons: { icon: "https://eazo.ai/favicon.ico" },
  openGraph: {
    type: "website",
    siteName: "Eazo",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: "/",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = await getServerLocale();

  return (
    <html
      lang={locale}
      suppressHydrationWarning
      className={cn("h-full antialiased", geist.variable, geistMono.variable)}
    >
      <body className="h-full flex flex-col overflow-hidden">
        <I18nProvider>
          <EazoProvider>
            <LocaleSyncEffect />
            <UserSyncEffect />
            {children}
            <Toaster />
          </EazoProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
```

---

## src/app/globals.css

```css
@import "tailwindcss";
@import "tw-animate-css";
@import "shadcn/tailwind.css";

@custom-variant dark (&:is(.dark *));

/* ── AutoTask Design Tokens — 清单仪式 ───────────────────────────── */
@theme inline {
  /* Fonts */
  --font-sans:    var(--font-geist);
  --font-mono:    var(--font-geist-mono);
  --font-heading: var(--font-geist);

  /* Brand palette */
  --color-ink:        #111111;
  --color-muted:      #777B75;
  --color-accent:     #3B7AFF;
  --color-green:      #2F5D50;
  --color-sage:       #A8B5A2;
  --color-paper:      #F4F1EA;
  --color-soft:       #F1F2EE;
  --color-line:       #E7E7E2;
  --color-bg:         #F9F9F8;
  --color-surface:    #FFFFFF;

  /* Shadcn semantic → clean white theme */
  --color-background:           var(--background);
  --color-foreground:           var(--foreground);
  --color-card:                 var(--card);
  --color-card-foreground:      var(--card-foreground);
  --color-popover:              var(--popover);
  --color-popover-foreground:   var(--popover-foreground);
  --color-primary:              var(--primary);
  --color-primary-foreground:   var(--primary-foreground);
  --color-secondary:            var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted-foreground:     var(--muted-foreground);
  --color-accent-foreground:    var(--accent-foreground);
  --color-destructive:          var(--destructive);
  --color-border:               var(--border);
  --color-input:                var(--input);
  --color-ring:                 var(--ring);

  /* Radius */
  --radius-sm:   6px;
  --radius-md:   8px;
  --radius-lg:   16px;
  --radius-xl:   20px;
  --radius-2xl:  24px;
  --radius-full: 9999px;

  /* Shadows */
  --shadow-sm: 0 4px 16px rgba(20,20,20,0.04);
  --shadow-md: 0 12px 40px rgba(20,20,20,0.035);

  /* Motion */
  --duration-default: 200ms;
  --ease-default: cubic-bezier(.2,.8,.2,1);

  /* Safe area */
  --safe-top:    max(56px, env(safe-area-inset-top, 0px));
  --safe-bottom: max(34px, env(safe-area-inset-bottom, 0px));

  /* Shadcn sidebar stubs */
  --color-sidebar-ring:               var(--sidebar-ring);
  --color-sidebar-border:             var(--sidebar-border);
  --color-sidebar-accent-foreground:  var(--sidebar-accent-foreground);
  --color-sidebar-accent:             var(--sidebar-accent);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-primary:            var(--sidebar-primary);
  --color-sidebar-foreground:         var(--sidebar-foreground);
  --color-sidebar:                    var(--sidebar);
  --color-chart-5: var(--chart-5);
  --color-chart-4: var(--chart-4);
  --color-chart-3: var(--chart-3);
  --color-chart-2: var(--chart-2);
  --color-chart-1: var(--chart-1);
}

/* ── CSS custom props ────────────────────────────────────────────── */
:root {
  --background: #F9F9F8;
  --foreground: #111111;
  --card: #FFFFFF;
  --card-foreground: #111111;
  --popover: #FFFFFF;
  --popover-foreground: #111111;
  --primary: #111111;
  --primary-foreground: #F9F9F8;
  --secondary: #F1F2EE;
  --secondary-foreground: #111111;
  --muted: #F1F2EE;
  --muted-foreground: #777B75;
  --accent: #3B7AFF;
  --accent-foreground: #FFFFFF;
  --destructive: oklch(0.577 0.245 27.325);
  --border: #E7E7E2;
  --input: #E7E7E2;
  --ring: #3B7AFF;
  --radius: 0.5rem;
  --chart-1: #3B7AFF;
  --chart-2: #2F5D50;
  --chart-3: #A8B5A2;
  --chart-4: #777B75;
  --chart-5: #F4F1EA;
  --sidebar: #FFFFFF;
  --sidebar-foreground: #111111;
  --sidebar-primary: #111111;
  --sidebar-primary-foreground: #F9F9F8;
  --sidebar-accent: #3B7AFF;
  --sidebar-accent-foreground: #FFFFFF;
  --sidebar-border: #E7E7E2;
  --sidebar-ring: #3B7AFF;
}

/* ── Base ────────────────────────────────────────────────────────── */
html, body { height: 100%; margin: 0; padding: 0; }
html { background: #F9F9F8; }

body {
  font-family: var(--font-geist), "Geist", system-ui, sans-serif;
  color: #111111;
  background: #F9F9F8;
  touch-action: manipulation;
  overflow: hidden;
}

/* ── iOS zoom prevention ─────────────────────────────────────────── */
@media (max-width: 640px) {
  input, textarea, select { font-size: 16px !important; }
}

/* ── Tailwind base ───────────────────────────────────────────────── */
@layer base {
  * { @apply border-border outline-ring/50; }
  body { @apply bg-background text-foreground; }
}

/* ── Ritual check pop ───────────────────────────────────────────── */
@keyframes pop {
  from { transform: scale(0.35); opacity: 0; }
  to   { transform: scale(1);    opacity: 1; }
}
.pop-in   { animation: pop 0.7s cubic-bezier(.2,.8,.2,1) both; }
.pop-in-1 { animation: pop 0.7s cubic-bezier(.2,.8,.2,1) 0s    both; }
.pop-in-2 { animation: pop 0.7s cubic-bezier(.2,.8,.2,1) 0.25s both; }
.pop-in-3 { animation: pop 0.7s cubic-bezier(.2,.8,.2,1) 0.5s  both; }
.pop-in-4 { animation: pop 0.7s cubic-bezier(.2,.8,.2,1) 0.75s both; }

/* ── Gantt bar grow ──────────────────────────────────────────────── */
@keyframes ganttGrow {
  from { transform: scaleX(0); }
  to   { transform: scaleX(1); }
}

/* ── Log reveal ─────────────────────────────────────────────────── */
@keyframes logReveal {
  to { opacity: 1; transform: translateY(0); }
}

/* ── Blink (legacy compat) ───────────────────────────────────────── */
@keyframes blink { 50% { opacity: 0; } }
```

---

## src/app/page.tsx

```typescript
import { HomePage } from "@/components/home";

export default function Home() {
  return (
    <main style={{ height: "100%", overflow: "hidden" }}>
      <HomePage />
    </main>
  );
}
```

---

## src/app/error.tsx

```typescript
"use client";

import { ErrorFallbackPage } from "@/components/errors/error-fallback-page";

type ErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function Error({ error, reset }: ErrorProps) {
  return <ErrorFallbackPage error={error} reset={reset} />;
}
```

---

## src/app/not-found.tsx

```typescript
import { NotFoundPage } from "@/components/errors/not-found-page";

export default function NotFound() {
  return <NotFoundPage />;
}
```

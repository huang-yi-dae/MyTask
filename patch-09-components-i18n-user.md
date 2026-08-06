# patch-09-components-i18n-user.md

## src/components/i18n/i18n-provider.tsx

```typescript
"use client";

import { useEffect } from "react";
import { I18nextProvider } from "react-i18next";
import i18n, { applyStoredLocalePreference } from "@/i18n";

export function I18nProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    void applyStoredLocalePreference();
  }, []);

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}
```

---

## src/components/i18n/language-switcher.tsx

```typescript
"use client";

/** Reference locale control — restyle or fork for your app's header/settings UI. Keep changeLocale() wiring. */

import { useEffect, useState } from "react";
import { Languages } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  changeLocale,
  getLocalePreference,
  normalizeLocale,
  supportedLocales,
  type LocaleCode,
  type LocalePreference,
} from "@/i18n";

export function LanguageSwitcher() {
  const { t, i18n } = useTranslation();
  const [preference, setPreference] = useState<LocalePreference>("system");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      setMounted(true);
      setPreference(getLocalePreference());
    });
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const sync = () => setPreference(getLocalePreference());
    i18n.on("languageChanged", sync);
    window.addEventListener("eazo-locale-preference-changed", sync);
    window.addEventListener("storage", sync);
    return () => {
      i18n.off("languageChanged", sync);
      window.removeEventListener("eazo-locale-preference-changed", sync);
      window.removeEventListener("storage", sync);
    };
  }, [i18n, mounted]);

  if (!mounted) {
    return (
      <div
        className="flex h-8 w-[100px] items-center gap-1.5 rounded-full border border-border bg-background px-2 shadow-sm"
        aria-hidden
      />
    );
  }

  const activeLocale =
    normalizeLocale(i18n.resolvedLanguage || i18n.language) ?? "en-US";
  const resolvedLabel =
    supportedLocales.find((l) => l.code === activeLocale)?.nativeLabel ?? activeLocale;

  async function handleChange(value: string) {
    if (value === "system") {
      await changeLocale("system");
      return;
    }
    const locale = normalizeLocale(value);
    if (locale) await changeLocale(locale as LocaleCode);
  }

  return (
    <div className="flex items-center gap-1.5 rounded-full border border-border bg-background px-2 py-1 shadow-sm">
      <Languages className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
      <label htmlFor="app-locale" className="sr-only">
        {t("language.label")}
      </label>
      <select
        id="app-locale"
        value={preference}
        onChange={(e) => void handleChange(e.target.value)}
        className="max-w-[140px] cursor-pointer truncate bg-transparent text-xs font-medium text-foreground outline-none"
        title={
          preference === "system"
            ? t("language.followSystemWithLanguage", { language: resolvedLabel })
            : resolvedLabel
        }
      >
        <option value="system">{t("language.followSystem")}</option>
        <option value="en-US">{t("language.enUS")}</option>
        <option value="zh-CN">{t("language.zhCN")}</option>
      </select>
    </div>
  );
}
```

---

## src/components/i18n/locale-sync-effect.tsx

```typescript
"use client";

import { useEffect } from "react";
import i18n, {
  getLocalePreference,
  normalizeLocale,
  resolveLocalePreference,
  syncDocumentLanguage,
} from "@/i18n";

export function LocaleSyncEffect() {
  useEffect(() => {
    const syncSystemLocale = async () => {
      if (getLocalePreference() !== "system") return;

      const systemLocale = resolveLocalePreference("system");
      const active = normalizeLocale(i18n.resolvedLanguage || i18n.language);
      if (active === systemLocale) return;

      await i18n.changeLanguage(systemLocale);
      syncDocumentLanguage(i18n.language);
    };

    const handleLanguageChange = () => void syncSystemLocale();
    window.addEventListener("languagechange", handleLanguageChange);
    return () => window.removeEventListener("languagechange", handleLanguageChange);
  }, []);

  return null;
}
```

---

## src/components/i18n/locale-sync-effect.test.tsx

```typescript
/**
 * LocaleSyncEffect — unit tests
 *
 * These tests verify that the component correctly responds to the browser
 * `languagechange` event and re-syncs the i18n instance when the user's
 * system language changes and the app preference is set to "system".
 *
 * We mock the i18n module so that no real language files are loaded during tests.
 */

import { render, act } from "@testing-library/react";
import { LocaleSyncEffect } from "./locale-sync-effect";

// ── mocks ─────────────────────────────────────────────────────────────

const mockChangeLanguage = jest.fn().mockResolvedValue(undefined);
const mockSyncDocumentLanguage = jest.fn();

jest.mock("@/i18n", () => ({
  __esModule: true,
  default: {
    resolvedLanguage: "en-US",
    language: "en-US",
    changeLanguage: (...args: unknown[]) => mockChangeLanguage(...args),
  },
  getLocalePreference: jest.fn(() => "system"),
  normalizeLocale: jest.fn((l: string) => l),
  resolveLocalePreference: jest.fn(() => "zh-CN"),
  syncDocumentLanguage: (...args: unknown[]) => mockSyncDocumentLanguage(...args),
}));

// ── helpers ───────────────────────────────────────────────────────────

function fireLanguageChange() {
  act(() => {
    window.dispatchEvent(new Event("languagechange"));
  });
}

// ── tests ─────────────────────────────────────────────────────────────

describe("LocaleSyncEffect", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders nothing", () => {
    const { container } = render(<LocaleSyncEffect />);
    expect(container.firstChild).toBeNull();
  });

  it("calls changeLanguage when system locale differs from active locale", async () => {
    render(<LocaleSyncEffect />);
    await act(async () => { fireLanguageChange(); });
    expect(mockChangeLanguage).toHaveBeenCalledWith("zh-CN");
  });

  it("calls syncDocumentLanguage after changeLanguage", async () => {
    render(<LocaleSyncEffect />);
    await act(async () => { fireLanguageChange(); });
    expect(mockSyncDocumentLanguage).toHaveBeenCalled();
  });

  it("removes the event listener on unmount", () => {
    const removeSpy = jest.spyOn(window, "removeEventListener");
    const { unmount } = render(<LocaleSyncEffect />);
    unmount();
    expect(removeSpy).toHaveBeenCalledWith("languagechange", expect.any(Function));
  });
});
```

---

## src/components/user-profile/user-badge.tsx

```typescript
"use client";

import { useRef, useState, useEffect } from "react";
import Image from "next/image";
import { LogOut, UserRound, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { auth } from "@eazo/sdk";
import { useEazo } from "@eazo/sdk/react";
import type { User } from "@eazo/sdk";

export function UserBadge() {
  const { t } = useTranslation();
  const user = useEazo((s) => s.auth.user);
  const loading = useEazo((s) => s.auth.loading);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  if (loading) {
    return (
      <div className="flex h-9 items-center rounded-full border border-border bg-background px-3 shadow-sm">
        <div className="size-4 animate-spin rounded-full border-2 border-muted border-t-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return (
      <button
        onClick={() => {
          auth.login().catch(() => undefined);
        }}
        className="flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 text-sm font-medium shadow-sm transition-shadow hover:shadow-md"
      >
        <UserRound className="h-4 w-4 text-muted-foreground" />
        {t("common.signIn")}
      </button>
    );
  }

  return (
    <div ref={ref} className="relative">
      <BadgeTrigger user={user} onClick={() => setOpen((v) => !v)} />
      {open && (
        <DropdownPanel user={user} onClose={() => setOpen(false)} userIdLabel={t("common.userId")}>
          <button
            onClick={() => {
              auth.logout();
              setOpen(false);
            }}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <LogOut className="h-3.5 w-3.5" />
            {t("common.signOut")}
          </button>
        </DropdownPanel>
      )}
    </div>
  );
}

function BadgeTrigger({ user, onClick }: { user: User; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 rounded-full border border-border bg-background px-2.5 py-1.5 text-sm shadow-sm transition-shadow hover:shadow-md"
    >
      <Avatar user={user} size={24} />
      <span className="max-w-[120px] truncate font-medium text-foreground">
        {user.name ?? user.email ?? user.id}
      </span>
    </button>
  );
}

function DropdownPanel({
  user,
  onClose,
  userIdLabel,
  children,
}: {
  user: User;
  onClose: () => void;
  userIdLabel: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="absolute right-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-xl border border-border bg-background shadow-lg">
      <div className="flex items-start justify-between gap-3 px-4 py-4">
        <div className="flex items-center gap-3">
          <Avatar user={user} size={40} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{user.name ?? "—"}</p>
            {user.email && (
              <p className="truncate text-xs text-muted-foreground">{user.email}</p>
            )}
          </div>
        </div>
        <button
          onClick={onClose}
          className="mt-0.5 shrink-0 rounded-md p-0.5 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="border-t border-border px-4 py-3 text-xs text-muted-foreground space-y-1.5">
        <Row label={userIdLabel} value={user.id} mono />
      </div>

      {children && <div className="border-t border-border px-4 py-2">{children}</div>}
    </div>
  );
}

function Avatar({ user, size }: { user: User; size: number }) {
  if (user.avatarUrl) {
    const avatarSrc = user.avatarUrl.startsWith("//")
      ? `https:${user.avatarUrl}`
      : user.avatarUrl;
    return (
      <Image
        src={avatarSrc}
        alt={user.name ?? "avatar"}
        width={size}
        height={size}
        className="rounded-full object-cover ring-2 ring-border"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {(user.name ?? user.email ?? "?")[0].toUpperCase()}
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="shrink-0 text-muted-foreground/70">{label}</span>
      <span className={`truncate text-right text-foreground ${mono ? "font-mono" : ""}`}>
        {value}
      </span>
    </div>
  );
}
```

---

## src/components/user-profile/user-sync-effect.tsx

```typescript
"use client";

import { useEffect, useRef } from "react";
import { auth } from "@eazo/sdk";
import { useEazo } from "@eazo/sdk/react";

/**
 * Mobile-only: hits /api/user/profile once after login to upsert the user
 * into the local DB. Web doesn't need this — the SDK already calls the same
 * endpoint during web bootstrap; mobile bootstraps from the bridge `hello`
 * instead and never auto-fetches profile, so the upsert has to be triggered
 * manually here.
 */
export function UserSyncEffect() {
  const authenticated = useEazo((s) => s.auth.authenticated);
  const platform = useEazo((s) => s.device.platform);
  const syncedUserId = useRef<string | null>(null);

  useEffect(() => {
    if (!authenticated || platform !== "mobile") return;

    const userId = auth.user?.id ?? null;
    if (!userId || syncedUserId.current === userId) return;

    syncedUserId.current = userId;

      (async () => {
      try {
        const sessionHeader = await auth.getSessionHeader();
        if (!sessionHeader) return;

        await fetch("/api/user/profile", {
          headers: { "x-eazo-session": sessionHeader },
        });
      } catch (err) {
        console.error("[UserSyncEffect] profile fetch failed", err);
      }
    })();
  }, [authenticated, platform]);

  return null;
}
```

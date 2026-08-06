# patch-10-i18n-data.md

## src/i18n/index.ts

```typescript
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import enUS from "./locales/en-US.json";
import zhCN from "./locales/zh-CN.json";
import { localeCodes, normalizeLocale, type LocaleCode } from "@/lib/i18n/locale";
import {
  LOCALE_STORAGE_KEY,
  detectSystemLocale,
  getLocalePreference,
  persistLocalePreference,
  resolveLocalePreference,
  type LocalePreference,
} from "@/lib/i18n/preference";

export type { LocaleCode, LocalePreference };
export {
  LOCALE_STORAGE_KEY,
  normalizeLocale,
  localeCodes,
  detectSystemLocale,
  getLocalePreference,
  resolveLocalePreference,
};

const resources = {
  "en-US": { translation: enUS },
  "zh-CN": { translation: zhCN },
} as const;

// Fixed default for SSR — user preference is applied client-side after mount.
void i18n.use(initReactI18next).init({
  resources,
  lng: "en-US",
  fallbackLng: "en-US",
  supportedLngs: [...localeCodes],
  interpolation: { escapeValue: false },
});

export function syncDocumentLanguage(language: string) {
  const locale = normalizeLocale(language) ?? "en-US";
  if (typeof document !== "undefined") {
    document.documentElement.lang = locale;
  }
}

export default i18n;

export const supportedLocales = [
  { code: "en-US" as const, label: "English", nativeLabel: "English" },
  { code: "zh-CN" as const, label: "Chinese", nativeLabel: "中文" },
];

export const changeLocale = async (preference: LocalePreference) => {
  persistLocalePreference(preference);
  await i18n.changeLanguage(resolveLocalePreference(preference));
  syncDocumentLanguage(i18n.language);
  window.dispatchEvent(
    new CustomEvent("eazo-locale-preference-changed", { detail: preference }),
  );
};

export function getResolvedLocale(): LocaleCode {
  return normalizeLocale(i18n.resolvedLanguage || i18n.language) ?? "en-US";
}

/** Apply stored preference after hydration (call once from I18nProvider). */
export async function applyStoredLocalePreference(): Promise<void> {
  const preference = getLocalePreference();
  await i18n.changeLanguage(resolveLocalePreference(preference));
  syncDocumentLanguage(i18n.language);
}
```

---

## src/i18n/locales/en-US.json

```json
{
  "common": {
    "signIn": "Sign in",
    "signOut": "Sign out",
    "loading": "Loading…",
    "on": "On",
    "off": "Off",
    "close": "Close",
    "save": "Save",
    "cancel": "Cancel",
    "edit": "Edit",
    "delete": "Delete",
    "userId": "User ID"
  },
  "language": {
    "label": "Language",
    "triggerLabel": "Language: {{language}}",
    "followSystem": "System",
    "followSystemWithLanguage": "System ({{language}})",
    "enUS": "English",
    "zhCN": "中文"
  },
  "errors": {
    "notFound": {
      "code": "404",
      "title": "Page not found",
      "description": "The page you're looking for doesn't exist or may have been moved.",
      "backHome": "Back to home"
    },
    "generic": {
      "title": "Something went wrong",
      "description": "An unexpected error occurred. You can try again or return to the home page.",
      "tryAgain": "Try again",
      "backHome": "Back to home"
    }
  },
  "starter": {
    "badge": "Eazo App Starter",
    "title": "Build your next app with Eazo",
    "subtitle": "Demo artifacts are removed. You now have a clean foundation with auth, data access, and platform integrations ready for your product.",
    "steps": {
      "readDocs": {
        "title": "Read the docs",
        "desc": "Open AGENTS.md and README.md to understand the template architecture.",
        "code": "AGENTS.md + README.md"
      },
      "replacePage": {
        "title": "Replace this page",
        "desc": "Move your product UI into src/components and keep page.tsx thin.",
        "code": "src/app/page.tsx"
      },
      "firstFeature": {
        "title": "Build your first feature",
        "desc": "Add API routes under src/app/api and call them from typed helpers.",
        "code": "src/app/api/*"
      },
      "translations": {
        "title": "Add translations",
        "desc": "Edit en-US / zh-CN strings in src/i18n/locales. LanguageSwitcher and I18nProvider in layout.tsx are already wired.",
        "code": "src/i18n/locales/"
      }
    },
    "nextCommand": {
      "title": "Next command",
      "desc": "Start developing and iterate in real time.",
      "command": "bun dev"
    }
  }
}
```

---

## src/i18n/locales/zh-CN.json

```json
{
  "common": {
    "signIn": "登录",
    "signOut": "退出登录",
    "loading": "加载中…",
    "on": "开",
    "off": "关",
    "close": "关闭",
    "save": "保存",
    "cancel": "取消",
    "edit": "编辑",
    "delete": "删除",
    "userId": "用户 ID"
  },
  "language": {
    "label": "语言",
    "triggerLabel": "语言：{{language}}",
    "followSystem": "跟随系统",
    "followSystemWithLanguage": "跟随系统（{{language}}）",
    "enUS": "English",
    "zhCN": "中文"
  },
  "errors": {
    "notFound": {
      "code": "404",
      "title": "页面未找到",
      "description": "你访问的页面不存在，或已被移动。",
      "backHome": "返回首页"
    },
    "generic": {
      "title": "出了点问题",
      "description": "发生了意外错误。你可以重试，或返回首页继续。",
      "tryAgain": "重试",
      "backHome": "返回首页"
    }
  },
  "starter": {
    "badge": "Eazo 应用模板",
    "title": "用 Eazo 构建你的下一个应用",
    "subtitle": "演示代码已移除。你现在拥有干净的基础：认证、数据访问与平台能力已就绪，可直接开发产品功能。",
    "steps": {
      "readDocs": {
        "title": "阅读文档",
        "desc": "打开 AGENTS.md 与 README.md，了解模板架构与约定。",
        "code": "AGENTS.md + README.md"
      },
      "replacePage": {
        "title": "替换本页",
        "desc": "将产品 UI 放到 src/components 下，并保持 page.tsx 为薄入口。",
        "code": "src/app/page.tsx"
      },
      "firstFeature": {
        "title": "开发第一个功能",
        "desc": "在 src/app/api 添加接口，并通过 src/lib/api 中的类型化 helper 调用。",
        "code": "src/app/api/*"
      },
      "translations": {
        "title": "补充翻译",
        "desc": "在 src/i18n/locales 编辑中英文文案；layout 已接入 LanguageSwitcher 与 I18nProvider。",
        "code": "src/i18n/locales/"
      }
    },
    "nextCommand": {
      "title": "下一步命令",
      "desc": "启动开发服务器，实时迭代你的产品。",
      "command": "bun dev"
    }
  }
}
```

---

## src/lib/db/migrate.ts

```typescript
import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import path from "path";
import postgres from "postgres";

config({ path: ".env" });

const runMigrate = async () => {
  const client = postgres(
    process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/myapp",
    { max: 1 }
  );
  const db = drizzle(client);

  console.log("⏳ Running migrations...");

  const start = Date.now();
  const migrationsFolder = path.join(process.cwd(), "src/lib/db/migrations");
  await migrate(db, { migrationsFolder });
  const end = Date.now();

  console.log("✅ Migrations completed in", end - start, "ms");
  await client.end();
  process.exit(0);
};

runMigrate().catch((err) => {
  console.error("❌ Migration failed");
  console.error(err);
  process.exit(1);
});
```

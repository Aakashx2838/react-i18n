import i18n from "i18next";
import { initReactI18next } from "react-i18next";

const localeModules = import.meta.glob<{ default: Record<string, string> }>(
  "./locales/*/*.json",
  { eager: true },
);

const resources: Record<string, { translation: Record<string, string> }> = {};

for (const [filePath, mod] of Object.entries(localeModules)) {
  if (filePath.includes("/migrations/")) continue;
  const lang = filePath.match(/\/locales\/([^/]+)\//)?.[1];
  if (lang) {
    resources[lang] = { translation: mod.default };
  }
}

i18n.use(initReactI18next).init({
  resources,
  lng: "en",
  interpolation: {
    escapeValue: false,
  },
  pluralSeparator: "_",
});

if (import.meta.hot) {
  import.meta.hot.accept();
}

export default i18n;

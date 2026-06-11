"use client";

import { useEffect } from "react";
import { getLocalePreference, normalizeLocale } from "@/i18n";
import i18n from "@/i18n";

/**
 * When preference is "system", align app locale with browser/navigator language.
 */
export function LocaleSyncEffect() {
  useEffect(() => {
    if (getLocalePreference() !== "system") return;

    const navLanguage = typeof navigator !== "undefined" ? navigator.language : "";
    const systemLocale = normalizeLocale(navLanguage);
    if (!systemLocale) return;

    const active = normalizeLocale(i18n.resolvedLanguage || i18n.language);
    if (active !== systemLocale) {
      void i18n.changeLanguage(systemLocale);
    }
  }, []);

  return null;
}

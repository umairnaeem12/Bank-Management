'use client';

import { useCallback, useEffect } from 'react';
import type { ThemeMode } from '@/types';
import { useBankStore } from '@/store/use-bank-store';

/**
 * Applies the selected theme to the document root.
 *
 * Tailwind v4 is configured (in globals.css) to key dark styles off a
 * `.dark` class rather than the media query, so that an explicit user choice
 * can override the OS preference.
 */
export function useTheme() {
  const theme = useBankStore((s) => s.settings.theme);
  const updateSettings = useBankStore((s) => s.updateSettings);
  const hydrated = useBankStore((s) => s.hydrated);

  useEffect(() => {
    // Before hydration the inline script in <head> owns the class; touching it
    // here would cause a flash of the wrong theme.
    if (!hydrated) return;
    applyTheme(theme);
  }, [theme, hydrated]);

  // Track OS changes only while following the system preference.
  useEffect(() => {
    if (!hydrated || theme !== 'system') return;

    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyTheme('system');

    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [theme, hydrated]);

  const setTheme = useCallback(
    (next: ThemeMode) => updateSettings({ theme: next }),
    [updateSettings],
  );

  /** Cycles light → dark → light, resolving `system` to its current value first. */
  const toggleTheme = useCallback(() => {
    const resolved = theme === 'system' ? resolveSystemTheme() : theme;
    setTheme(resolved === 'dark' ? 'light' : 'dark');
  }, [theme, setTheme]);

  return { theme, setTheme, toggleTheme, resolved: resolveTheme(theme) };
}

function resolveSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function resolveTheme(theme: ThemeMode): 'light' | 'dark' {
  return theme === 'system' ? resolveSystemTheme() : theme;
}

function applyTheme(theme: ThemeMode): void {
  const isDark = resolveTheme(theme) === 'dark';
  document.documentElement.classList.toggle('dark', isDark);
  // Keeps native form controls and scrollbars in step with the theme.
  document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
}

/**
 * Runs before first paint to set the theme class from LocalStorage, avoiding
 * a white flash on load for dark-mode users. Injected as an inline script in
 * the root layout.
 */
export const THEME_INIT_SCRIPT = `
(function() {
  try {
    var raw = localStorage.getItem('bank:settings');
    var theme = raw ? (JSON.parse(raw).theme || 'system') : 'system';
    var dark = theme === 'dark' ||
      (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (dark) document.documentElement.classList.add('dark');
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  } catch (e) {}
})();
`.trim();

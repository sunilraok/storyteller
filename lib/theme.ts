/** Theme preference: "system" follows the device; the others force a palette. */
export type ThemePref = "system" | "light" | "dark";

export const THEME_STORAGE_KEY = "theme";
export const THEME_ORDER: ThemePref[] = ["system", "light", "dark"];

export const nextTheme = (t: ThemePref): ThemePref => THEME_ORDER[(THEME_ORDER.indexOf(t) + 1) % THEME_ORDER.length];

export const parseTheme = (v: string | null | undefined): ThemePref => (v === "light" || v === "dark" ? v : "system");

/**
 * Runs in <head> before first paint: applies a saved light/dark choice so the page
 * never flashes the wrong palette. With no saved choice, CSS follows the device.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`;

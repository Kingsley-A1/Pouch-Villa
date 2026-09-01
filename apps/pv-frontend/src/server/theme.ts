import { cookies } from "next/headers";

/**
 * The visitor's theme choice, stored in a cookie and applied server-side.
 *
 * Q7: _"Both dark and light theme should be supported out-of-the-box."_
 *
 * A cookie rather than `localStorage` because the choice has to be known
 * **before the first paint**. The usual localStorage approach needs a blocking
 * inline `<script>` in the head to avoid a flash of the wrong theme, and
 * AGENTS.md §5 requires a strict CSP with no `unsafe-inline` — so that approach
 * would either flash or need a nonce for every request. Read here, the attribute
 * is already on `<html>` in the HTML the server sends.
 *
 * Absent means "follow the system", which is the default and stays the default:
 * no cookie is set until someone actually chooses.
 */

export const THEME_COOKIE = "pv_theme";

export type ThemeChoice = "light" | "dark";
/** What the toggle cycles through. `system` is the absence of a stored choice. */
export type ThemePreference = ThemeChoice | "system";

export async function readThemePreference(): Promise<ThemePreference> {
  const value = (await cookies()).get(THEME_COOKIE)?.value;
  return value === "light" || value === "dark" ? value : "system";
}

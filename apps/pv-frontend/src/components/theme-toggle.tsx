import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { Desktop, Moon, Sun } from "@phosphor-icons/react/dist/ssr";
import { THEME_COOKIE, readThemePreference, type ThemePreference } from "@/server/theme";

/**
 * Light / dark / follow-the-system, as three real radio-style buttons rather
 * than a two-state switch.
 *
 * A binary toggle cannot express "follow my system", which is the setting most
 * people actually want and the one that costs nothing to honour. Making it an
 * explicit third option also means the control always shows the truth about what
 * is in effect.
 *
 * A Server Component with a Server Action per option: it works with JavaScript
 * unavailable, ships no client bundle, and needs no inline script — so it stays
 * compatible with the strict CSP §5 requires.
 */
async function chooseTheme(formData: FormData): Promise<void> {
  "use server";

  const choice = formData.get("theme");
  const store = await cookies();

  if (choice === "light" || choice === "dark") {
    store.set(THEME_COOKIE, choice, {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  } else {
    // "system" is the absence of a choice, so it deletes rather than storing a
    // third value the CSS would then have to know about.
    store.delete(THEME_COOKIE);
  }

  revalidatePath("/", "layout");
}

const OPTIONS = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
  { value: "system", label: "System", Icon: Desktop },
] as const;

export async function ThemeToggle() {
  const current: ThemePreference = await readThemePreference();

  return (
    <form action={chooseTheme}>
      <fieldset className="flex items-center gap-0.5 rounded-xl border border-(--pv-line) p-0.5">
        <legend className="sr-only">Colour theme</legend>
        {OPTIONS.map(({ value, label, Icon }) => {
          const active = current === value;
          return (
            <button
              key={value}
              type="submit"
              name="theme"
              value={value}
              // The pressed state is what a screen reader reads; the colour is
              // only reinforcement, never the sole signal (WCAG 2.2 AA).
              aria-pressed={active}
              title={label}
              className={`grid h-9 w-9 place-items-center rounded-[0.6rem] transition-colors ${
                active ? "bg-(--pv-red) text-(--pv-on-brand)" : "hover:bg-(--pv-wash)"
              }`}
            >
              <Icon size={16} weight={active ? "fill" : "regular"} aria-hidden="true" />
              <span className="sr-only">{label}</span>
            </button>
          );
        })}
      </fieldset>
    </form>
  );
}

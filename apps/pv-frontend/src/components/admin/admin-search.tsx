"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { MagnifyingGlass, X } from "@phosphor-icons/react";
import type { AdminSearchResult } from "@pv/backend/services/admin-search";
import type { NavSection } from "@/app/admin/(protected)/nav-sections";
import { adminSearchEntityLabel, adminSearchResultHref } from "./admin-search-routes";

type SearchOption = {
  key: string;
  title: string;
  context: string | null;
  href: string;
  group: string;
};

type SearchResponse = { ok: true; data: { results: AdminSearchResult[] } };

export function AdminSearch({ sections }: { sections: NavSection[] }) {
  const router = useRouter();
  const listboxId = useId();
  const desktopInput = useRef<HTMLInputElement>(null);
  const mobileInput = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [remoteResults, setRemoteResults] = useState<AdminSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onShortcut = (event: KeyboardEvent) => {
      const commandShortcut = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k";
      if (!commandShortcut && event.key !== "/") return;
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }
      event.preventDefault();
      if (window.matchMedia("(min-width: 768px)").matches) desktopInput.current?.focus();
      else setMobileOpen(true);
    };
    window.addEventListener("keydown", onShortcut);
    return () => window.removeEventListener("keydown", onShortcut);
  }, []);

  useEffect(() => {
    if (mobileOpen) mobileInput.current?.focus();
  }, [mobileOpen]);

  useEffect(() => {
    const normalised = query.trim();
    setActiveIndex(0);
    setFailed(false);
    if (normalised.length < 2) {
      setRemoteResults([]);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/v1/admin/search?q=${encodeURIComponent(normalised)}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        if (!response.ok) throw new Error("Search unavailable");
        const payload = (await response.json()) as SearchResponse;
        setRemoteResults(payload.data.results);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setRemoteResults([]);
        setFailed(true);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const options = useMemo<SearchOption[]>(() => {
    const normalised = query.trim().toLowerCase();
    if (normalised.length < 2) return [];

    const navigation = sections
      .filter((section) => section.label.toLowerCase().includes(normalised))
      .map((section) => ({
        key: `navigation:${section.href}`,
        title: section.label,
        context: "Admin section",
        href: section.href,
        group: "Navigation",
      }));
    const records = remoteResults.flatMap((result): SearchOption[] => {
      const href = adminSearchResultHref(result.entity, result.entityId);
      if (
        href === null ||
        !sections.some((section) => section.permission === result.requiredPermission)
      ) {
        return [];
      }
      return [
        {
          key: `${result.entity}:${result.entityId}`,
          title: result.title,
          context: result.context,
          href,
          group: adminSearchEntityLabel(result.entity),
        },
      ];
    });
    return [...navigation, ...records];
  }, [query, remoteResults, sections]);

  function select(option: SearchOption) {
    setQuery("");
    setMobileOpen(false);
    router.push(option.href);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setQuery("");
      setMobileOpen(false);
      return;
    }
    if (options.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => (current + 1) % options.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => (current - 1 + options.length) % options.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const option = options[activeIndex];
      if (option !== undefined) select(option);
    }
  }

  const results =
    query.trim().length >= 2 ? (
      <div
        id={listboxId}
        role="listbox"
        aria-label="Admin search results"
        className="max-h-[min(26rem,60dvh)] overflow-y-auto rounded-2xl border border-(--pv-line) bg-(--pv-surface) p-2 shadow-xl"
      >
        {loading ? <p className="px-3 py-4 text-sm text-(--pv-muted)">Searching…</p> : null}
        {failed ? (
          <p className="px-3 py-4 text-sm text-(--pv-danger)" role="alert">
            Search is unavailable. Try again.
          </p>
        ) : null}
        {!loading && !failed && options.length === 0 ? (
          <p className="px-3 py-4 text-sm text-(--pv-muted)">No matching admin records.</p>
        ) : null}
        {Array.from(new Set(options.map((option) => option.group))).map((group) => (
          <div key={group} className="mb-1 last:mb-0">
            <p className="px-3 pt-2 pb-1 text-[0.6875rem] font-bold tracking-wide text-(--pv-muted) uppercase">
              {group}
            </p>
            {options.map((option, index) =>
              option.group === group ? (
                <button
                  key={option.key}
                  type="button"
                  role="option"
                  aria-selected={index === activeIndex}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => select(option)}
                  className={`flex min-h-11 w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left ${
                    index === activeIndex ? "bg-(--pv-wash)" : "hover:bg-(--pv-wash)"
                  }`}
                >
                  <span className="min-w-0 truncate text-sm font-semibold">{option.title}</span>
                  {option.context ? (
                    <span className="max-w-[45%] truncate text-xs text-(--pv-muted)">
                      {option.context}
                    </span>
                  ) : null}
                </button>
              ) : null,
            )}
          </div>
        ))}
      </div>
    ) : null;

  const inputProps = {
    value: query,
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => setQuery(event.target.value),
    onKeyDown,
    role: "combobox",
    "aria-label": "Search the admin",
    "aria-controls": listboxId,
    "aria-expanded": options.length > 0,
    "aria-autocomplete": "list" as const,
    placeholder: "Search admin…",
  };

  return (
    <div className="min-w-0 flex-1 md:max-w-xl">
      <div className="relative hidden md:block">
        <MagnifyingGlass
          size={18}
          className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-(--pv-muted)"
          aria-hidden
        />
        <input
          {...inputProps}
          ref={desktopInput}
          className="h-11 w-full rounded-xl border border-(--pv-line) bg-(--pv-wash) pr-14 pl-10 text-sm outline-none focus:border-(--pv-red) focus:ring-2 focus:ring-[color-mix(in_srgb,var(--pv-red)_18%,transparent)]"
        />
        <kbd className="absolute top-1/2 right-3 -translate-y-1/2 text-xs text-(--pv-muted)">
          ⌘K
        </kbd>
        {results ? (
          <div className="absolute top-[calc(100%+0.5rem)] right-0 left-0">{results}</div>
        ) : null}
      </div>

      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="grid h-11 w-11 place-items-center rounded-xl hover:bg-(--pv-wash) md:hidden"
        aria-label="Search the admin"
      >
        <MagnifyingGlass size={22} aria-hidden />
      </button>

      {mobileOpen
        ? createPortal(
            <div className="fixed inset-0 z-70 bg-(--pv-surface) p-4 pt-[max(1rem,env(safe-area-inset-top))] md:hidden">
              <div className="mx-auto max-w-xl">
                <div className="flex items-center gap-2">
                  <div className="relative min-w-0 flex-1">
                    <MagnifyingGlass
                      size={18}
                      className="absolute top-1/2 left-3 -translate-y-1/2 text-(--pv-muted)"
                      aria-hidden
                    />
                    <input
                      {...inputProps}
                      ref={mobileInput}
                      className="h-12 w-full rounded-xl border border-(--pv-line) bg-(--pv-wash) pr-3 pl-10 text-base outline-none focus:border-(--pv-red)"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setMobileOpen(false)}
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-xl hover:bg-(--pv-wash)"
                    aria-label="Close search"
                  >
                    <X size={22} aria-hidden />
                  </button>
                </div>
                <div className="mt-3">{results}</div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

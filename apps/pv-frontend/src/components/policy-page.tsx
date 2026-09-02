import { Fragment, type ReactNode } from "react";
import Link from "next/link";
import { AwaitingConfirmation } from "@/components/awaiting-confirmation";
import { Breadcrumbs } from "@/components/breadcrumbs";

/**
 * The four supporting pages from scope §4, rendered from the settings store.
 *
 * Nothing here is drafted in source. §4 puts "policy or legal wording" on the
 * forbidden list, and it belongs there for a reason beyond tidiness: policy that
 * lives in a component can only be corrected by a deployment, which is not a
 * thing a shop owner can do on a Sunday when they spot a mistake in their own
 * returns terms.
 *
 * Where a policy has not been supplied the page says so plainly rather than
 * inventing one. The pages this replaced carried inherited prototype copy that
 * told customers "do not submit real personal information" while checkout was
 * quietly taking their address, phone and bank transfer receipts — the exact
 * failure §0 rule 2 describes, live on a real storefront.
 */
export function PolicyPage({
  title,
  content,
  what,
  intro,
}: {
  title: string;
  /** The stored wording, or null where the client has not supplied it. */
  content: string | null;
  /** Named in the awaiting-confirmation notice, e.g. "privacy policy". */
  what: string;
  intro?: string;
}) {
  return (
    <>
      <Breadcrumbs trail={[{ label: title }]} />
      <article className="section-space">
        <div className="container-shell max-w-3xl">
          <h1 className="section-title">{title}</h1>
          {intro ? <p className="mt-3 text-(--pv-muted)">{intro}</p> : null}

          {content === null ? (
            <div className="mt-8">
              <AwaitingConfirmation what={what} />
            </div>
          ) : (
            <div className="mt-8">
              <PolicyProse text={content} />
            </div>
          )}
        </div>
      </article>
    </>
  );
}

/** `|---|:--:|` and friends: the row that only describes column alignment. */
const SEPARATOR_ROW = /^\|[\s|:-]+\|$/;
const TRIM_PIPES = /^\||\|$/g;

/**
 * Renders the stored text as prose.
 *
 * A deliberately small subset of Markdown, rendered into React elements.
 *
 * This is staff-entered text going onto a public page, so it never becomes an
 * HTML string — there is no `dangerouslySetInnerHTML` here and there must never
 * be one. Every branch below produces React nodes, which React escapes, so the
 * worst a hostile policy edit can achieve is ugly text.
 *
 * Supported: blank-line paragraphs, `##`/`###` headings, `- ` bullets, pipe
 * tables, and inline `**bold**` / `_italic_` / `[text](/path)`. That covers
 * what the supplied documents actually use. Anything richer belongs in a real
 * editor, not here.
 */
function PolicyProse({ text }: { text: string }) {
  const blocks = text
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter((block) => block !== "");

  return (
    <div className="grid gap-5 leading-7 text-(--pv-muted)">
      {blocks.map((block, index) => {
        const key = `${index}-${block.slice(0, 24)}`;

        if (block.startsWith("## ")) {
          return (
            <h2 key={key} className="text-xl font-bold text-(--pv-ink)">
              {block.slice(3).trim()}
            </h2>
          );
        }

        if (block.startsWith("### ")) {
          return (
            <h3 key={key} className="text-lg font-bold text-(--pv-ink)">
              {block.slice(4).trim()}
            </h3>
          );
        }

        const lines = block.split("\n");

        // A pipe table. The separator row is layout, not content.
        if (lines.length >= 2 && lines.every((line) => line.trim().startsWith("|"))) {
          const rows = lines
            .filter((line) => !SEPARATOR_ROW.test(line.trim()))
            .map((line) =>
              line
                .trim()
                .replace(TRIM_PIPES, "")
                .split("|")
                .map((cell) => cell.trim()),
            );
          const [head, ...body] = rows;
          if (head !== undefined) {
            return (
              // Wide tables scroll inside their own container, so the page
              // itself never scrolls sideways (§2).
              <div key={key} className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr>
                      {head.map((cell, column) => (
                        <th
                          key={`${key}-h-${column}`}
                          className="border-b border-(--pv-line) py-2 pr-4 font-bold text-(--pv-ink)"
                        >
                          {inline(cell)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {body.map((row, rowIndex) => (
                      <tr key={`${key}-r-${rowIndex}`}>
                        {row.map((cell, column) => (
                          <td
                            key={`${key}-r-${rowIndex}-${column}`}
                            className="border-b border-(--pv-line) py-2 pr-4 align-top"
                          >
                            {inline(cell)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          }
        }

        if (lines.every((line) => line.trim().startsWith("- "))) {
          return (
            <ul key={key} className="grid list-disc gap-2 pl-5">
              {lines.map((line, item) => (
                <li key={`${key}-${item}`}>{inline(line.trim().slice(2))}</li>
              ))}
            </ul>
          );
        }

        return <p key={key}>{inline(block)}</p>;
      })}
    </div>
  );
}

/** `[label](href)`, captured so the label and href are pulled out separately. */
const LINK = /\[([^\]]+)\]\(([^)]+)\)/;

/**
 * True only for a same-site path: a leading `/` and nothing that could resolve
 * as a different origin.
 *
 * A policy page is staff-entered text with no further review, so the href
 * cannot be trusted the way the rest of the wording can be. `//host/path` is a
 * protocol-relative URL — a browser follows it off-site — and `/\to` is a
 * legacy backslash trick some browsers still normalise into one. Both are
 * rejected here rather than only the obvious `javascript:` and `http://` cases,
 * so this is an allowlist of "looks like our own path", not a blocklist of
 * known attacks.
 */
function isInternalPath(href: string): boolean {
  return href.startsWith("/") && !href.startsWith("//") && !/^\/\\/.test(href);
}

/**
 * Inline `**bold**`, `_italic_`, `` `code` `` and `[text](/path)`, as React
 * nodes.
 *
 * Split on the markers and alternate, rather than replacing into a string —
 * that keeps every segment a text node React will escape. A link whose target
 * is not an internal path renders as plain text instead: a stray `(http://…)`
 * in a policy edit should look untidy, not become a working link out of the
 * site.
 */
function inline(text: string): ReactNode {
  const pattern = /(\*\*[^*]+\*\*|_[^_]+_|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
  const parts = text.split(pattern).filter((part) => part !== "");

  return parts.map((part, index) => {
    const key = `${index}-${part.slice(0, 12)}`;
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={key} className="font-bold text-(--pv-ink)">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("_") && part.endsWith("_") && part.length > 2) {
      return <em key={key}>{part.slice(1, -1)}</em>;
    }
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      return (
        <code key={key} className="rounded bg-(--pv-wash) px-1 py-0.5 text-[0.9em]">
          {part.slice(1, -1)}
        </code>
      );
    }
    const link = LINK.exec(part);
    if (link !== null) {
      const [, label, href] = link;
      if (label !== undefined && href !== undefined && isInternalPath(href)) {
        return (
          <Link key={key} href={href} className="font-semibold text-(--pv-red) underline">
            {label}
          </Link>
        );
      }
      return <Fragment key={key}>{part}</Fragment>;
    }
    return <Fragment key={key}>{part}</Fragment>;
  });
}

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

/**
 * Renders the stored text as prose.
 *
 * Deliberately not a Markdown renderer: this is staff-entered text going onto a
 * public page, so rendering it as markup would be a stored-XSS surface for the
 * sake of formatting nobody asked for. A blank line starts a paragraph, a line
 * beginning `## ` is a heading, and a line beginning `- ` is a list item. React
 * escapes every one of them.
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
        if (lines.every((line) => line.trim().startsWith("- "))) {
          return (
            <ul key={key} className="grid list-disc gap-2 pl-5">
              {lines.map((line, item) => (
                <li key={`${key}-${item}`}>{line.trim().slice(2)}</li>
              ))}
            </ul>
          );
        }

        return <p key={key}>{block}</p>;
      })}
    </div>
  );
}

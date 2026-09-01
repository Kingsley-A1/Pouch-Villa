type DetailRow = { label: string; value: string };
type ItemRow = { name: string; meta?: string; value: string };

export type EmailBlock =
  | { type: "paragraph"; text: string }
  | { type: "code"; label: string; value: string; hint?: string }
  | { type: "details"; rows: readonly DetailRow[] }
  | { type: "items"; rows: readonly ItemRow[] }
  | { type: "total"; label: string; value: string };

export type TransactionalEmailInput = {
  brandName: string;
  title: string;
  preheader: string;
  greeting?: string;
  blocks: readonly EmailBlock[];
  footer?: string;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderBlock(block: EmailBlock): { html: string; text: string } {
  switch (block.type) {
    case "paragraph":
      return {
        html: `<p style="margin:0 0 18px;color:#3f3a37;font-size:15px;line-height:24px">${escapeHtml(block.text)}</p>`,
        text: block.text,
      };
    case "code": {
      const hintHtml = block.hint
        ? `<p style="margin:10px 0 0;color:#756e69;font-size:13px;line-height:20px">${escapeHtml(block.hint)}</p>`
        : "";
      const hintText = block.hint ? `\n${block.hint}` : "";
      return {
        html: `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 18px;border-collapse:separate;background:#f7f3f1;border:1px solid #e3dcd7;border-radius:12px"><tr><td style="padding:18px;text-align:center"><p style="margin:0 0 8px;color:#756e69;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase">${escapeHtml(block.label)}</p><p style="margin:0;color:#171717;font-size:28px;font-weight:800;letter-spacing:.16em;line-height:34px">${escapeHtml(block.value)}</p>${hintHtml}</td></tr></table>`,
        text: `${block.label}\n${block.value}${hintText}`,
      };
    }
    case "details": {
      const rows = block.rows
        .map(
          (row) =>
            `<tr><td style="padding:7px 12px 7px 0;color:#756e69;font-size:13px;line-height:20px">${escapeHtml(row.label)}</td><td style="padding:7px 0;color:#171717;font-size:13px;font-weight:700;line-height:20px;text-align:right">${escapeHtml(row.value)}</td></tr>`,
        )
        .join("");
      return {
        html: `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 18px;border-collapse:collapse">${rows}</table>`,
        text: block.rows.map((row) => `${row.label}: ${row.value}`).join("\n"),
      };
    }
    case "items": {
      const rows = block.rows
        .map((row) => {
          const meta = row.meta
            ? `<span style="display:block;margin-top:3px;color:#756e69;font-size:12px;line-height:18px">${escapeHtml(row.meta)}</span>`
            : "";
          return `<tr><td style="padding:10px 12px 10px 0;border-bottom:1px solid #eee8e4;color:#171717;font-size:14px;font-weight:700;line-height:21px">${escapeHtml(row.name)}${meta}</td><td style="padding:10px 0;border-bottom:1px solid #eee8e4;color:#171717;font-size:14px;font-weight:700;line-height:21px;text-align:right;white-space:nowrap">${escapeHtml(row.value)}</td></tr>`;
        })
        .join("");
      return {
        html: `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 18px;border-collapse:collapse">${rows}</table>`,
        text: block.rows
          .map((row) => `${row.name}${row.meta ? ` — ${row.meta}` : ""}: ${row.value}`)
          .join("\n"),
      };
    }
    case "total":
      return {
        html: `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 18px;border-collapse:collapse"><tr><td style="padding:12px 0;border-top:2px solid #171717;color:#171717;font-size:15px;font-weight:800">${escapeHtml(block.label)}</td><td style="padding:12px 0;border-top:2px solid #171717;color:#171717;font-size:15px;font-weight:800;text-align:right">${escapeHtml(block.value)}</td></tr></table>`,
        text: `${block.label}: ${block.value}`,
      };
  }
}

/**
 * Renders the one transactional-email contract. All values are plain strings;
 * escaping happens here so callers cannot accidentally pass executable markup.
 */
export function renderTransactionalEmail(input: TransactionalEmailInput): {
  html: string;
  text: string;
} {
  const blocks = input.blocks.map(renderBlock);
  const greetingHtml = input.greeting
    ? `<p style="margin:0 0 12px;color:#171717;font-size:15px;font-weight:700;line-height:24px">${escapeHtml(input.greeting)}</p>`
    : "";
  const footerHtml = input.footer
    ? `<p style="margin:20px 0 0;color:#8a817b;font-size:12px;line-height:19px;text-align:center">${escapeHtml(input.footer)}</p>`
    : "";

  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;background:#f5f2f0;color:#171717;font-family:Arial,Helvetica,sans-serif"><div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${escapeHtml(input.preheader)}</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;background:#f5f2f0"><tr><td align="center" style="padding:28px 14px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;max-width:600px;border-collapse:separate;background:#ffffff;border:1px solid #e3dcd7;border-radius:16px;overflow:hidden"><tr><td style="height:5px;background:#e30613;font-size:0;line-height:0">&nbsp;</td></tr><tr><td style="padding:24px 28px 10px;color:#e30613;font-size:14px;font-weight:800;letter-spacing:.04em">${escapeHtml(input.brandName)}</td></tr><tr><td style="padding:8px 28px 28px"><h1 style="margin:0 0 18px;color:#171717;font-size:26px;line-height:33px">${escapeHtml(input.title)}</h1>${greetingHtml}${blocks.map((block) => block.html).join("")}</td></tr></table>${footerHtml}</td></tr></table></body></html>`;

  const text = [
    input.brandName,
    input.title,
    input.greeting,
    ...blocks.map((block) => block.text),
    input.footer,
  ]
    .filter((part): part is string => part !== undefined && part.length > 0)
    .join("\n\n");

  return { html, text };
}

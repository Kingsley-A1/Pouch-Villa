import { describe, expect, it } from "vitest";
import { renderTransactionalEmail } from "../src/services/email-template";

describe("transactional email template", () => {
  it("renders one escaped branded HTML shell with equivalent plain text", () => {
    const rendered = renderTransactionalEmail({
      brandName: "Pouch & Villa",
      title: "Order <ready>",
      preheader: "A quiet order update",
      greeting: "Hello <script>alert(1)</script>",
      blocks: [
        { type: "paragraph", text: "Your order is ready & waiting." },
        {
          type: "code",
          label: "Verification code",
          value: "123456",
          hint: "Expires in 15 minutes.",
        },
        {
          type: "details",
          rows: [
            { label: "Reference", value: "PV-<42>" },
            { label: "Status", value: "Ready & packed" },
          ],
        },
        {
          type: "items",
          rows: [{ name: "Case <Pro>", meta: "Qty 2", value: "NGN 10,000" }],
        },
        { type: "total", label: "Total", value: "NGN 10,000" },
      ],
      footer: "Keep this message for your records.",
    });

    expect(rendered.html).toContain('role="presentation"');
    expect(rendered.html).toContain("max-width:600px");
    expect(rendered.html).toContain("display:none");
    expect(rendered.html).toContain("Pouch &amp; Villa");

    // The client's own logo, absolute because an email has no page to be
    // relative to, and carrying the shop's name as its alt so a client that
    // blocks remote images still says who the message is from.
    expect(rendered.html).toContain('src="http');
    expect(rendered.html).toContain("/images/pouch-villa-logo-email.png");
    expect(rendered.html).toContain('alt="Pouch &amp; Villa"');
    expect(rendered.html).toContain("Order &lt;ready&gt;");
    expect(rendered.html).toContain("Hello &lt;script&gt;alert(1)&lt;/script&gt;");
    expect(rendered.html).toContain("PV-&lt;42&gt;");
    expect(rendered.html).not.toContain("<script>");

    expect(rendered.text).toBe(`Pouch & Villa

Order <ready>

Hello <script>alert(1)</script>

Your order is ready & waiting.

Verification code
123456
Expires in 15 minutes.

Reference: PV-<42>
Status: Ready & packed

Case <Pro> — Qty 2: NGN 10,000

Total: NGN 10,000

Keep this message for your records.`);
  });
});

describe("site origin", () => {
  /**
   * An email asset referenced relatively resolves against the recipient's mail
   * client, not against us, so it silently never loads. The absolute URL is the
   * whole reason this helper exists.
   */
  it("builds an absolute asset URL from the deployment's own origin", async () => {
    const { absoluteSiteUrl, siteOrigin } = await import("../src/domain/site-origin");
    const previous = process.env.NEXT_PUBLIC_SITE_URL;

    process.env.NEXT_PUBLIC_SITE_URL = "pouchvilla.example";
    expect(siteOrigin()).toBe("https://pouchvilla.example");
    expect(absoluteSiteUrl("/images/logo.png")).toBe("https://pouchvilla.example/images/logo.png");

    process.env.NEXT_PUBLIC_SITE_URL = "not a url";
    expect(siteOrigin()).toBe("http://localhost:3000");

    if (previous === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
    else process.env.NEXT_PUBLIC_SITE_URL = previous;
  });
});

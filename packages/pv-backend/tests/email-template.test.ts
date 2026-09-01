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

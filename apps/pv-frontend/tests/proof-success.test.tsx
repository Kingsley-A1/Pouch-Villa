import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProofUpload } from "@/app/(store)/orders/[reference]/proof-upload";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const css = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8");

/**
 * Every declaration that applies to a class, from all of its rules at once.
 *
 * Not "the first rule matching this selector", which is what a single regex
 * gives you and is wrong here: the button classes are declared twice, once in a
 * shared list that sets the geometry and once alone for their colours. Picking
 * either block in isolation asserts against half the truth — and which half you
 * get depends on the order somebody happened to write them in.
 */
function ruleFor(className: string): string {
  const applies = new RegExp(`(?:^|,)\\s*\\${className}\\s*(?:,|$)`, "m");
  return [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter(([, selectors]) => applies.test((selectors ?? "").trim()))
    .map(([, , declarations]) => declarations)
    .join("\n");
}

/** The token block on the default ground, before any theme or media override. */
function bareRoot(): string {
  return css.match(/^:root\s*\{([^{}]*)\}/m)?.[1] ?? "";
}

/**
 * The screen a customer reaches straight after parting with money on trust.
 *
 * Everything here is about one question — *did that work* — and about not
 * answering it with a claim the shop cannot yet stand behind. The panel says the
 * receipt has arrived and is being reviewed; it does not say the payment is
 * confirmed, because at this point nobody has looked at it.
 */

function uploadSucceeds() {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      // The pre-signed PUT straight to R2.
      if (init?.method === "PUT" && String(input).includes("r2.test")) {
        return { ok: true } as Response;
      }
      // Step one hands back a URL; step two confirms the bytes that landed.
      const body =
        init?.method === "POST"
          ? { ok: true, data: { url: "https://r2.test/put", uploadId: "upload-1" } }
          : { ok: true, data: { proofId: "proof-1", status: "pending" } };
      return { ok: true, json: async () => body } as Response;
    }),
  );
}

async function uploadAReceipt() {
  render(
    <ProofUpload
      orderId="order-1"
      reference="PV-7Q4K2-M8XZP"
      signedIn={false}
      existingProofs={[]}
    />,
  );

  const input = document.getElementById("proof-file") as HTMLInputElement;
  const file = new File(["receipt bytes"], "transfer.png", { type: "image/png" });
  fireEvent.change(input, { target: { files: [file] } });

  await waitFor(() => expect(screen.getByRole("status")).toBeInTheDocument());
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  uploadSucceeds();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("the payment confirmation", () => {
  it("thanks the customer and says the payment is being reviewed", async () => {
    await uploadAReceipt();

    const panel = screen.getByRole("status");
    expect(panel).toHaveTextContent(/thank you/i);
    expect(panel).toHaveTextContent(/being reviewed/i);
    // It may say the customer *will* be told once the payment is confirmed —
    // that is a promise about the future. What it must never do is state that
    // the payment has been confirmed, because nobody has looked at it yet.
    expect(panel).not.toHaveTextContent(/payment (?:is|was|has been) confirmed/i);
    expect(panel).not.toHaveTextContent(/payment received and confirmed/i);
  });

  it("offers the receipt as a download for this order", async () => {
    await uploadAReceipt();

    const download = screen.getByRole("link", { name: /download your receipt/i });
    expect(download).toHaveAttribute("href", "/api/v1/orders/order-1/receipt?kind=receipt");
  });

  it("draws the download as a plain link, so it survives a broken script", async () => {
    await uploadAReceipt();

    // Deliberately an <a href>, not a button that fetches: the response is a
    // file, and the browser handles that better than any code here could.
    expect(screen.getByRole("link", { name: /download your receipt/i }).tagName).toBe("A");
  });

  it("uses the success-panel button, not the shop's primary one", async () => {
    await uploadAReceipt();

    // On the storefront `--pv-red` is remapped to white, so `.button-primary`
    // there is a white slab — nearly invisible on the pale green panel.
    const download = screen.getByRole("link", { name: /download your receipt/i });
    expect(download.className).toContain("button-on-success");
    expect(download.className).not.toContain("button-primary");
  });
});

describe("the success panel's colours", () => {
  it("states all three tokens on the default ground", () => {
    const root = bareRoot();
    expect(root).toContain("--pv-success-panel:");
    expect(root).toContain("--pv-success-panel-line:");
    expect(root).toContain("--pv-success-panel-ink:");
  });

  it("restates them on the red storefront, so the panel stays green there", () => {
    // The whole point of the screen is that something visibly changed. Letting
    // it inherit the shop's red would undo that.
    const storefront = css.match(/\.storefront\s*\{([^{}]*)\}/)?.[1];
    expect(storefront).toContain("--pv-success-panel:");
    expect(storefront).toContain("--pv-success-panel-ink:");
  });

  it("builds the success button from those tokens rather than from the brand red", () => {
    const rule = ruleFor(".button-on-success");
    expect(rule).toContain("var(--pv-success-panel-ink)");
    expect(rule).not.toContain("--pv-red");
  });
});

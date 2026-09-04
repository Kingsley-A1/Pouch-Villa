import { readProofDocument } from "@pv/backend/services/payments";
import { requirePermission } from "@/server/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * A payment proof, served to the staff member reviewing it.
 *
 * The admin used to mint a signed R2 URL and `window.open` it. That worked, and
 * it put a bank statement into a tab of its own — out of the page, into browser
 * history, and copyable to anyone for as long as the signature lasted. It also
 * meant the reviewer lost the queue they were working through.
 *
 * Serving it from here instead keeps the document inside the page it is being
 * judged in. Authority is re-derived from the session on **every** request
 * rather than granted once to whoever holds a URL, and the read is audited in
 * `readProofDocument` exactly as the signed-URL path was.
 *
 * `?download=1` is the same bytes with `Content-Disposition: attachment`, so
 * "download" is one flag rather than a second code path that could disagree
 * with the first about who is allowed to read what.
 */
export async function GET(request: Request, { params }: { params: Promise<{ proofId: string }> }) {
  // Throws a redirect for a signed-out request, the same as every admin screen.
  const principal = await requirePermission("payment.view");
  const { proofId } = await params;

  let document;
  try {
    document = await readProofDocument(proofId, { staffId: principal.staffId });
  } catch (error) {
    // §5: the message may name a bucket key or a storage failure, so only the
    // error's name is kept. The reader gets a status, not a story.
    console.error("Proof document read failed", {
      name: error instanceof Error ? error.name : typeof error,
    });
    return new Response("Not found", { status: 404 });
  }

  const download = new URL(request.url).searchParams.get("download") === "1";

  return new Response(new Uint8Array(document.bytes), {
    headers: {
      "Content-Type": document.contentType,
      "Content-Length": String(document.bytes.byteLength),
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${document.filename}"`,
      // A financial document must not sit in a shared cache, or in this
      // browser's disk cache after the person signs out.
      "Cache-Control": "no-store, private",
      // The bytes came from an upload. Even after magic-byte validation, this
      // stops a browser deciding the file is something more interesting.
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export function describeUploadFailure(error: unknown): string {
  if (error instanceof TypeError) {
    return "The storage connection was blocked. Refresh and try again; if it continues, contact support.";
  }
  return error instanceof Error ? error.message : "That upload did not work.";
}

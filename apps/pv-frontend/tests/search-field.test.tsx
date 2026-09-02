import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SearchField } from "@/app/(store)/search/search-field";

/**
 * Tapping search in the header should end with a keyboard open, not with a
 * second tap on the smallest target on the page. It should not steal focus back
 * when someone returns to results they have already run, though — that would
 * cover the answer with the keyboard.
 */
describe("search field", () => {
  afterEach(cleanup);

  it("takes focus when arriving with nothing searched yet", () => {
    render(<SearchField term="" />);

    expect(screen.getByRole("searchbox")).toHaveFocus();
  });

  it("leaves focus alone when results are already on screen", () => {
    render(<SearchField term="clear case" />);

    const field = screen.getByRole("searchbox");
    expect(field).not.toHaveFocus();
    expect(field).toHaveValue("clear case");
  });
});

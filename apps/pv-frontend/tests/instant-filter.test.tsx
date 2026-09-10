import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { InstantFilter } from "@/components/instant-filter";

/**
 * The list the filter narrows is rendered by the server in the real page, so the
 * test renders it as plain markup rather than as a component — that is exactly
 * the contract between the two: a `data-filter-scope` container holding elements
 * with `data-filter-label`.
 */
function List() {
  return (
    <ul data-filter-scope="brands">
      <li data-filter-label="Apple">Apple</li>
      <li data-filter-label="Samsung">Samsung</li>
      <li data-filter-label="Tecno">Tecno</li>
    </ul>
  );
}

/** The filter reads `event.target.value`, so one change event is a full query. */
function type(value: string) {
  fireEvent.change(screen.getByLabelText("Find a make"), { target: { value } });
}

function setup() {
  return render(
    <>
      <InstantFilter scope="brands" total={3} label="Find a make" placeholder="Type…" />
      <List />
    </>,
  );
}

/**
 * The client asked that the search "not load like a page does". These assert the
 * two halves of that promise: the filtering happens against what is already on
 * the page, and a filtered-out row is genuinely gone rather than merely faint.
 */
describe("instant filter", () => {
  afterEach(cleanup);

  it("says what is showing before anything is typed", () => {
    setup();
    expect(screen.getByText("Showing all 3.")).toBeVisible();
  });

  it("narrows the list already on the page, without navigating", async () => {
    const { container } = setup();

    type("sam");

    await waitFor(() => {
      const items = [...container.querySelectorAll<HTMLElement>("[data-filter-label]")];
      expect(
        items.filter((item) => !item.hidden).map((item) => item.dataset["filterLabel"]),
      ).toEqual(["Samsung"]);
    });
  });

  it("hides rather than dims, so a filtered row leaves the tab order too", async () => {
    const { container } = setup();

    type("apple");

    await waitFor(() => {
      const tecno = container.querySelector<HTMLElement>('[data-filter-label="Tecno"]');
      // `hidden` takes it out of the accessibility tree and out of the tab
      // order, which is what "filtered out" has to mean for a keyboard user.
      expect(tecno?.hidden).toBe(true);
    });
  });

  it("matches without regard to case", async () => {
    const { container } = setup();

    type("APPLE");

    await waitFor(() => {
      const apple = container.querySelector<HTMLElement>('[data-filter-label="Apple"]');
      expect(apple?.hidden).toBe(false);
    });
  });

  it("points somewhere useful when nothing matches", async () => {
    setup();

    type("zzz");

    // Not a dead end: this filters a list of makes, so someone typing a product
    // name needs telling that the shop search is the thing they want.
    await waitFor(() => {
      expect(screen.getByText(/Try the shop search/)).toBeVisible();
    });
  });

  it("restores the whole list when the box is cleared", async () => {
    const { container } = setup();

    type("sam");
    type("");

    await waitFor(() => {
      const items = [...container.querySelectorAll<HTMLElement>("[data-filter-label]")];
      expect(items.every((item) => !item.hidden)).toBe(true);
    });
  });

  /**
   * `.field` sets its own padding as a shorthand and is declared after
   * Tailwind's utilities in globals.css, so a `pl-10` utility here loses the
   * cascade at equal specificity and the placeholder — and whatever is typed —
   * runs in underneath the magnifying glass rather than starting to its right.
   * `.field-icon` is the house fix for exactly that pairing (see the comment
   * beside it in globals.css); this pins the input to it so the bug cannot come
   * back by way of a `pl-*` utility that looks reasonable in isolation.
   */
  it("uses the cascade-safe icon padding, not a pl-* utility field loses to", () => {
    setup();
    const field = screen.getByLabelText("Find a make");
    expect(field.className).toContain("field-icon");
    expect(field.className).not.toMatch(/\bpl-\d/);
  });
});

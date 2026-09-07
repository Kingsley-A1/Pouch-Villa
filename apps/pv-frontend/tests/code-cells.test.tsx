import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CodeCells } from "@/components/admin/code-cells";

function Harness(initial = "") {
  const onChange = vi.fn();
  render(<CodeCells name="code" value={initial} onChange={onChange} />);
  return onChange;
}

const cells = () => screen.getAllByRole("textbox");

/**
 * Staff were typing the display hyphen along with the code. The server strips
 * it, so it always worked, but the field looked wrong while they typed. Eight
 * boxes remove the question by leaving nowhere to put one.
 */
describe("role code cells", () => {
  afterEach(cleanup);

  it("offers one box per character of the code", () => {
    Harness();
    expect(cells()).toHaveLength(8);
  });

  it("submits one joined value, not eight fields", () => {
    const { container } = render(<CodeCells name="code" value="RVMQTQAF" onChange={() => {}} />);

    const hidden = container.querySelector('input[type="hidden"][name="code"]');
    expect(hidden).toHaveValue("RVMQTQAF");
    for (const cell of cells()) expect(cell).not.toHaveAttribute("name");
  });

  it("uppercases what is typed and refuses a separator", () => {
    const onChange = Harness();

    fireEvent.change(cells()[0]!, { target: { value: "r" } });
    expect(onChange).toHaveBeenLastCalledWith("R");

    onChange.mockClear();
    fireEvent.change(cells()[0]!, { target: { value: "-" } });
    expect(onChange).toHaveBeenLastCalledWith("");
  });

  /** A code copied from the admin carries its display hyphen. */
  it("spreads a pasted code across the boxes, hyphen and all", () => {
    const onChange = Harness();

    fireEvent.paste(cells()[0]!, {
      clipboardData: { getData: () => "rvmq-tqaf" },
    });

    expect(onChange).toHaveBeenLastCalledWith("RVMQTQAF");
  });

  it("makes a half-filled code fail in the browser, not on the server", () => {
    Harness();
    for (const cell of cells()) expect(cell).toBeRequired();
  });

  it("names each box for a screen reader", () => {
    Harness();
    expect(screen.getByLabelText("Character 1 of 8")).toBeVisible();
    expect(screen.getByLabelText("Character 8 of 8")).toBeVisible();
  });
});

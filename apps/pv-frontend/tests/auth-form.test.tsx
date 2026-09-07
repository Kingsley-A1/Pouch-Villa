import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const signInAction = vi.fn();
const registerAction = vi.fn();

vi.mock("@/app/(store)/account/actions", () => ({ signInAction, registerAction }));
vi.mock("@/components/google-sign-in-button", () => ({
  GoogleSignInButton: () => <button type="button">Continue with Google</button>,
}));

const { SignInForm, RegisterForm } = await import("@/app/(store)/account/auth-forms");

/**
 * The account forms, and the one thing about them that was actively costing
 * sign-ins: a rejected password took the email address with it.
 *
 * React resets a form once its action resolves, which is right for a submission
 * that succeeded and wrong for one that failed. Every retry began by retyping an
 * address the shop had just been told — on a phone, on Nigerian mobile data,
 * after a wrong password. These assert the values that must survive and, just as
 * deliberately, the one that must not.
 */

function submit(form: HTMLElement) {
  fireEvent.submit(form);
}

function fieldNamed(name: string): HTMLInputElement {
  const input = document.querySelector(`input[name="${name}"]`);
  if (input === null) throw new Error(`no input named ${name}`);
  return input as HTMLInputElement;
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(cleanup);

describe("a rejected sign in", () => {
  beforeEach(() => {
    signInAction.mockImplementation(async (_prev: unknown, formData: FormData) => ({
      error: "That email or password is incorrect.",
      values: { email: String(formData.get("email") ?? "") },
    }));
  });

  it("keeps the email the visitor already typed", async () => {
    const { container } = render(
      <SignInForm googleClientId={null} next="/account" notice={null} />,
    );

    fireEvent.change(fieldNamed("email"), { target: { value: "ada@test.invalid" } });
    fireEvent.change(fieldNamed("password"), { target: { value: "wrong-password" } });
    submit(container.querySelector("form") as HTMLElement);

    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());

    expect(fieldNamed("email").value).toBe("ada@test.invalid");
  });

  it("clears the password, which is the one field worth clearing", async () => {
    const { container } = render(
      <SignInForm googleClientId={null} next="/account" notice={null} />,
    );

    fireEvent.change(fieldNamed("email"), { target: { value: "ada@test.invalid" } });
    fireEvent.change(fieldNamed("password"), { target: { value: "wrong-password" } });
    submit(container.querySelector("form") as HTMLElement);

    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());

    expect(fieldNamed("password").value).toBe("");
  });

  it("says what went wrong, in an alert", async () => {
    const { container } = render(
      <SignInForm googleClientId={null} next="/account" notice={null} />,
    );

    fireEvent.change(fieldNamed("email"), { target: { value: "ada@test.invalid" } });
    fireEvent.change(fieldNamed("password"), { target: { value: "wrong" } });
    submit(container.querySelector("form") as HTMLElement);

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("That email or password is incorrect."),
    );
  });
});

describe("a rejected registration", () => {
  it("keeps the name, email and phone, and only clears the password", async () => {
    registerAction.mockImplementation(async (_prev: unknown, formData: FormData) => ({
      error: "Password must be at least 12 characters.",
      values: {
        email: String(formData.get("email") ?? ""),
        fullName: String(formData.get("fullName") ?? ""),
        phone: String(formData.get("phone") ?? ""),
      },
    }));

    const { container } = render(
      <RegisterForm googleClientId={null} next="/account" passwordHint="At least 12 characters." />,
    );

    fireEvent.change(fieldNamed("fullName"), { target: { value: "Ada Test" } });
    fireEvent.change(fieldNamed("email"), { target: { value: "ada@test.invalid" } });
    fireEvent.change(fieldNamed("phone"), { target: { value: "08012345678" } });
    fireEvent.change(fieldNamed("password"), { target: { value: "short" } });
    submit(container.querySelector("form") as HTMLElement);

    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());

    // Somebody whose password was too short should not also have to retype the
    // three fields that were fine.
    expect(fieldNamed("fullName").value).toBe("Ada Test");
    expect(fieldNamed("email").value).toBe("ada@test.invalid");
    expect(fieldNamed("phone").value).toBe("08012345678");
    expect(fieldNamed("password").value).toBe("");
  });
});

describe("the password reveal", () => {
  it("shows and hides the password", () => {
    render(<SignInForm googleClientId={null} next="/account" notice={null} />);

    const input = fieldNamed("password");
    expect(input.type).toBe("password");

    fireEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(input.type).toBe("text");

    fireEvent.click(screen.getByRole("button", { name: "Hide password" }));
    expect(input.type).toBe("password");
  });

  it("does not submit the form", () => {
    // A button with no explicit type submits. On a sign-in form that would mean
    // a failed attempt against the rate limiter every time somebody checks
    // their own typing.
    render(<SignInForm googleClientId={null} next="/account" notice={null} />);

    const toggle = screen.getByRole("button", { name: "Show password" });
    expect(toggle).toHaveAttribute("type", "button");

    fireEvent.click(toggle);
    expect(signInAction).not.toHaveBeenCalled();
  });

  it("labels the password field without wrapping the toggle in the label", () => {
    // A <label> may not contain interactive content other than the field it
    // labels, and a nested button would also act on the input when clicked.
    const { container } = render(
      <SignInForm googleClientId={null} next="/account" notice={null} />,
    );

    expect(screen.getByLabelText("Password")).toBe(fieldNamed("password"));
    for (const label of container.querySelectorAll("label")) {
      expect(label.querySelector("button")).toBeNull();
    }
  });
});

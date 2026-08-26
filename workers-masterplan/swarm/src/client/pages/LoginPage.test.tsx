import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { LoginPage } from "./LoginPage";

afterEach(cleanup);

describe("LoginPage", () => {
  it("moves from email and password to the six-digit authentication-code phase", async () => {
    const user = userEvent.setup();
    render(
      <LoginPage
        api={{
          startLogin: async () => ({ data: { challengeId: "challenge-1" } }),
          completeLogin: async () => ({ data: { authenticated: true } }),
        }}
        onAuthenticated={() => undefined}
      />,
    );

    await user.type(screen.getByLabelText("Email"), "claudio@example.com");
    await user.type(screen.getByLabelText("Password"), "correct horse battery staple");
    await user.click(screen.getByRole("button", { name: "Continue" }));

    expect(await screen.findByLabelText("Authentication code")).toHaveAttribute("inputmode", "numeric");
    expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled();
  });

  it("shows the same generic error for an unsuccessful password or authentication-code request", async () => {
    const user = userEvent.setup();
    render(
      <LoginPage
        api={{
          startLogin: async () => ({ error: { code: "AUTH_INVALID", message: "Ignored detail" } }),
          completeLogin: async () => ({ data: { authenticated: true } }),
        }}
        onAuthenticated={() => undefined}
      />,
    );

    await user.type(screen.getByLabelText("Email"), "claudio@example.com");
    await user.type(screen.getByLabelText("Password"), "wrong password");
    await user.click(screen.getByRole("button", { name: "Continue" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to sign in. Check your details and try again.");
    expect(screen.queryByText("Ignored detail")).not.toBeInTheDocument();
  });

  it("recovers to the generic error when the login request rejects", async () => {
    const user = userEvent.setup();
    render(<LoginPage api={{ startLogin: async () => Promise.reject(new Error("network detail")), completeLogin: async () => ({ data: { authenticated: true } }) }} onAuthenticated={() => undefined} />);

    await user.type(screen.getByLabelText("Email"), "claudio@example.com");
    await user.type(screen.getByLabelText("Password"), "correct horse battery staple");
    await user.click(screen.getByRole("button", { name: "Continue" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to sign in. Check your details and try again.");
    expect(screen.getByRole("button", { name: "Continue" })).toBeEnabled();
  });
});

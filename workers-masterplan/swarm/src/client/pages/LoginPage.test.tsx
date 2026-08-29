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

  it("explains how to recover from an invalid authentication code without leaving the code step", async () => {
    const user = userEvent.setup();
    render(
      <LoginPage
        api={{
          startLogin: async () => ({ data: { challengeId: "challenge-1" } }),
          completeLogin: async () => ({ error: { code: "AUTH_INVALID", message: "Ignored detail" } }),
        }}
        onAuthenticated={() => undefined}
      />,
    );

    await user.type(screen.getByLabelText("Email"), "claudio@example.com");
    await user.type(screen.getByLabelText("Password"), "correct horse battery staple");
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.type(await screen.findByLabelText("Authentication code"), "000000");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("That authentication code couldn't be verified. Refresh the page to start again.");
    expect(screen.getByLabelText("Authentication code")).toBeInTheDocument();
  });

  it("explains when too many authentication-code attempts are blocked", async () => {
    const user = userEvent.setup();
    render(
      <LoginPage
        api={{
          startLogin: async () => ({ data: { challengeId: "challenge-1" } }),
          completeLogin: async () => ({ error: { code: "AUTH_THROTTLED", message: "Ignored detail" } }),
        }}
        onAuthenticated={() => undefined}
      />,
    );

    await user.type(screen.getByLabelText("Email"), "claudio@example.com");
    await user.type(screen.getByLabelText("Password"), "correct horse battery staple");
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.type(await screen.findByLabelText("Authentication code"), "000000");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Too many sign-in attempts. Wait up to one hour before trying again.");
    expect(screen.getByLabelText("Authentication code")).toBeInTheDocument();
  });

  it("explains when a throttled login request blocks the email-and-password step", async () => {
    const user = userEvent.setup();
    render(
      <LoginPage
        api={{
          startLogin: async () => ({ error: { code: "AUTH_THROTTLED", message: "Ignored detail" } }),
          completeLogin: async () => ({ data: { authenticated: true } }),
        }}
        onAuthenticated={() => undefined}
      />,
    );

    await user.type(screen.getByLabelText("Email"), "claudio@example.com");
    await user.type(screen.getByLabelText("Password"), "correct horse battery staple");
    await user.click(screen.getByRole("button", { name: "Continue" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Too many sign-in attempts. Wait up to one hour before trying again.");
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
  });
});

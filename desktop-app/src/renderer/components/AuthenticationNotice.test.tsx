import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AuthenticationNotice } from "./AuthenticationNotice";

describe("AuthenticationNotice", () => {
  it("starts browser sign in and has stable pending UI", () => {
    const onSignIn = vi.fn();
    const { asFragment, rerender } = render(
      <AuthenticationNotice onSignIn={onSignIn} pending={false} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(onSignIn).toHaveBeenCalledOnce();
    expect(asFragment()).toMatchSnapshot();

    rerender(<AuthenticationNotice onSignIn={onSignIn} pending />);
    expect(
      screen.getByRole("button", { name: "Open browser again" }),
    ).toBeEnabled();
  });
});

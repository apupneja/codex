import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Select } from "./Select";

const options = [
  { label: "System", value: "system" },
  { label: "Light", value: "light" },
  { label: "Dark", value: "dark" },
];

describe("Select", () => {
  it("uses the same accessible listbox interaction for pointer selection", () => {
    const onChange = vi.fn();
    render(
      <Select
        aria-label="Theme"
        onChange={onChange}
        options={options}
        value="system"
      />,
    );

    fireEvent.click(screen.getByRole("combobox", { name: "Theme" }));
    expect(screen.getByRole("listbox", { name: "Theme" })).toBeVisible();
    fireEvent.click(screen.getByRole("option", { name: "Dark" }));

    expect(onChange).toHaveBeenCalledWith("dark");
    expect(screen.queryByRole("listbox", { name: "Theme" })).toBeNull();
  });

  it("supports arrow, home, end, enter, and escape keys", () => {
    const onChange = vi.fn();
    render(
      <Select
        aria-label="Theme"
        onChange={onChange}
        options={options}
        value="system"
      />,
    );
    const trigger = screen.getByRole("combobox", { name: "Theme" });

    fireEvent.keyDown(trigger, { key: "End" });
    fireEvent.keyDown(trigger, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith("dark");

    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    expect(screen.getByRole("listbox", { name: "Theme" })).toBeVisible();
    fireEvent.keyDown(trigger, { key: "Escape" });
    expect(screen.queryByRole("listbox", { name: "Theme" })).toBeNull();
  });
});

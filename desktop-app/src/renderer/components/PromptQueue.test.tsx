import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";

import { PromptQueue } from "./PromptQueue";

test("keeps steering, editing, and removal distinct", () => {
  const steer = vi.fn();
  const edit = vi.fn();
  render(
    <PromptQueue
      onEdit={edit}
      onRemove={vi.fn()}
      onSteer={steer}
      prompts={[{ effort: "medium", model: "", text: "Run lint" }]}
    />,
  );
  fireEvent.click(screen.getByLabelText("Steer"));
  expect(steer).toHaveBeenCalledWith(0);
  fireEvent.click(screen.getByLabelText("Queued message actions"));
  fireEvent.click(screen.getByText("Edit prompt"));
  expect(edit).toHaveBeenCalledWith(0);
});

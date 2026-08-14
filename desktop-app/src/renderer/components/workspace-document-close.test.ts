import { describe, expect, it, vi } from "vitest";

import type { DesktopApi, OpenDocument } from "../../shared/types";
import { confirmDocumentClose } from "./workspace-document-close";

const document: OpenDocument = {
  dirty: true,
  externalChanged: false,
  language: "json",
  originalText: "saved",
  path: "/workspace/app.json",
  text: "draft",
};

describe("confirmDocumentClose", () => {
  it("routes dirty files through the branded discard confirmation", async () => {
    const confirmDiscardChanges = vi.fn().mockResolvedValue(true);

    await expect(
      confirmDocumentClose(
        document,
        { confirmDiscardChanges } as Pick<DesktopApi, "confirmDiscardChanges">,
        vi.fn(),
      ),
    ).resolves.toBe(true);
    expect(confirmDiscardChanges).toHaveBeenCalledWith(document.path);
  });

  it("keeps the document open and reports confirmation failures", async () => {
    const addToast = vi.fn();

    await expect(
      confirmDocumentClose(
        document,
        {
          confirmDiscardChanges: vi
            .fn()
            .mockRejectedValue(new Error("dialog unavailable")),
        },
        addToast,
      ),
    ).resolves.toBe(false);
    expect(addToast).toHaveBeenCalledWith(
      "Could not confirm closing the file: dialog unavailable",
      "danger",
    );
  });
});

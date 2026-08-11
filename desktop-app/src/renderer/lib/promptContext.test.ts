import { describe, expect, it } from "vitest";

import {
  composePromptText,
  extractPromptContext,
  parseMentionedFilesEnvelope,
} from "./promptContext";

describe("prompt context", () => {
  it("round trips multibyte context ranges", () => {
    const submission = {
      attachments: [],
      contexts: [{ text: "Résumé 📎", title: "Candidate context" }],
      text: "Review this",
    };
    const composed = composePromptText(submission);

    expect(extractPromptContext(composed.text, composed.textElements)).toEqual({
      contexts: [{ text: "Résumé 📎", title: "Candidate context" }],
      text: "Review this",
    });
  });

  it("extracts the request and files from the legacy renderer envelope", () => {
    expect(
      parseMentionedFilesEnvelope(
        "# Files mentioned by the user:\n\n## image.png:\n/tmp/image.png\n\n## My request:\nFix this",
      ),
    ).toEqual({
      files: [{ path: "/tmp/image.png", title: "image.png" }],
      text: "Fix this",
    });
  });
});

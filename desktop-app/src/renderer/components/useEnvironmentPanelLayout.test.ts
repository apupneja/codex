import { describe, expect, it } from "vitest";

import { environmentPanelModeForWidth } from "./useEnvironmentPanelLayout";

describe("environmentPanelModeForWidth", () => {
  it("reserves a readable chat lane and a 320px environment rail", () => {
    expect(environmentPanelModeForWidth(903)).toBe("drawer");
    expect(environmentPanelModeForWidth(904)).toBe("docked");
    expect(environmentPanelModeForWidth(1_361)).toBe("docked");
  });
});

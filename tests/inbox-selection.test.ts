import { describe, expect, it } from "vitest";
import { resolveConversationSelection } from "../client/src/components/inbox/selection";

describe("resolveConversationSelection", () => {
  it("reassigns selection when the selected conversation disappears from the active view", () => {
    const nextSelection = resolveConversationSelection(
      [
        { id: "conv-2" },
        { id: "conv-3" },
      ],
      "conv-1",
    );

    expect(nextSelection).toBe("conv-2");
  });

  it("clears selection when snoozing removes the last visible conversation", () => {
    const nextSelection = resolveConversationSelection([], "conv-1");

    expect(nextSelection).toBeNull();
  });
});

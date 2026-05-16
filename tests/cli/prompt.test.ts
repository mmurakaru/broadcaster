import { describe, expect, it } from "vitest";
import { confirm } from "../../src/cli/prompt.ts";

describe("confirm()", () => {
  it("returns true with skipPrompt + defaultYes:true", async () => {
    expect(await confirm("Install?", { skipPrompt: true, defaultYes: true })).toBe(true);
  });

  it("returns false with skipPrompt + defaultYes:false", async () => {
    expect(await confirm("Install?", { skipPrompt: true, defaultYes: false })).toBe(false);
  });

  it("defaults to true when defaultYes is omitted and skipPrompt is on", async () => {
    expect(await confirm("Install?", { skipPrompt: true })).toBe(true);
  });
});

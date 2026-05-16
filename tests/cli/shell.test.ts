import { describe, expect, it } from "vitest";
import { hasBin } from "../../src/cli/shell.ts";

describe("hasBin()", () => {
  it("returns true for `node` (always present in this test runner)", async () => {
    expect(await hasBin("node")).toBe(true);
  });

  it("returns false for a definitely-non-existent binary", async () => {
    expect(await hasBin("definitely_not_a_real_binary_xyz_9999")).toBe(false);
  });
});

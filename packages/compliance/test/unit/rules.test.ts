import { describe, expect, it } from "vitest";
import { getRuleVersion, resolveRuleVersion, RuleVersionNotFoundError } from "../../src/rules/index.js";

describe("rule version resolution", () => {
  it("resolves NG-2026.1 by id", () => {
    expect(getRuleVersion("NG-2026.1").id).toBe("NG-2026.1");
  });

  it("throws for an unknown id", () => {
    expect(() => getRuleVersion("NG-1999.1")).toThrow(RuleVersionNotFoundError);
  });

  it("resolves by country and effective date", () => {
    expect(resolveRuleVersion("NG", "2026-01-01").id).toBe("NG-2026.1");
    expect(resolveRuleVersion("NG", "2026-06-15").id).toBe("NG-2026.1");
  });

  it("has no rule version covering dates before the reform took effect", () => {
    expect(() => resolveRuleVersion("NG", "2025-12-31")).toThrow(RuleVersionNotFoundError);
  });
});

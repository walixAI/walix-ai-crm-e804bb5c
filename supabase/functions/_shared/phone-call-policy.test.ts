import { describe, expect, it } from "vitest";
import { canUsePhone, canEditPhonePolicy } from "./phone-call-policy";

describe("tenant phone permissions", () => {
  it("allows all active users when configured for everyone", () => {
    expect(canUsePhone({ allow_all: true, allowed_user_ids: [] }, "advisor", true)).toBe(true);
  });
  it("allows only selected users in restricted mode", () => {
    const policy = { allow_all: false, allowed_user_ids: ["selected"] };
    expect(canUsePhone(policy, "selected", true)).toBe(true);
    expect(canUsePhone(policy, "other", true)).toBe(false);
  });
  it("restricts configuration to the tenant owner", () => {
    expect(canEditPhonePolicy(["tenant_owner"])).toBe(true);
    expect(canEditPhonePolicy(["tenant_admin", "sales_manager", "sales_rep"])).toBe(false);
  });
  it("rejects inactive or nonmember users even when selected", () => {
    expect(canUsePhone({ allow_all: false, allowed_user_ids: ["other"] }, "other", false)).toBe(false);
  });
  it("preserves existing access until configured", () => {
    expect(canUsePhone(null, "advisor", true)).toBe(true);
  });
});
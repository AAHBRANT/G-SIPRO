import { describe, expect, it } from "vitest";
import { userAccessDisposition } from "./user-access-authority";

describe("userAccessDisposition", () => {
  it("allows a master to provision common users directly", () => {
    expect(userAccessDisposition({ actorIsOwner: false, requestedIsMaster: false, requestedIsOwner: false })).toBe("DIRECT");
  });

  it("routes a master's request for another master to the owner", () => {
    expect(userAccessDisposition({ actorIsOwner: false, requestedIsMaster: true, requestedIsOwner: false })).toBe("OWNER_APPROVAL");
  });

  it("prevents a master from granting the owner profile", () => {
    expect(userAccessDisposition({ actorIsOwner: false, requestedIsMaster: true, requestedIsOwner: true })).toBe("FORBIDDEN");
  });

  it("allows the owner to provision privileged profiles directly", () => {
    expect(userAccessDisposition({ actorIsOwner: true, requestedIsMaster: true, requestedIsOwner: true })).toBe("DIRECT");
  });
});

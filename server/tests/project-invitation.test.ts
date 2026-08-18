import {
  createProjectInvitationToken,
  hashProjectInvitationToken,
} from "../src/auth/project-invitation.js";
import { tester } from "./test-runner/tester.js";

tester.describe("project invitation tokens", () => {
  tester.it("generates high-entropy URL-safe invitation tokens", () => {
    const first = createProjectInvitationToken();
    const second = createProjectInvitationToken();

    tester.expect(first === second).toBe(false);
    tester.expect(first.length >= 40).toBe(true);
    tester.expect(/^[A-Za-z0-9_-]+$/.test(first)).toBe(true);
  });

  tester.it("hashes invitation tokens deterministically without storing the raw token", () => {
    const token = "guest-invitation-token";
    const firstHash = hashProjectInvitationToken(token);
    const secondHash = hashProjectInvitationToken(token);

    tester.expect(firstHash).toBe(secondHash);
    tester.expect(firstHash === token).toBe(false);
    tester.expect(firstHash.length).toBe(64);
  });
});

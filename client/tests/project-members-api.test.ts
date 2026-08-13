import {
  addProjectMember,
  getProjectMembers,
  removeProjectMember,
  updateProjectMemberRole,
} from "../src/api/project-members-api.js";
import type { ProjectMember } from "../src/types.js";
import { tester } from "./test-runner/tester.js";

type FetchCall = {
  input: Parameters<typeof fetch>[0];
  init: Parameters<typeof fetch>[1];
};

const member: ProjectMember = {
  user: {
    id: "user-1",
    email: "member@example.com",
    displayName: "Member",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  role: "viewer",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function response(data: unknown, status = 200): Response {
  return new Response(
    JSON.stringify({ ok: true, data }),
    {
      status,
      headers: {
        "Content-Type": "application/json",
      },
    },
  );
}

tester.describe("project members API", () => {
  tester.it("lists project members with session credentials", async () => {
    const originalFetch = globalThis.fetch;
    const calls: FetchCall[] = [];

    globalThis.fetch = (async (...args: Parameters<typeof fetch>) => {
      calls.push({ input: args[0], init: args[1] });
      return response([member]);
    }) as typeof fetch;

    try {
      const result = await getProjectMembers("project-1");
      tester.expect(result).toEqual([member]);
      tester.expect(String(calls[0]?.input)).toBe(
        "http://localhost:3000/api/projects/project-1/members",
      );
      tester.expect(calls[0]?.init).toEqual({
        credentials: "include",
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  tester.it("adds a member by normalized email and role", async () => {
    const originalFetch = globalThis.fetch;
    const calls: FetchCall[] = [];

    globalThis.fetch = (async (...args: Parameters<typeof fetch>) => {
      calls.push({ input: args[0], init: args[1] });
      return response(member, 201);
    }) as typeof fetch;

    try {
      await addProjectMember("project-1", {
        email: "  MEMBER@EXAMPLE.COM  ",
        role: "viewer",
      });

      tester.expect(calls[0]?.init).toEqual({
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: "member@example.com",
          role: "viewer",
        }),
        credentials: "include",
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  tester.it("updates a Viewer or Contributor role", async () => {
    const originalFetch = globalThis.fetch;
    const calls: FetchCall[] = [];

    globalThis.fetch = (async (...args: Parameters<typeof fetch>) => {
      calls.push({ input: args[0], init: args[1] });
      return response({ ...member, role: "contributor" });
    }) as typeof fetch;

    try {
      await updateProjectMemberRole(
        "project-1",
        "user-1",
        "contributor",
      );

      tester.expect(String(calls[0]?.input)).toBe(
        "http://localhost:3000/api/projects/project-1/members/user-1",
      );
      tester.expect(calls[0]?.init).toEqual({
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ role: "contributor" }),
        credentials: "include",
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  tester.it("removes a project member", async () => {
    const originalFetch = globalThis.fetch;
    const calls: FetchCall[] = [];

    globalThis.fetch = (async (...args: Parameters<typeof fetch>) => {
      calls.push({ input: args[0], init: args[1] });
      return response(member);
    }) as typeof fetch;

    try {
      await removeProjectMember("project-1", "user-1");

      tester.expect(calls[0]?.init).toEqual({
        method: "DELETE",
        credentials: "include",
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

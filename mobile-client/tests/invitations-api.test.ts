import {
  PROJECT_INVITATION_HEADER,
  acceptProjectInvitation,
  disableProjectInvitation,
  generateProjectInvitation,
  getProjectInvitationStatus,
  resolveGuestInvitation,
} from "../src/api/invitations-api.js";
import { createInvitationAudioDataFetcher } from "../src/api/tracks-api.js";
import { tester } from "./test-runner/tester.js";

function getHeader(init: RequestInit | undefined, name: string): string | null {
  return new Headers(init?.headers).get(name);
}

tester.describe("mobile invitation API", () => {
  tester.it("sends the raw invitation token in the dedicated header for Guest resolution", async () => {
    const originalFetch = globalThis.fetch;
    let capturedInit: RequestInit | undefined;

    globalThis.fetch = (async (_input, init) => {
      capturedInit = init;
      return new Response(
        JSON.stringify({ ok: true, data: { projectId: "project-1" } }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }) as typeof fetch;

    try {
      const result = await resolveGuestInvitation("raw-secret-token");

      tester.expect(result.projectId).toBe("project-1");
      tester.expect(
        getHeader(capturedInit, PROJECT_INVITATION_HEADER),
      ).toBe("raw-secret-token");
      tester.expect(capturedInit?.credentials).toBe("include");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  tester.it("accepts a Contributor invitation with auth cookies and the invitation header", async () => {
    const originalFetch = globalThis.fetch;
    let capturedInit: RequestInit | undefined;

    globalThis.fetch = (async (_input, init) => {
      capturedInit = init;
      return new Response(
        JSON.stringify({
          ok: true,
          data: { projectId: "project-1", role: "contributor" },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }) as typeof fetch;

    try {
      const result = await acceptProjectInvitation("accept-token");

      tester.expect(result.role).toBe("contributor");
      tester.expect(capturedInit?.method).toBe("POST");
      tester.expect(
        getHeader(capturedInit, PROJECT_INVITATION_HEADER),
      ).toBe("accept-token");
      tester.expect(capturedInit?.credentials).toBe("include");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  tester.it("loads Guest audio through the invitation header rather than a tokenized URL", async () => {
    const originalFetch = globalThis.fetch;
    let capturedInput = "";
    let capturedInit: RequestInit | undefined;

    globalThis.fetch = (async (input, init) => {
      capturedInput = String(input);
      capturedInit = init;
      return new Response(new Uint8Array([1, 2, 3]), { status: 200 });
    }) as typeof fetch;

    try {
      const fetchAudio = createInvitationAudioDataFetcher("audio-token");
      const result = await fetchAudio(
        "http://localhost:3000/api/projects/project-1/tracks/track-1/audio",
      );

      tester.expect(result.byteLength).toBe(3);
      tester.expect(capturedInput.includes("audio-token")).toBe(false);
      tester.expect(
        getHeader(capturedInit, PROJECT_INVITATION_HEADER),
      ).toBe("audio-token");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  tester.it("supports Owner generate, status, and disable requests", async () => {
    const originalFetch = globalThis.fetch;
    const methods: string[] = [];

    globalThis.fetch = (async (_input, init) => {
      const method = init?.method ?? "GET";
      methods.push(method);

      if (method === "POST") {
        return new Response(
          JSON.stringify({
            ok: true,
            data: {
              token: "owner-token",
              active: true,
              createdAt: "2026-08-18T00:00:00.000Z",
              updatedAt: "2026-08-18T00:00:00.000Z",
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

      if (method === "DELETE") {
        return new Response(
          JSON.stringify({
            ok: true,
            data: {
              active: false,
              createdAt: "2026-08-18T00:00:00.000Z",
              updatedAt: "2026-08-18T00:00:01.000Z",
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

      return new Response(
        JSON.stringify({
          ok: true,
          data: {
            active: true,
            createdAt: "2026-08-18T00:00:00.000Z",
            updatedAt: "2026-08-18T00:00:00.000Z",
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }) as typeof fetch;

    try {
      const generated = await generateProjectInvitation("project-1");
      const status = await getProjectInvitationStatus("project-1");
      const disabled = await disableProjectInvitation("project-1");

      tester.expect(generated.token).toBe("owner-token");
      tester.expect(status?.active).toBe(true);
      tester.expect(disabled.active).toBe(false);
      tester.expect(methods).toEqual(["POST", "GET", "DELETE"]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

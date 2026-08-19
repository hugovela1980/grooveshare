import {
  PROJECT_INVITATION_HEADER,
  createFrontendServices,
  type ApiRequestOptions,
  type ApiTransport,
  type ApiTransportResponse,
  type Project,
  type ProjectMember,
  type Track,
  type User,
} from "../src/index.js";
import { tester } from "./test-runner/tester.js";

type TransportCall = {
  input: string;
  options: ApiRequestOptions | undefined;
};

function createJsonResponse<T>(data: T, status = 200): ApiTransportResponse {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "Error",
    async json() {
      return { ok: status >= 200 && status < 300, data };
    },
    async arrayBuffer() {
      return new Uint8Array([1, 2, 3]).buffer;
    },
  };
}

function createRecordingTransport(
  responseData: unknown,
): { transport: ApiTransport; calls: TransportCall[] } {
  const calls: TransportCall[] = [];

  return {
    calls,
    transport: {
      async request(input, options) {
        calls.push({ input, options });
        return createJsonResponse(responseData);
      },
    },
  };
}

const user: User = {
  id: "user-1",
  email: "musician@example.com",
  displayName: "Musician",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const project: Project = {
  id: "project-1",
  title: "Song",
  description: "Demo",
  role: "owner",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const track: Track = {
  id: "track-1",
  projectId: "project-1",
  name: "Guitar",
  originalFilename: "guitar.wav",
  filePath: "/tmp/guitar.wav",
  mimeType: "audio/wav",
  fileSize: 3,
  createdAt: "2026-01-01T00:00:00.000Z",
};

const member: ProjectMember = {
  user,
  role: "viewer",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

tester.describe("frontend-core shared frontend services", () => {
  tester.it("normalizes registration data without knowing the network implementation", async () => {
    const { transport, calls } = createRecordingTransport(user);
    const services = createFrontendServices<string>({
      apiBaseUrl: "https://grooveshare.example",
      transport,
      multipartBodyFactory: {
        createTrackUploadBody() {
          return "multipart";
        },
      },
    });

    const result = await services.auth.registerUser({
      email: "  MUSICIAN@EXAMPLE.COM ",
      displayName: "  Musician  ",
      password: "password",
    });

    tester.expect(result).toEqual(user);
    tester.expect(calls[0]).toEqual({
      input: "https://grooveshare.example/api/auth/register",
      options: {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "musician@example.com",
          displayName: "Musician",
          password: "password",
        }),
        notifyOnUnauthorized: false,
      },
    });
  });

  tester.it("uses the invitation header for Guest project access", async () => {
    const { transport, calls } = createRecordingTransport(project);
    const services = createFrontendServices<string>({
      apiBaseUrl: "https://grooveshare.example",
      transport,
      multipartBodyFactory: {
        createTrackUploadBody() {
          return "multipart";
        },
      },
    });

    await services.projects.getProject("project-1", "guest-token");

    tester.expect(calls[0]?.options).toEqual({
      headers: { [PROJECT_INVITATION_HEADER]: "guest-token" },
      notifyOnUnauthorized: false,
    });
  });

  tester.it("delegates browser-specific multipart creation through a port", async () => {
    const { transport, calls } = createRecordingTransport(track);
    let multipartInput: unknown;
    const services = createFrontendServices<string>({
      apiBaseUrl: "https://grooveshare.example",
      transport,
      multipartBodyFactory: {
        createTrackUploadBody(input) {
          multipartInput = input;
          return { kind: "platform-multipart" };
        },
      },
    });

    await services.tracks.uploadTrack({
      projectId: "project-1",
      trackName: "Guitar",
      audioFile: "platform-file",
    });

    tester.expect(multipartInput).toEqual({
      trackName: "Guitar",
      audioFile: "platform-file",
    });
    tester.expect(calls[0]?.options).toEqual({
      method: "POST",
      body: { kind: "platform-multipart" },
    });
  });

  tester.it("keeps invitation tokens out of Guest audio URLs", async () => {
    const calls: TransportCall[] = [];
    const transport: ApiTransport = {
      async request(input, options) {
        calls.push({ input, options });
        return createJsonResponse(track);
      },
    };
    const services = createFrontendServices<string>({
      apiBaseUrl: "https://grooveshare.example",
      transport,
      multipartBodyFactory: {
        createTrackUploadBody() {
          return "multipart";
        },
      },
    });

    const audioUrl = services.tracks.getTrackAudioUrl("project-1", "track-1");
    const fetchAudio = services.tracks.createInvitationAudioDataFetcher("secret-token");
    const bytes = await fetchAudio(audioUrl);

    tester.expect(audioUrl.includes("secret-token")).toBe(false);
    tester.expect(bytes.byteLength).toBe(3);
    tester.expect(calls[0]?.options).toEqual({
      headers: { [PROJECT_INVITATION_HEADER]: "secret-token" },
      notifyOnUnauthorized: false,
    });
  });

  tester.it("normalizes member email in the shared membership service", async () => {
    const { transport, calls } = createRecordingTransport(member);
    const services = createFrontendServices<string>({
      apiBaseUrl: "https://grooveshare.example",
      transport,
      multipartBodyFactory: {
        createTrackUploadBody() {
          return "multipart";
        },
      },
    });

    await services.projectMembers.addProjectMember("project-1", {
      email: " MEMBER@EXAMPLE.COM ",
      role: "viewer",
    });

    tester.expect(calls[0]?.options?.body).toBe(
      JSON.stringify({
        email: "member@example.com",
        role: "viewer",
      }),
    );
  });

  tester.it("shares invitation resolve and acceptance contracts", async () => {
    const calls: TransportCall[] = [];
    const transport: ApiTransport = {
      async request(input, options) {
        calls.push({ input, options });
        const data = input.endsWith("/guest")
          ? { projectId: "project-1" }
          : { projectId: "project-1", role: "contributor" };
        return createJsonResponse(data);
      },
    };
    const services = createFrontendServices<string>({
      apiBaseUrl: "https://grooveshare.example",
      transport,
      multipartBodyFactory: {
        createTrackUploadBody() {
          return "multipart";
        },
      },
    });

    const resolved = await services.invitations.resolveGuestInvitation("token");
    const accepted = await services.invitations.acceptProjectInvitation("token");

    tester.expect(resolved.projectId).toBe("project-1");
    tester.expect(accepted.role).toBe("contributor");
    tester.expect(calls[0]?.options?.notifyOnUnauthorized).toBe(false);
    tester.expect(calls[1]?.options?.method).toBe("POST");
  });

  tester.it("shares the complete authentication session workflow", async () => {
    const calls: TransportCall[] = [];
    const transport: ApiTransport = {
      async request(input, options) {
        calls.push({ input, options });
        return createJsonResponse(user);
      },
    };
    const services = createFrontendServices<string>({
      apiBaseUrl: "https://grooveshare.example",
      transport,
      multipartBodyFactory: {
        createTrackUploadBody() {
          return "multipart";
        },
      },
    });

    await services.auth.login({
      email: " MUSICIAN@EXAMPLE.COM ",
      password: "password",
    });
    await services.auth.getCurrentUser();
    await services.auth.logout();

    tester.expect(calls).toEqual([
      {
        input: "https://grooveshare.example/api/auth/login",
        options: {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: "musician@example.com",
            password: "password",
          }),
          notifyOnUnauthorized: false,
        },
      },
      {
        input: "https://grooveshare.example/api/auth/me",
        options: { notifyOnUnauthorized: false },
      },
      {
        input: "https://grooveshare.example/api/auth/logout",
        options: {
          method: "POST",
          notifyOnUnauthorized: false,
        },
      },
    ]);
  });

  tester.it("shares project read, update, mix, and delete routes", async () => {
    const calls: TransportCall[] = [];
    const transport: ApiTransport = {
      async request(input, options) {
        calls.push({ input, options });
        return createJsonResponse(project);
      },
    };
    const services = createFrontendServices<string>({
      apiBaseUrl: "https://grooveshare.example",
      transport,
      multipartBodyFactory: {
        createTrackUploadBody() {
          return "multipart";
        },
      },
    });

    await services.projects.getProject("project-1");
    await services.projects.updateProjectDetails("project-1", {
      title: "Updated",
      description: "Description",
    });
    await services.projects.saveMixSettings("project-1", {
      channels: [],
    });
    await services.projects.deleteProject("project-1");

    tester.expect(calls.map((call) => [call.input, call.options?.method ?? "GET"]))
      .toEqual([
        ["https://grooveshare.example/api/projects/project-1", "GET"],
        ["https://grooveshare.example/api/projects/project-1", "PUT"],
        ["https://grooveshare.example/api/projects/project-1/mix-settings", "PUT"],
        ["https://grooveshare.example/api/projects/project-1", "DELETE"],
      ]);
  });

  tester.it("shares track list, rename, and delete routes", async () => {
    const calls: TransportCall[] = [];
    const transport: ApiTransport = {
      async request(input, options) {
        calls.push({ input, options });
        const data = input.endsWith("/tracks") ? [track] : track;
        return createJsonResponse(data);
      },
    };
    const services = createFrontendServices<string>({
      apiBaseUrl: "https://grooveshare.example",
      transport,
      multipartBodyFactory: {
        createTrackUploadBody() {
          return "multipart";
        },
      },
    });

    await services.tracks.getTracksByProjectId("project-1");
    await services.tracks.updateTrackName("project-1", "track-1", "Lead Guitar");
    await services.tracks.deleteTrack("project-1", "track-1");

    tester.expect(calls.map((call) => [call.input, call.options?.method ?? "GET"]))
      .toEqual([
        ["https://grooveshare.example/api/projects/project-1/tracks", "GET"],
        ["https://grooveshare.example/api/projects/project-1/tracks/track-1", "PUT"],
        ["https://grooveshare.example/api/projects/project-1/tracks/track-1", "DELETE"],
      ]);
  });

  tester.it("shares the complete membership mutation workflow", async () => {
    const calls: TransportCall[] = [];
    const transport: ApiTransport = {
      async request(input, options) {
        calls.push({ input, options });
        return createJsonResponse(member);
      },
    };
    const services = createFrontendServices<string>({
      apiBaseUrl: "https://grooveshare.example",
      transport,
      multipartBodyFactory: {
        createTrackUploadBody() {
          return "multipart";
        },
      },
    });

    await services.projectMembers.getProjectMembers("project-1");
    await services.projectMembers.addProjectMember("project-1", {
      email: " MEMBER@EXAMPLE.COM ",
      role: "viewer",
    });
    await services.projectMembers.updateProjectMemberRole(
      "project-1",
      "user-1",
      "contributor",
    );
    await services.projectMembers.removeProjectMember("project-1", "user-1");

    tester.expect(calls.map((call) => [call.input, call.options?.method ?? "GET"]))
      .toEqual([
        ["https://grooveshare.example/api/projects/project-1/members", "GET"],
        ["https://grooveshare.example/api/projects/project-1/members", "POST"],
        ["https://grooveshare.example/api/projects/project-1/members/user-1", "PUT"],
        ["https://grooveshare.example/api/projects/project-1/members/user-1", "DELETE"],
      ]);
  });

  tester.it("shares Owner invitation generate, status, and disable routes", async () => {
    const calls: TransportCall[] = [];
    const transport: ApiTransport = {
      async request(input, options) {
        calls.push({ input, options });
        const method = options?.method ?? "GET";
        const data = method === "POST"
          ? {
              token: "owner-token",
              active: true,
              createdAt: "2026-08-18T00:00:00.000Z",
              updatedAt: "2026-08-18T00:00:00.000Z",
            }
          : {
              active: method !== "DELETE",
              createdAt: "2026-08-18T00:00:00.000Z",
              updatedAt: "2026-08-18T00:00:01.000Z",
            };
        return createJsonResponse(data);
      },
    };
    const services = createFrontendServices<string>({
      apiBaseUrl: "https://grooveshare.example",
      transport,
      multipartBodyFactory: {
        createTrackUploadBody() {
          return "multipart";
        },
      },
    });

    const generated = await services.invitations.generateProjectInvitation("project-1");
    const status = await services.invitations.getProjectInvitationStatus("project-1");
    const disabled = await services.invitations.disableProjectInvitation("project-1");

    tester.expect(generated.token).toBe("owner-token");
    tester.expect(status?.active).toBe(true);
    tester.expect(disabled.active).toBe(false);
    tester.expect(calls.map((call) => call.options?.method ?? "GET"))
      .toEqual(["POST", "GET", "DELETE"]);
  });

  tester.it("surfaces server errors from the shared service layer", async () => {
    const transport: ApiTransport = {
      async request() {
        return {
          ok: false,
          status: 403,
          statusText: "Forbidden",
          async json() {
            return { ok: false, error: "You cannot delete this project." };
          },
          async arrayBuffer() {
            return new ArrayBuffer(0);
          },
        };
      },
    };
    const services = createFrontendServices<string>({
      apiBaseUrl: "https://grooveshare.example",
      transport,
      multipartBodyFactory: {
        createTrackUploadBody() {
          return "multipart";
        },
      },
    });

    let message = "";
    try {
      await services.projects.deleteProject("project-1");
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }

    tester.expect(message).toBe("You cannot delete this project.");
  });

});

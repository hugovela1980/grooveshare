import path from "node:path";
import {
  createDatabaseConfig,
  createServerConfig,
} from "../src/config/server-config.js";
import { tester } from "./test-runner/tester.js";

function createDevelopmentEnv(
  overrides: NodeJS.ProcessEnv = {},
): NodeJS.ProcessEnv {
  return {
    NODE_ENV: "development",
    PGUSER: "grooveshare_app",
    PGPASSWORD: "local-password",
    ...overrides,
  };
}

function captureErrorMessage(fn: () => unknown): string {
  try {
    fn();
  } catch (error) {
    return error instanceof Error
      ? error.message
      : String(error);
  }

  return "";
}

tester.describe("server configuration", () => {
  tester.it("uses safe local development defaults", () => {
    const config = createServerConfig(
      createDevelopmentEnv(),
    );
    

    tester.expect(config.nodeEnv).toBe("development");
    tester.expect(config.host).toBe("127.0.0.1");
    tester.expect(config.port).toBe(3000);
    tester.expect(config.clientOrigin).toBe(
      "http://localhost:5173",
    );
    tester.expect(config.uploadRoot).toBeTruthy();
    tester.expect(path.isAbsolute(config.uploadRoot)).toBe(true);
    tester.expect(config.ffmpegPath).toBe("ffmpeg");
    tester.expect(config.ffprobePath).toBe("ffprobe");
    tester.expect(config.database).toEqual({
      host: "localhost",
      port: 5432,
      database: "grooveshare_dev",
      user: "grooveshare_app",
      password: "local-password",
    });
    tester.expect(config.secureCookies).toBe(false);
    tester.expect(config.developmentRoutesEnabled).toBe(true);
  });

  tester.it("accepts an explicit production configuration", () => {
    const uploadRoot = path.resolve(
      "tests/.tmp/production-uploads",
    );

    const config = createServerConfig({
      NODE_ENV: "production",
      HOST: "127.0.0.1",
      PORT: "8080",
      CLIENT_ORIGIN: "https://music.example.com",
      UPLOAD_ROOT: uploadRoot,
      PGHOST: "127.0.0.1",
      PGPORT: "5432",
      PGDATABASE: "grooveshare",
      PGUSER: "grooveshare_app",
      PGPASSWORD: "production-password",
      FFMPEG_PATH: "/opt/media/ffmpeg",
      FFPROBE_PATH: "/opt/media/ffprobe",
    });

    tester.expect(config.nodeEnv).toBe("production");
    tester.expect(config.host).toBe("127.0.0.1");
    tester.expect(config.port).toBe(8080);
    tester.expect(config.clientOrigin).toBe(
      "https://music.example.com",
    );
    tester.expect(config.uploadRoot).toBe(uploadRoot);
    tester.expect(config.ffmpegPath).toBe("/opt/media/ffmpeg");
    tester.expect(config.ffprobePath).toBe("/opt/media/ffprobe");
    tester.expect(config.secureCookies).toBe(true);
    tester.expect(config.developmentRoutesEnabled).toBe(false);
  });

  tester.it("requires a production client origin", () => {
    const message = captureErrorMessage(() => {
      createServerConfig({
        NODE_ENV: "production",
        PORT: "3000",
        UPLOAD_ROOT: path.resolve("production-uploads"),
        PGHOST: "127.0.0.1",
        PGPORT: "5432",
        PGDATABASE: "grooveshare",
        PGUSER: "grooveshare_app",
        PGPASSWORD: "production-password",
      });
    });

    tester.expect(message).toBe(
      "Missing required environment variable: CLIENT_ORIGIN.",
    );
  });

  tester.it("requires an absolute production upload root", () => {
    const message = captureErrorMessage(() => {
      createServerConfig({
        NODE_ENV: "production",
        PORT: "3000",
        CLIENT_ORIGIN: "https://music.example.com",
        UPLOAD_ROOT: "relative/uploads",
        PGHOST: "127.0.0.1",
        PGPORT: "5432",
        PGDATABASE: "grooveshare",
        PGUSER: "grooveshare_app",
        PGPASSWORD: "production-password",
      });
    });

    tester.expect(message).toBe(
      "UPLOAD_ROOT must be an absolute path in production.",
    );
  });

  tester.it("rejects invalid server ports", () => {
    const message = captureErrorMessage(() => {
      createServerConfig(
        createDevelopmentEnv({
          PORT: "not-a-port",
        }),
      );
    });

    tester.expect(message).toBe(
      "PORT must be an integer between 1 and 65535.",
    );
  });

  tester.it("builds database configuration independently", () => {
    const config = createDatabaseConfig(
      createDevelopmentEnv({
        PGHOST: "db.internal",
        PGPORT: "5433",
        PGDATABASE: "grooveshare_custom",
      }),
    );

    tester.expect(config).toEqual({
      host: "db.internal",
      port: 5433,
      database: "grooveshare_custom",
      user: "grooveshare_app",
      password: "local-password",
    });
  });
});

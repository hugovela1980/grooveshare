import { createBrowserRecordedTakePlaybackAdapter } from "../src/index.js";
import { tester } from "./test-runner/tester.js";

class FakeAudioElement {
  src = "";
  currentTime = 0;
  onended: (() => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  playCalls = 0;
  pauseCalls = 0;
  loadCalls = 0;
  removeAttributeCalls: string[] = [];
  playError: Error | null = null;

  async play(): Promise<void> {
    this.playCalls += 1;
    if (this.playError) {
      throw this.playError;
    }
  }

  pause(): void {
    this.pauseCalls += 1;
  }

  load(): void {
    this.loadCalls += 1;
  }

  removeAttribute(name: string): void {
    this.removeAttributeCalls.push(name);
    if (name === "src") {
      this.src = "";
    }
  }

  end(): void {
    this.onended?.();
  }

  fail(message: string): void {
    const event = new Event("error") as Event & { error?: unknown };
    event.error = new Error(message);
    this.onerror?.(event);
  }
}

function createHarness() {
  const audioElements: FakeAudioElement[] = [];
  const createdUrls: string[] = [];
  const revokedUrls: string[] = [];
  let nextUrlId = 1;

  const adapter = createBrowserRecordedTakePlaybackAdapter({
    createAudioElement() {
      const audio = new FakeAudioElement();
      audioElements.push(audio);
      return audio;
    },
    objectUrlApi: {
      createObjectURL(blob) {
        tester.expect(blob.type).toBe("audio/webm");
        const url = `blob:take-${nextUrlId++}`;
        createdUrls.push(url);
        return url;
      },
      revokeObjectURL(url) {
        revokedUrls.push(url);
      },
    },
  });

  return { adapter, audioElements, createdUrls, revokedUrls };
}

const capture = {
  bytes: new Uint8Array([7, 8, 9]),
  mimeType: "audio/webm",
};

tester.describe("browser recorded-take playback adapter", () => {
  tester.it("auditions temporary bytes and revokes the object URL when playback ends", async () => {
    const harness = createHarness();
    let endedCalls = 0;

    await harness.adapter.play(capture, {
      onEnded() {
        endedCalls += 1;
      },
    });

    tester.expect(harness.audioElements.length).toBe(1);
    tester.expect(harness.audioElements[0]?.src).toBe("blob:take-1");
    tester.expect(harness.audioElements[0]?.playCalls).toBe(1);
    tester.expect(harness.revokedUrls).toEqual([]);

    harness.audioElements[0]?.end();

    tester.expect(endedCalls).toBe(1);
    tester.expect(harness.revokedUrls).toEqual(["blob:take-1"]);
    tester.expect(harness.audioElements[0]?.removeAttributeCalls).toEqual(["src"]);
  });

  tester.it("stops an audition and cleans up its temporary browser resources", async () => {
    const harness = createHarness();

    await harness.adapter.play(capture);
    await harness.adapter.stop();

    tester.expect(harness.audioElements[0]?.pauseCalls).toBe(1);
    tester.expect(harness.audioElements[0]?.loadCalls).toBe(1);
    tester.expect(harness.revokedUrls).toEqual(["blob:take-1"]);
  });

  tester.it("reports asynchronous audio playback failures and still cleans up the object URL", async () => {
    const harness = createHarness();
    const failures: string[] = [];

    await harness.adapter.play(capture, {
      onFailure(failure) {
        failures.push(failure.message);
      },
    });
    harness.audioElements[0]?.fail("temporary audio decode failed");

    tester.expect(failures).toEqual(["temporary audio decode failed"]);
    tester.expect(harness.revokedUrls).toEqual(["blob:take-1"]);
  });
});

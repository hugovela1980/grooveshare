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

  tester.it("advances a late take by seeking its temporary source before audition", async () => {
    const harness = createHarness();

    await harness.adapter.play(capture, { alignmentOffsetSeconds: 0.163 });

    tester.expect(harness.audioElements[0]?.currentTime).toBe(0.163);
    tester.expect(harness.audioElements[0]?.playCalls).toBe(1);
  });

  tester.it("delays an early take by the signed negative alignment amount", async () => {
    const audioElements: FakeAudioElement[] = [];
    const scheduledDelays: number[] = [];
    const scheduledHandlers: Array<() => void> = [];
    const adapter = createBrowserRecordedTakePlaybackAdapter({
      createAudioElement() {
        const audio = new FakeAudioElement();
        audioElements.push(audio);
        return audio;
      },
      objectUrlApi: {
        createObjectURL() { return "blob:delayed-take"; },
        revokeObjectURL() {},
      },
      scheduleTimeout(handler, milliseconds) {
        scheduledHandlers.push(handler);
        scheduledDelays.push(milliseconds);
        return scheduledHandlers.length;
      },
      clearScheduledTimeout() {},
    });

    await adapter.play(capture, { alignmentOffsetSeconds: -0.032 });

    tester.expect(scheduledDelays).toEqual([32]);
    tester.expect(audioElements[0]?.playCalls).toBe(0);
    scheduledHandlers[0]?.();
    await Promise.resolve();
    tester.expect(audioElements[0]?.playCalls).toBe(1);
  });

  tester.it("replaces an existing audition without leaking its audio element or object URL", async () => {
    const harness = createHarness();

    await harness.adapter.play(capture);
    const firstAudio = harness.audioElements[0];
    await harness.adapter.play(capture);

    tester.expect(harness.audioElements.length).toBe(2);
    tester.expect(firstAudio?.pauseCalls).toBe(1);
    tester.expect(firstAudio?.loadCalls).toBe(1);
    tester.expect(harness.revokedUrls).toEqual(["blob:take-1"]);
    tester.expect(harness.audioElements[1]?.playCalls).toBe(1);

    await harness.adapter.release();
    tester.expect(harness.revokedUrls).toEqual(["blob:take-1", "blob:take-2"]);
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

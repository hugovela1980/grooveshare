import { chooseAudioFile } from "../src/app.js";
import { tester } from "./test-runner/tester.js";

class FakeFileInput extends EventTarget {
  type = "";
  accept = "";
  files: File[] = [];
  clickCount = 0;

  click() {
    this.clickCount += 1;
  }
}

tester.describe("mobile audio file picker", () => {
  tester.it("settles cancellation so Add Track can open another picker", async () => {
    const cancelledInput = new FakeFileInput();
    const cancelled = chooseAudioFile(
      () => cancelledInput as unknown as HTMLInputElement,
    );

    tester.expect(cancelledInput.clickCount).toBe(1);
    cancelledInput.dispatchEvent(new Event("cancel"));
    tester.expect(await cancelled).toBe(null);

    const nextInput = new FakeFileInput();
    const file = new File(["audio"], "guitar.wav", { type: "audio/wav" });
    const selected = chooseAudioFile(
      () => nextInput as unknown as HTMLInputElement,
    );

    tester.expect(nextInput.clickCount).toBe(1);
    tester.expect(nextInput.type).toBe("file");
    nextInput.files = [file];
    nextInput.dispatchEvent(new Event("change"));
    tester.expect(await selected).toBe(file);
  });
});

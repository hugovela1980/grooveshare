import { createProjectInvitationController } from "../src/page-controllers/project-invitation-controller.js";
import { tester } from "./test-runner/tester.js";

type ClickHandler = () => void | Promise<void>;

function createButton() {
  let clickHandler: ClickHandler | null = null;

  return {
    disabled: false,
    hidden: false as boolean | string,
    textContent: null as string | null,
    addEventListener(eventName: "click", handler: ClickHandler) {
      if (eventName === "click") {
        clickHandler = handler;
      }
    },
    async click() {
      await clickHandler?.();
    },
  };
}

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await new Promise<void>((resolve) => globalThis.setTimeout(resolve, 0));
}

tester.describe("mobile Owner collaboration-link controls", () => {
  tester.it("generates, copies, regenerates, and disables the active Guest link", async () => {
    const statusElement = { textContent: "" as string | null };
    const linkInput = { value: "", hidden: true as boolean | string };
    const generateButton = createButton();
    const copyButton = createButton();
    const regenerateButton = createButton();
    const disableButton = createButton();
    const copiedValues: string[] = [];
    let generationCount = 0;
    let active = false;

    const controller = createProjectInvitationController({
      projectId: "project-1",
      invitationApi: {
        async getProjectInvitationStatus() {
          return active
            ? {
                active: true,
                createdAt: "2026-08-18T00:00:00.000Z",
                updatedAt: "2026-08-18T00:00:00.000Z",
              }
            : null;
        },
        async generateProjectInvitation() {
          generationCount += 1;
          active = true;
          return {
            token: `token-${generationCount}`,
            active: true,
            createdAt: "2026-08-18T00:00:00.000Z",
            updatedAt: "2026-08-18T00:00:00.000Z",
          };
        },
        async disableProjectInvitation() {
          active = false;
          return {
            active: false,
            createdAt: "2026-08-18T00:00:00.000Z",
            updatedAt: "2026-08-18T00:00:01.000Z",
          };
        },
      },
      statusElement,
      linkInput,
      generateButton,
      copyButton,
      regenerateButton,
      disableButton,
      buildShareLink(token) {
        return `https://mobile.grooveshare.example/#invite/${token}`;
      },
      async copyText(value) {
        copiedValues.push(value);
      },
    });

    controller.init();
    await flushMicrotasks();

    tester.expect(generateButton.hidden).toBe(false);
    tester.expect(copyButton.hidden).toBe(true);

    await generateButton.click();
    tester.expect(linkInput.value).toBe(
      "https://mobile.grooveshare.example/#invite/token-1",
    );
    tester.expect(generateButton.hidden).toBe(true);
    tester.expect(regenerateButton.hidden).toBe(false);
    tester.expect(disableButton.hidden).toBe(false);
    tester.expect(copyButton.hidden).toBe(false);

    await copyButton.click();
    tester.expect(copiedValues).toEqual([
      "https://mobile.grooveshare.example/#invite/token-1",
    ]);

    await regenerateButton.click();
    tester.expect(linkInput.value).toBe(
      "https://mobile.grooveshare.example/#invite/token-2",
    );

    await disableButton.click();
    tester.expect(generateButton.hidden).toBe(false);
    tester.expect(copyButton.hidden).toBe(true);
    tester.expect(linkInput.hidden).toBe(true);
  });
});

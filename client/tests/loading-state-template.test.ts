import {
  renderAppLoadingState,
  renderLoadingState,
} from "../src/templates/loading-state.js";
import { tester } from "./test-runner/tester.js";

tester.describe("loading state template", () => {
  tester.it("renders a visible spinner and accessible loading message", () => {
    const html = renderLoadingState("Loading projects...");

    tester.expect(html.includes('class="loading-state')).toBe(true);
    tester.expect(html.includes("loading-state__spinner")).toBe(true);
    tester.expect(html.includes('role="status"')).toBe(true);
    tester.expect(html.includes("Loading projects...")).toBe(true);
  });

  tester.it("escapes loading messages", () => {
    const html = renderLoadingState('<Loading "project">');

    tester.expect(html.includes("&lt;Loading &quot;project&quot;&gt;")).toBe(true);
    tester.expect(html.includes('<Loading "project">')).toBe(false);
  });

  tester.it("renders an app-level loading shell", () => {
    const html = renderAppLoadingState("Loading GrooveShare...");

    tester.expect(html.includes('data-page="loading"')).toBe(true);
    tester.expect(html.includes("Loading GrooveShare...")).toBe(true);
  });
});

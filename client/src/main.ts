import "./style.css";

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("Could not find #app element");
}

app.innerHTML = `
  <main class="app-shell">
    <section class="hero">
      <p class="eyebrow">GrooveShare</p>
      <h1>Share rough tracks with your bandmates.</h1>
      <p class="description">
        A lightweight music collaboration tool for sharing stems,
        practicing parts, and sending rough recordings back.
      </p>
    </section>

    <section class="status-card">
      <h2>Backend connection</h2>
      <p id="api-status">Checking API status...</p>
    </section>
  </main>
`;

const statusElement = document.querySelector<HTMLParagraphElement>("#api-status");

async function checkApiHealth() {
  if (!statusElement) return;

  try {
    const response = await fetch("http://localhost:3000/api/health");

    if (!response.ok) {
      throw new Error(`API responded with ${response.status}`);
    }

    const data = await response.json();

    statusElement.textContent = data.message;
  } catch (error) {
    console.error(error);
    statusElement.textContent = "Could not connect to the GrooveShare API.";
  }
}

checkApiHealth();
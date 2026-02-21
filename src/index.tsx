import { Hono } from "hono";

import { renderer } from "./renderer";

const app = new Hono();

app.use(renderer);

const GITHUB_REPO_URL = "https://github.com/yehezkielgunawan/img-compress";

const Header = () => (
  <header class="navbar bg-base-100 shadow-lg">
    <div class="flex-1">
      <a href="/" class="btn btn-ghost text-xl">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="mr-2 h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
        Image Compressor
      </a>
    </div>
    <div
      class="tooltip tooltip-left flex-none"
      data-tip="View source on GitHub"
    >
      <a
        href={GITHUB_REPO_URL}
        target="_blank"
        rel="noopener noreferrer"
        class="btn btn-ghost btn-square"
        aria-label="View source on GitHub"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-6 w-6"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
        </svg>
        <span class="sr-only">View source on GitHub</span>
      </a>
    </div>
  </header>
);

const Footer = () => (
  <footer class="footer footer-center mt-8 bg-base-100 p-4 text-base-content">
    <aside>
      <p class="text-sm">
        100% Local - Your images never leave your device <br />
        <span>
          Made by{" "}
          <a href="https://yehezgun.com" class="link link-primary">
            Yehezkiel Gunawan
          </a>
        </span>
      </p>
    </aside>
  </footer>
);

const PageNav = ({ active }: { active: "canvas" | "pixo" }) => (
  <div role="tablist" class="tabs tabs-boxed mb-6 justify-center">
    <a
      href="/"
      role="tab"
      class={`tab ${active === "canvas" ? "tab-active" : ""}`}
    >
      Canvas
    </a>
    <a
      href="/pixo"
      role="tab"
      class={`tab ${active === "pixo" ? "tab-active" : ""}`}
    >
      Pixo WASM
    </a>
  </div>
);

app.get("/", (c) => {
  return c.render(
    <div class="flex min-h-screen flex-col">
      <Header />
      <main class="container mx-auto max-w-5xl flex-1 px-4 py-6 md:py-8">
        <PageNav active="canvas" />
        <div id="root"></div>
      </main>
      <Footer />
    </div>,
  );
});

app.get("/pixo", (c) => {
  return c.render(
    <div class="flex min-h-screen flex-col">
      <Header />
      <main class="container mx-auto max-w-5xl flex-1 px-4 py-6 md:py-8">
        <PageNav active="pixo" />
        <div id="pixo-root"></div>
      </main>
      <Footer />
    </div>,
  );
});

export default app;

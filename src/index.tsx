import { Hono } from "hono";

import { renderer } from "./renderer";

const app = new Hono();

app.use(renderer);

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

app.get("/", (c) => {
	return c.render(
		<div class="flex min-h-screen flex-col">
			<Header />
			<main class="container mx-auto max-w-5xl flex-1 px-4 py-6 md:py-8">
				<div id="root"></div>
			</main>
			<Footer />
		</div>,
	);
});

export default app;

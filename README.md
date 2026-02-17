# Image Compressor

A free, local-first image compression web app. Compress JPG, JPEG, and PNG images directly in your browser using the HTML Canvas API — no files are ever uploaded to a server.

## Features

- **100% Client-Side** — Images are compressed locally using the HTML Canvas API. Nothing leaves your device.
- **Supports JPG, JPEG, PNG** — Accepts the most common image formats.
- **Adjustable Quality Slider** — Control the compression quality from 10% to 100% in real time.
- **Side-by-Side Preview** — Compare original and compressed images before downloading.
- **Compression Stats** — See the compression ratio and bytes saved at a glance.
- **One-Click Download** — Download the compressed image instantly.
- **Responsive UI** — Works on desktop and mobile devices.

## Tech Stack

- **Runtime:** [Cloudflare Workers](https://developers.cloudflare.com/workers)
- **Framework:** [Hono](https://hono.dev) (server-side SSR + client-side JSX via `hono/jsx/dom`)
- **Styling:** [Tailwind CSS v4](https://tailwindcss.com) + [daisyUI](https://daisyui.com)
- **Build Tool:** [Vite](https://vite.dev) with `@cloudflare/vite-plugin`
- **Language:** TypeScript (strict mode)
- **Testing:** [Vitest](https://vitest.dev) with `@vitest/coverage-v8`
- **Package Manager:** pnpm

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org) v18+
- [pnpm](https://pnpm.io)

### Install

```bash
pnpm install
```

### Development

```bash
pnpm dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Build & Preview

```bash
pnpm preview
```

### Deploy to Cloudflare Workers

```bash
pnpm deploy
```

## Testing

```bash
# Run tests in watch mode
pnpm test

# Run tests once with coverage report
pnpm test:coverage
```

Coverage thresholds are set to **70%** for lines, branches, functions, and statements.

## Project Structure

```
img-compress/
├── public/                    # Static assets (favicons, manifest)
│   ├── favicon.ico
│   ├── favicon-16x16.png
│   ├── favicon-32x32.png
│   ├── apple-touch-icon.png
│   ├── android-chrome-192x192.png
│   ├── android-chrome-512x512.png
│   └── manifest.json
├── src/
│   ├── index.tsx              # Hono app with server-rendered layout
│   ├── renderer.tsx           # JSX renderer (head, meta, scripts)
│   ├── client.tsx             # Client-side image compressor (hono/jsx/dom)
│   ├── style.css              # Tailwind CSS + daisyUI
│   └── utils/
│       ├── imageUtils.ts      # Pure utility functions (testable)
│       └── imageUtils.test.ts # Unit tests
├── vite.config.ts             # Vite + Vitest config
├── tsconfig.json
├── wrangler.jsonc             # Cloudflare Workers config
└── package.json
```

## How It Works

1. The server (`index.tsx`) renders a static shell (header, footer) with a `<div id="root">` mount point.
2. The client script (`client.tsx`) mounts an interactive `ImageCompressor` component using `hono/jsx/dom` with hooks (`useState`, `useEffect`, `useRef`).
3. When a user selects an image, it is drawn onto an HTML `<canvas>` element and re-exported as a JPEG blob at the chosen quality level.
4. All processing happens in-browser — no network requests are made.

## License

MIT

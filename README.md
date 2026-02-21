# Image Compressor

A free, local-first image compression web app with two compression engines. Compress JPG, JPEG, and PNG images directly in your browser — no files are ever uploaded to a server.

- **Canvas page (`/`)** — Uses the HTML Canvas API via a Web Worker for fast, off-main-thread JPEG export.
- **Pixo page (`/pixo`)** — Uses [Pixo](https://docs.rs/pixo/latest/pixo/guides/wasm/index.html), a Rust-based JPEG encoder compiled to WebAssembly.

## Features

- **100% Client-Side** — All compression runs in your browser. Images never leave your device.
- **Two Compression Engines** — Choose between Canvas API (Web Worker + OffscreenCanvas) and Pixo WASM (Rust encoder).
- **Supports JPG, JPEG, PNG** — Accepts the most common image formats.
- **Adjustable Quality Slider** — Control the compression quality in real time.
- **Mobile-Resilient** — Handles stale file handles, memory pressure, and progressive-retry decoding for large images on mobile devices.
- **Side-by-Side Preview** (Canvas page) — Compare original and compressed images before downloading.
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
│   ├── index.tsx              # Hono app with server-rendered layout + routes
│   ├── renderer.tsx           # JSX renderer (head, meta, scripts)
│   ├── client.tsx             # Canvas page client (Web Worker compression)
│   ├── pixoClient.tsx         # Pixo page client (WASM compression)
│   ├── compressWorker.ts      # Web Worker for off-thread Canvas compression
│   ├── style.css              # Tailwind CSS + daisyUI
│   └── utils/
│       ├── imageUtils.ts      # Shared pure utilities (dimensions, formatting)
│       ├── imageUtils.test.ts # Unit tests for imageUtils
│       ├── pixoUtils.ts       # Pixo-specific utilities (rgbaToRgb, constants)
│       ├── pixoUtils.test.ts  # Unit tests for pixoUtils
│       └── pixo-wasm/         # Pixo WASM bindings (Rust encoder)
├── vite.config.ts             # Vite + Vitest config
├── tsconfig.json
├── wrangler.jsonc             # Cloudflare Workers config
└── package.json
```

## How It Works

The server (`index.tsx`) renders a static HTML shell with Hono SSR. Each page has a `<div>` mount point where the corresponding client script hydrates an interactive component using `hono/jsx/dom` with hooks (`useState`, `useEffect`, `useRef`). All processing happens in-browser — no network requests are made after the initial page load.

### Shared: Stale File Handle Mitigation

On mobile Safari/WebKit, a `File` handle from `<input type="file">` can become invalid between async operations (memory pressure, tab backgrounding). Both pages read the selected file into an in-memory `Blob` **immediately** in `handleFileSelect` — while the handle is guaranteed valid. All subsequent operations (preview, header parse, compression) use this `Blob`, which never goes stale.

### Canvas Page (`/`) — `client.tsx`

1. **File selection** — The file is validated (type + size) and read into an in-memory `Blob`.
2. **Preview + dimension reading** — A blob URL is created for the `<img>` preview. Dimensions are parsed from the file header bytes (PNG IHDR or JPEG SOF marker) without decoding the image — virtually zero memory overhead.
3. **Compression via Web Worker** — `compressWorker.ts` runs off the main thread:
   - `createImageBitmap(blob, { resizeWidth, resizeHeight })` decodes directly into a capped-resolution bitmap — full-resolution pixels never touch memory.
   - `OffscreenCanvas.convertToBlob({ type: "image/jpeg", quality })` exports the JPEG.
4. **Main-thread fallback** — If the Web Worker or `OffscreenCanvas` is unavailable, compression falls back to `<img>.decode()` + a regular `<canvas>.toBlob()` on the main thread.
5. **Quality range** — 0.1 to 1.0 (Canvas API's native quality parameter).

### Pixo Page (`/pixo`) — `pixoClient.tsx`

1. **File selection** — Same immediate-read `Blob` pattern as the Canvas page.
2. **Dimension reading** (for UI display only — not blocking compression):
   - **Fast path**: Parse the first 256 KB of the file header for PNG IHDR or JPEG SOF.
   - **Fallback**: If the SOF marker is beyond 256 KB (large EXIF), scan the entire compressed file.
3. **Pixel extraction** with progressive retry for mobile:
   - `createImageBitmap(blob, { resizeWidth, resizeHeight })` at a capped resolution.
   - Tries 4096 → 2048 → 1024 max dimension. Each halving reduces decoded-pixel memory by 4x, allowing mobile devices with tight memory budgets to still process the image.
   - Canvas `getImageData()` extracts RGBA pixels, then `rgbaToRgb()` strips the alpha channel (Pixo expects 3-channel RGB).
4. **WASM encoding** — The Pixo encoder (`pixo_bg.wasm`) is a Rust-based JPEG encoder compiled to WebAssembly. It runs `encodeJpeg(rgb, width, height, preset, quality, ...)` entirely in-browser.
5. **Quality range** — 1 to 100 (Pixo's native integer range).
6. **No preview of compressed result** — The Pixo page shows compression stats (size, ratio, savings) but not a side-by-side preview, keeping memory usage lower on mobile.

## License

MIT

# Image Compressor

A free, local-first image compression web app with two compression engines. Compress JPG, JPEG, and PNG images directly in your browser — no files are ever uploaded to a server.

- **Canvas page (`/`)** — Uses the HTML Canvas API via a Web Worker for fast, off-main-thread JPEG export.
- **Pixo page (`/pixo`)** — Uses [Pixo](https://docs.rs/pixo/latest/pixo/guides/wasm/index.html), a Rust-based JPEG encoder compiled to WebAssembly.

## Features

- **100% Client-Side** — All compression runs in your browser. Images never leave your device.
- **Two Compression Engines** — Choose between Canvas API (Web Worker + OffscreenCanvas) and Pixo WASM (Rust encoder).
- **Supports JPG, JPEG, PNG** — Accepts the most common image formats.
- **Adjustable Quality Slider** — Control the compression quality in real time.
- **Mobile-Resilient** — Decode fallback chain (`createImageBitmap` → `<img>` element), progressive canvas-size retry, and immediate event-handler file I/O for mobile compatibility.
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

### Shared: Mobile File Handle & Decode Strategy

On mobile browsers (iOS Safari, Chrome Android), a `File` handle from `<input type="file">` can reference a `content://` URI that becomes unreadable after the event handler's task completes. Both pages start file I/O **immediately inside `handleFileSelect`** — in the same task as the event handler — so the browser begins reading data before the handle can expire.

Image decoding uses a **fallback chain** for maximum mobile compatibility:

1. **`createImageBitmap(data)`** (no options) — fast, GPU-backed, off-main-thread. Fails on some mobile browsers due to stale handles, unsupported formats, or browser bugs.
2. **`<img>` element via Object URL** — oldest and most universally supported decode path. Decodes on the main thread but works everywhere the preview `<img>` works.

### Canvas Page (`/`) — `client.tsx`

1. **File selection** — The file is validated (type + size) and read into an in-memory `Blob`.
2. **Preview + dimension reading** — A blob URL is created for the `<img>` preview. Dimensions are parsed from the file header bytes (PNG IHDR or JPEG SOF marker) without decoding the image — virtually zero memory overhead.
3. **Compression via Web Worker** — `compressWorker.ts` runs off the main thread:
   - `createImageBitmap(blob, { resizeWidth, resizeHeight })` decodes directly into a capped-resolution bitmap — full-resolution pixels never touch memory.
   - `OffscreenCanvas.convertToBlob({ type: "image/jpeg", quality })` exports the JPEG.
4. **Main-thread fallback** — If the Web Worker or `OffscreenCanvas` is unavailable, compression falls back to `<img>.decode()` + a regular `<canvas>.toBlob()` on the main thread.
5. **Quality range** — 0.1 to 1.0 (Canvas API's native quality parameter).

### Pixo Page (`/pixo`) — `pixoClient.tsx`

1. **File selection** — Validated and decoded immediately in `handleFileSelect` (not in a deferred `useEffect`). WASM init runs in parallel via `Promise.all`.
2. **Decode + pixel extraction** with fallback chain and progressive retry:
   - `decodeImage(blob)` tries `createImageBitmap` first, falls back to `<img>` element via Object URL.
   - Original dimensions come from the decoded source (`bitmap.width`/`height` or `img.naturalWidth`/`height`).
   - The decoded image is drawn to a **scaled canvas** (`drawImage` with target dimensions). Progressive retry tries 4096 → 2048 → 1024 max canvas size for devices with tight canvas limits.
   - Canvas `getImageData()` extracts RGBA pixels, then `rgbaToRgb()` strips the alpha channel (Pixo expects 3-channel RGB).
3. **"Decode once, compress many"** — Pixels are extracted once per file and stored in memory. Quality slider changes only re-run the WASM encoder (debounced 300 ms), never re-decode.
4. **WASM encoding** — The Pixo encoder (`pixo_bg.wasm`) is a Rust-based JPEG encoder compiled to WebAssembly. It runs `encodeJpeg(rgb, width, height, preset, quality, ...)` entirely in-browser.
5. **Quality range** — 1 to 100 (Pixo's native integer range).
6. **No preview of compressed result** — The Pixo page shows compression stats (size, ratio, savings) but not a side-by-side preview, keeping memory usage lower on mobile.

## Known Limitations

### Mobile Browser Compatibility

While this app works on mobile devices, there are some inherent limitations with client-side image processing on phones and tablets:

- **Image loading may occasionally fail.** Mobile browsers impose stricter resource limits than desktop browsers. `createImageBitmap` — the preferred decode API — can fail on mobile due to stale file handles, memory pressure, HEIF images presented as JPEG, or browser-specific bugs. The app falls back to an `<img>` element decode path, but even this may fail under tight memory conditions or with very large images.
- **Very large images (> 20 MP) may cause slowness or failure.** Mobile devices have less RAM and stricter per-tab memory limits. The full-resolution image must be decoded into memory before it can be drawn to a scaled canvas. On older or low-end devices, this can trigger out-of-memory errors.
- **iOS Safari has limited `createImageBitmap` support.** Safari does not support `createImageBitmap` resize options (`resizeWidth`, `resizeHeight`, `resizeQuality`) and may fail even with the no-options call in some scenarios. The `<img>` element fallback handles most of these cases.
- **HEIF/HEIC images are not supported.** Some mobile cameras save photos in HEIF format by default. Even if the file has a `.jpg` extension, the actual data may be HEIF, which browsers cannot decode via canvas APIs. Convert to JPEG or PNG before compressing.
- **Background tabs may lose file references.** If you switch away from the browser tab after selecting a file but before compression completes, the OS may revoke the file handle. Re-select the file if this happens.

For the most reliable experience, use a desktop browser (Chrome, Firefox, Safari, or Edge).

## License

MIT

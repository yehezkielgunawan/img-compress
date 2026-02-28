/**
 * Web Worker for Pixo WASM JPEG encoding.
 *
 * Runs WASM encoding off the main thread so the UI stays responsive,
 * especially on mobile devices with limited CPU budgets.
 *
 * Pattern: create-and-terminate per encode call (same as compressWorker.ts).
 * WASM re-init overhead per worker is acceptable because:
 *   - V8 caches compiled WASM modules (streaming compilation cache)
 *   - The 300ms debounce in pixoClient limits call frequency
 *   - Correctness > performance for mobile reliability
 */

import initPixo, { encodeJpeg } from "./utils/pixo-wasm/pixo";

export interface PixoEncodeRequest {
	rgb: Uint8Array;
	width: number;
	height: number;
	quality: number;
}

export interface PixoEncodeSuccess {
	jpegBytes: ArrayBuffer;
}

export interface PixoEncodeError {
	error: string;
}

export type PixoEncodeResponse = PixoEncodeSuccess | PixoEncodeError;

// Lazy WASM init — cached within this worker's lifetime.
// If the worker is reused for multiple encodes (future optimization),
// WASM only initializes once.
let pixoReady: Promise<void> | null = null;

self.onmessage = async (e: MessageEvent<PixoEncodeRequest>) => {
	const { rgb, width, height, quality } = e.data;

	try {
		if (!pixoReady) {
			pixoReady = initPixo().then(() => undefined);
		}
		await pixoReady;

		const jpegBytes = encodeJpeg(
			rgb,
			width,
			height,
			2, // color_type: Rgb
			quality,
			1, // preset: balanced
			true, // subsampling_420
		);

		// Transfer the underlying ArrayBuffer (zero-copy) to the main thread.
		// We must copy the Uint8Array first because the WASM return value
		// references WASM linear memory which cannot be transferred.
		const buffer = new Uint8Array(jpegBytes).buffer;
		const response: PixoEncodeSuccess = { jpegBytes: buffer };
		self.postMessage(response, [buffer]);
	} catch (err) {
		const response: PixoEncodeError = {
			error:
				err instanceof Error ? err.message : "WASM encoding failed in worker",
		};
		self.postMessage(response);
	}
};

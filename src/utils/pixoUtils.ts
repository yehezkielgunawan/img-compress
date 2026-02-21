/**
 * Pixo WASM compression utilities
 * Pure functions and constants for Pixo-based image processing
 */

// Constants (UPPER_SNAKE_CASE per AGENTS.md)
export const PIXO_DEFAULT_QUALITY = 85;
export const PIXO_MIN_QUALITY = 1;
export const PIXO_MAX_QUALITY = 100;

/**
 * Progressive max-dimension list for pixel extraction.
 * On desktop 4096 is fine; on mobile the browser may OOM, so we retry
 * at 2048, then 1024.  Each halving reduces decoded-pixel memory by 4×.
 */
export const DECODE_MAX_DIMENSIONS = [4096, 2048, 1024] as const;

/**
 * Convert RGBA pixel data to RGB by stripping the alpha channel.
 * Pixo's JPEG encoder expects 3-channel RGB input, but Canvas
 * `getImageData()` returns 4-channel RGBA.
 *
 * @param rgba - RGBA pixel data (4 bytes per pixel)
 * @returns RGB pixel data (3 bytes per pixel)
 */
export const rgbaToRgb = (rgba: Uint8ClampedArray): Uint8Array => {
	const pixelCount = rgba.length / 4;
	const rgb = new Uint8Array(pixelCount * 3);
	for (let i = 0, j = 0; i < rgba.length; i += 4, j += 3) {
		rgb[j] = rgba[i];
		rgb[j + 1] = rgba[i + 1];
		rgb[j + 2] = rgba[i + 2];
	}
	return rgb;
};

/**
 * Validate that a Pixo quality value is within the acceptable range (1-100).
 * @param quality - Quality value to validate
 * @returns Whether the quality is valid
 */
export const isValidPixoQuality = (quality: number): boolean => {
	return (
		Number.isInteger(quality) &&
		quality >= PIXO_MIN_QUALITY &&
		quality <= PIXO_MAX_QUALITY
	);
};

/**
 * Clamp a Pixo quality value to the acceptable range (1-100).
 * @param quality - Quality value to clamp
 * @returns Clamped integer quality value
 */
export const clampPixoQuality = (quality: number): number => {
	return Math.max(
		PIXO_MIN_QUALITY,
		Math.min(PIXO_MAX_QUALITY, Math.round(quality)),
	);
};

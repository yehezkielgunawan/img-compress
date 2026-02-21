import { describe, expect, it } from "vitest";

import {
	clampPixoQuality,
	DECODE_MAX_DIMENSIONS,
	isValidPixoQuality,
	PIXO_DEFAULT_QUALITY,
	PIXO_MAX_QUALITY,
	PIXO_MIN_QUALITY,
	rgbaToRgb,
} from "./pixoUtils";

describe("pixoUtils", () => {
	describe("constants", () => {
		it("should have correct PIXO_DEFAULT_QUALITY", () => {
			expect(PIXO_DEFAULT_QUALITY).toBe(85);
		});

		it("should have correct PIXO_MIN_QUALITY", () => {
			expect(PIXO_MIN_QUALITY).toBe(1);
		});

		it("should have correct PIXO_MAX_QUALITY", () => {
			expect(PIXO_MAX_QUALITY).toBe(100);
		});

		it("should have min < default < max", () => {
			expect(PIXO_MIN_QUALITY).toBeLessThan(PIXO_DEFAULT_QUALITY);
			expect(PIXO_DEFAULT_QUALITY).toBeLessThan(PIXO_MAX_QUALITY);
		});

		it("should have DECODE_MAX_DIMENSIONS in descending order", () => {
			expect(DECODE_MAX_DIMENSIONS.length).toBeGreaterThanOrEqual(2);
			for (let i = 1; i < DECODE_MAX_DIMENSIONS.length; i++) {
				expect(DECODE_MAX_DIMENSIONS[i]).toBeLessThan(
					DECODE_MAX_DIMENSIONS[i - 1],
				);
			}
		});

		it("should have DECODE_MAX_DIMENSIONS with reasonable values", () => {
			// First entry should be the desktop max (4096)
			expect(DECODE_MAX_DIMENSIONS[0]).toBe(4096);
			// All entries must be positive
			for (const dim of DECODE_MAX_DIMENSIONS) {
				expect(dim).toBeGreaterThan(0);
			}
		});
	});

	describe("rgbaToRgb", () => {
		it("should convert a single RGBA pixel to RGB", () => {
			const rgba = new Uint8ClampedArray([255, 128, 64, 200]);
			const rgb = rgbaToRgb(rgba);
			expect(rgb).toBeInstanceOf(Uint8Array);
			expect(rgb.length).toBe(3);
			expect(rgb[0]).toBe(255);
			expect(rgb[1]).toBe(128);
			expect(rgb[2]).toBe(64);
		});

		it("should strip the alpha channel from multiple pixels", () => {
			const rgba = new Uint8ClampedArray([
				255,
				0,
				0,
				255, // red, fully opaque
				0,
				255,
				0,
				128, // green, half transparent
				0,
				0,
				255,
				0, // blue, fully transparent
			]);
			const rgb = rgbaToRgb(rgba);
			expect(rgb.length).toBe(9);
			// pixel 1: red
			expect(rgb[0]).toBe(255);
			expect(rgb[1]).toBe(0);
			expect(rgb[2]).toBe(0);
			// pixel 2: green
			expect(rgb[3]).toBe(0);
			expect(rgb[4]).toBe(255);
			expect(rgb[5]).toBe(0);
			// pixel 3: blue
			expect(rgb[6]).toBe(0);
			expect(rgb[7]).toBe(0);
			expect(rgb[8]).toBe(255);
		});

		it("should return an empty Uint8Array for empty input", () => {
			const rgba = new Uint8ClampedArray([]);
			const rgb = rgbaToRgb(rgba);
			expect(rgb.length).toBe(0);
		});

		it("should correctly handle all-black pixels", () => {
			const rgba = new Uint8ClampedArray([0, 0, 0, 255, 0, 0, 0, 0]);
			const rgb = rgbaToRgb(rgba);
			expect(rgb.length).toBe(6);
			expect(Array.from(rgb)).toEqual([0, 0, 0, 0, 0, 0]);
		});

		it("should correctly handle all-white pixels", () => {
			const rgba = new Uint8ClampedArray([255, 255, 255, 255]);
			const rgb = rgbaToRgb(rgba);
			expect(Array.from(rgb)).toEqual([255, 255, 255]);
		});

		it("should produce output length that is 3/4 of input length", () => {
			// 10 pixels = 40 bytes RGBA -> 30 bytes RGB
			const rgba = new Uint8ClampedArray(40);
			const rgb = rgbaToRgb(rgba);
			expect(rgb.length).toBe(30);
		});

		it("should ignore alpha regardless of its value", () => {
			// Same RGB values, different alpha
			const rgba1 = new Uint8ClampedArray([100, 150, 200, 0]);
			const rgba2 = new Uint8ClampedArray([100, 150, 200, 255]);
			const rgb1 = rgbaToRgb(rgba1);
			const rgb2 = rgbaToRgb(rgba2);
			expect(Array.from(rgb1)).toEqual(Array.from(rgb2));
		});
	});

	describe("isValidPixoQuality", () => {
		it("should return true for minimum quality", () => {
			expect(isValidPixoQuality(PIXO_MIN_QUALITY)).toBe(true);
		});

		it("should return true for maximum quality", () => {
			expect(isValidPixoQuality(PIXO_MAX_QUALITY)).toBe(true);
		});

		it("should return true for default quality", () => {
			expect(isValidPixoQuality(PIXO_DEFAULT_QUALITY)).toBe(true);
		});

		it("should return false for zero", () => {
			expect(isValidPixoQuality(0)).toBe(false);
		});

		it("should return false for negative values", () => {
			expect(isValidPixoQuality(-1)).toBe(false);
		});

		it("should return false for values above max", () => {
			expect(isValidPixoQuality(101)).toBe(false);
		});

		it("should return false for non-integer values", () => {
			expect(isValidPixoQuality(50.5)).toBe(false);
		});

		it("should return true for integer values within range", () => {
			expect(isValidPixoQuality(1)).toBe(true);
			expect(isValidPixoQuality(50)).toBe(true);
			expect(isValidPixoQuality(100)).toBe(true);
		});
	});

	describe("clampPixoQuality", () => {
		it("should return the same value when within range", () => {
			expect(clampPixoQuality(50)).toBe(50);
			expect(clampPixoQuality(1)).toBe(1);
			expect(clampPixoQuality(100)).toBe(100);
		});

		it("should clamp values below minimum to minimum", () => {
			expect(clampPixoQuality(0)).toBe(PIXO_MIN_QUALITY);
			expect(clampPixoQuality(-10)).toBe(PIXO_MIN_QUALITY);
		});

		it("should clamp values above maximum to maximum", () => {
			expect(clampPixoQuality(101)).toBe(PIXO_MAX_QUALITY);
			expect(clampPixoQuality(999)).toBe(PIXO_MAX_QUALITY);
		});

		it("should round float values to nearest integer", () => {
			expect(clampPixoQuality(50.4)).toBe(50);
			expect(clampPixoQuality(50.6)).toBe(51);
		});

		it("should round and clamp simultaneously", () => {
			expect(clampPixoQuality(0.4)).toBe(PIXO_MIN_QUALITY);
			expect(clampPixoQuality(100.6)).toBe(PIXO_MAX_QUALITY);
		});
	});
});

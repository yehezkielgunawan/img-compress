import {
	calculateScaledDimensions,
	clampQuality,
	MAX_CANVAS_DIMENSION,
} from "./utils/imageUtils";

export interface CompressRequest {
	file: Blob;
	quality: number;
	originalWidth: number;
	originalHeight: number;
}

export interface CompressSuccess {
	blob: Blob;
	width: number;
	height: number;
}

export interface CompressError {
	error: string;
}

export type CompressResponse = CompressSuccess | CompressError;

self.onmessage = async (e: MessageEvent<CompressRequest>) => {
	try {
		const { file, quality, originalWidth, originalHeight } = e.data;
		const validQuality = clampQuality(quality);

		const { width, height } = calculateScaledDimensions(
			originalWidth,
			originalHeight,
			MAX_CANVAS_DIMENSION,
		);

		const bitmap = await createImageBitmap(file, {
			resizeWidth: width,
			resizeHeight: height,
			resizeQuality: "high",
		});

		const canvas = new OffscreenCanvas(width, height);
		const ctx = canvas.getContext("2d");

		if (!ctx) {
			bitmap.close();
			throw new Error("Failed to get canvas context");
		}

		ctx.drawImage(bitmap, 0, 0);
		bitmap.close();

		const blob = await canvas.convertToBlob({
			type: "image/jpeg",
			quality: validQuality,
		});

		const response: CompressSuccess = { blob, width, height };
		self.postMessage(response);
	} catch (err) {
		const response: CompressError = {
			error:
				err instanceof Error ? err.message : "Compression failed in worker",
		};
		self.postMessage(response);
	}
};

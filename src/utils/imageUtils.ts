/**
 * Image compression utilities
 * Pure functions for image processing that can be tested independently
 */

// Constants (UPPER_SNAKE_CASE per AGENTS.md)
export const SUPPORTED_TYPES = [
	"image/jpeg",
	"image/jpg",
	"image/png",
] as const;
export const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15 MB in bytes
export const MAX_CANVAS_DIMENSION = 4096;
export const DEFAULT_QUALITY = 0.8;
export const MIN_QUALITY = 0.1;
export const MAX_QUALITY = 1.0;

export interface ImageDimensions {
	width: number;
	height: number;
}

/**
 * Check if a file type is supported for compression
 * @param fileType - The MIME type of the file
 * @returns Whether the file type is supported
 */
export const isFileTypeSupported = (fileType: string): boolean => {
	return SUPPORTED_TYPES.includes(fileType as (typeof SUPPORTED_TYPES)[number]);
};

/**
 * Check if a file size is within the allowed limit
 * @param fileSize - The file size in bytes
 * @param maxSize - Maximum allowed size in bytes (defaults to MAX_FILE_SIZE)
 * @returns Whether the file size is within the limit
 */
export const isFileSizeValid = (
	fileSize: number,
	maxSize: number = MAX_FILE_SIZE,
): boolean => {
	return fileSize > 0 && fileSize <= maxSize;
};

/**
 * Calculate scaled dimensions that fit within maxDimension while preserving aspect ratio.
 * Used internally to cap canvas size for mobile compatibility.
 */
export const calculateScaledDimensions = (
	width: number,
	height: number,
	maxDimension: number = MAX_CANVAS_DIMENSION,
): ImageDimensions => {
	if (width <= 0 || height <= 0) {
		throw new Error("Width and height must be positive numbers");
	}

	if (width <= maxDimension && height <= maxDimension) {
		return { width, height };
	}

	if (width > height) {
		return {
			width: maxDimension,
			height: Math.round((height / width) * maxDimension),
		};
	}

	return {
		width: Math.round((width / height) * maxDimension),
		height: maxDimension,
	};
};

/**
 * Read image dimensions from PNG/JPEG file headers without decoding the image.
 * Only reads the first few KB of the file — virtually zero memory overhead.
 * Works even on mobile devices that can't decode the full image.
 */
export const getImageDimensionsFromHeader = async (
	file: File,
): Promise<ImageDimensions> => {
	const slice = file.slice(0, 65536);
	const buffer = await slice.arrayBuffer();
	const view = new DataView(buffer);

	if (
		buffer.byteLength >= 24 &&
		view.getUint8(0) === 0x89 &&
		view.getUint8(1) === 0x50
	) {
		const width = view.getUint32(16, false);
		const height = view.getUint32(20, false);
		return { width, height };
	}

	if (
		buffer.byteLength >= 2 &&
		view.getUint8(0) === 0xff &&
		view.getUint8(1) === 0xd8
	) {
		let offset = 2;
		while (offset + 4 < buffer.byteLength) {
			if (view.getUint8(offset) !== 0xff) break;
			const marker = view.getUint8(offset + 1);
			if (
				marker >= 0xc0 &&
				marker <= 0xcf &&
				marker !== 0xc4 &&
				marker !== 0xc8 &&
				marker !== 0xcc
			) {
				if (offset + 9 <= buffer.byteLength) {
					const height = view.getUint16(offset + 5, false);
					const width = view.getUint16(offset + 7, false);
					return { width, height };
				}
			}
			const segmentLength = view.getUint16(offset + 2, false);
			offset += 2 + segmentLength;
		}
	}

	throw new Error("Could not read image dimensions from file header");
};

/**
 * Format file size in human readable format
 * @param bytes - Size in bytes
 * @returns Formatted string (e.g., "1.5 MB")
 */
export const formatFileSize = (bytes: number): string => {
	if (bytes < 0) {
		throw new Error("Bytes cannot be negative");
	}

	if (bytes === 0) return "0 Bytes";

	const k = 1024;
	const sizes = ["Bytes", "KB", "MB", "GB"];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	const clampedIndex = Math.min(i, sizes.length - 1);

	return (
		parseFloat((bytes / k ** clampedIndex).toFixed(2)) +
		" " +
		sizes[clampedIndex]
	);
};

/**
 * Calculate compression ratio as a percentage
 * @param originalSize - Original file size in bytes
 * @param compressedSize - Compressed file size in bytes
 * @returns Compression ratio as a formatted string (e.g., "45.5")
 */
export const getCompressionRatio = (
	originalSize: number,
	compressedSize: number,
): string => {
	if (originalSize <= 0) {
		throw new Error("Original size must be a positive number");
	}

	if (compressedSize < 0) {
		throw new Error("Compressed size cannot be negative");
	}

	const ratio = ((originalSize - compressedSize) / originalSize) * 100;
	return ratio.toFixed(1);
};

/**
 * Validate quality value is within acceptable range
 * @param quality - Quality value to validate
 * @returns Whether the quality is valid
 */
export const isValidQuality = (quality: number): boolean => {
	return quality >= MIN_QUALITY && quality <= MAX_QUALITY;
};

/**
 * Clamp quality value to acceptable range
 * @param quality - Quality value to clamp
 * @returns Clamped quality value
 */
export const clampQuality = (quality: number): number => {
	return Math.max(MIN_QUALITY, Math.min(MAX_QUALITY, quality));
};

/**
 * Generate compressed filename from original filename
 * @param originalFilename - Original file name
 * @param suffix - Suffix to add before extension (default: '_compressed')
 * @returns New filename with suffix and .jpg extension
 */
export const generateCompressedFilename = (
	originalFilename: string,
	suffix: string = "_compressed",
): string => {
	const nameWithoutExt = originalFilename.replace(/\.[^/.]+$/, "");
	return `${nameWithoutExt}${suffix}.jpg`;
};

/**
 * Calculate bytes saved from compression
 * @param originalSize - Original file size in bytes
 * @param compressedSize - Compressed file size in bytes
 * @returns Bytes saved (can be negative if compression increased size)
 */
export const calculateBytesSaved = (
	originalSize: number,
	compressedSize: number,
): number => {
	return originalSize - compressedSize;
};

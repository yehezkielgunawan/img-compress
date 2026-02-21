/** @jsxImportSource hono/jsx/dom */

import { useEffect, useRef, useState } from "hono/jsx";
import { render } from "hono/jsx/dom";

import {
  calculateBytesSaved,
  calculateScaledDimensions,
  formatFileSize,
  generateCompressedFilename,
  getCompressionRatio,
  getImageDimensionsFromHeader,
  isFileSizeValid,
  isFileTypeSupported,
  MAX_FILE_SIZE,
} from "./utils/imageUtils";
import initPixo, { encodeJpeg } from "./utils/pixo-wasm/pixo";
import {
  DECODE_MAX_DIMENSIONS,
  PIXO_DEFAULT_QUALITY,
  PIXO_MAX_QUALITY,
  PIXO_MIN_QUALITY,
  rgbaToRgb,
} from "./utils/pixoUtils";

interface PixoResult {
  compressedBlob: Blob;
  compressedSize: number;
  originalSize: number;
  originalWidth: number;
  originalHeight: number;
  width: number;
  height: number;
}

let pixoReady: Promise<void> | null = null;

const ensurePixoInit = (): Promise<void> => {
  if (!pixoReady) {
    pixoReady = initPixo().then(() => undefined);
  }
  return pixoReady;
};

/**
 * Extract raw pixel data from a File using resize-during-decode + hidden canvas.
 * Returns RGB pixel data at a capped resolution.
 *
 * Dimension reading fallback chain (no full-resolution decode):
 *   1. Fast header parse — 256 KB slice, zero decode memory
 *   2. Full-file header scan — reads compressed bytes (≤15 MB), still no decode
 *
 * Pixel extraction with progressive retry:
 *   Tries 4096 → 2048 → 1024 max dimension so mobile devices with tight
 *   memory budgets can still decode the image at a smaller resolution.
 */
const extractPixels = async (
  data: Blob,
): Promise<{
  rgb: Uint8Array;
  width: number;
  height: number;
  originalWidth: number;
  originalHeight: number;
}> => {
  // ── 1. Determine original dimensions (never full-res decode) ────────
  let originalWidth: number;
  let originalHeight: number;

  try {
    // Fast path: first 256 KB covers most PNGs and many JPEGs
    const dims = await getImageDimensionsFromHeader(data);
    originalWidth = dims.width;
    originalHeight = dims.height;
  } catch {
    // Slow path: scan the entire compressed file for SOF / IHDR.
    // Safe on mobile — this is compressed data (≤ 15 MB), not decoded pixels.
    const dims = await getImageDimensionsFromHeader(data, data.size);
    originalWidth = dims.width;
    originalHeight = dims.height;
  }

  // ── 2. Decode at a capped resolution, retrying smaller on OOM ──────
  for (const maxDim of DECODE_MAX_DIMENSIONS) {
    const { width, height } = calculateScaledDimensions(
      originalWidth,
      originalHeight,
      maxDim,
    );

    try {
      const bitmap = await createImageBitmap(data, {
        resizeWidth: width,
        resizeHeight: height,
        resizeQuality: "high",
      });

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        bitmap.close();
        throw new Error("Failed to get canvas context");
      }

      ctx.drawImage(bitmap, 0, 0);
      bitmap.close();

      const imageData = ctx.getImageData(0, 0, width, height);
      const rgb = rgbaToRgb(imageData.data);

      // Free canvas memory immediately
      canvas.width = 0;
      canvas.height = 0;

      return { rgb, width, height, originalWidth, originalHeight };
    } catch (err) {
      // If this was the last (smallest) attempt, propagate the error
      if (maxDim === DECODE_MAX_DIMENSIONS[DECODE_MAX_DIMENSIONS.length - 1]) {
        throw err;
      }
      // Otherwise try the next smaller dimension
    }
  }

  // TypeScript: unreachable, but satisfies the compiler
  throw new Error("Failed to decode image at any supported resolution");
};

/**
 * Compress an image using Pixo WASM encoder.
 * Reads dimensions internally — no external dimension state required.
 * quality: 1-100, preset 1 = balanced, subsampling420 = true for smaller files.
 */
const compressWithPixo = async (
  data: Blob,
  quality: number,
): Promise<PixoResult> => {
  await ensurePixoInit();

  const { rgb, width, height, originalWidth, originalHeight } =
    await extractPixels(data);

  const jpegBytes = encodeJpeg(rgb, width, height, 2, quality, 1, true);
  const blob = new Blob([new Uint8Array(jpegBytes)], { type: "image/jpeg" });

  return {
    compressedBlob: blob,
    compressedSize: blob.size,
    originalSize: data.size,
    originalWidth,
    originalHeight,
    width,
    height,
  };
};

const downloadBlob = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

// Sub-components

const LoadingOverlay = () => (
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-base-300/80">
    <div class="text-center">
      <span class="loading loading-spinner loading-lg text-primary" />
      <p class="mt-4 font-semibold text-base-content">
        Compressing with Pixo WASM...
      </p>
    </div>
  </div>
);

const ErrorToast = ({
  message,
  onDismiss,
}: {
  message: string;
  onDismiss: () => void;
}) => {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 3000);
    return () => clearTimeout(timer);
  }, [message]);

  return (
    <div class="toast toast-top toast-center z-50">
      <div class="alert alert-error">
        <span>{message}</span>
      </div>
    </div>
  );
};

// Main Component

export const PixoCompressor = () => {
  const [file, setFile] = useState<File | null>(null);
  const [fileData, setFileData] = useState<Blob | null>(null);
  const [quality, setQuality] = useState(PIXO_DEFAULT_QUALITY);
  const [originalUrl, setOriginalUrl] = useState("");
  const [originalDimensions, setOriginalDimensions] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [result, setResult] = useState<PixoResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [previewFailed, setPreviewFailed] = useState(false);
  const [error, setError] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Effect: Create preview URL + try reading dimensions for early UI display
  useEffect(() => {
    if (!fileData) return;
    const url = URL.createObjectURL(fileData);
    setOriginalUrl(url);
    setOriginalDimensions(null);
    setPreviewFailed(false);

    // Opportunistic early dimension read for UI display only.
    // Not blocking — compression reads dimensions internally.
    getImageDimensionsFromHeader(fileData)
      .then((dims) => setOriginalDimensions(dims))
      .catch(() => {});

    return () => URL.revokeObjectURL(url);
  }, [fileData]);

  // Effect: Compress when file data or quality changes (debounced).
  // Dimensions are read internally by compressWithPixo — no dependency on
  // originalDimensions, so compression works even when preview/header fail.
  useEffect(() => {
    if (!fileData) return;

    let cancelled = false;
    setIsLoading(true);

    const timer = setTimeout(async () => {
      try {
        const newResult = await compressWithPixo(fileData, quality);
        if (!cancelled) {
          setResult(newResult);
          // Populate dimensions for UI display if not already set
          setOriginalDimensions(
            (prev) =>
              prev ?? {
                width: newResult.originalWidth,
                height: newResult.originalHeight,
              },
          );
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Compression failed");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [fileData, quality]);

  // Handlers

  const handleFileSelect = async (selectedFile: File): Promise<void> => {
    if (!isFileTypeSupported(selectedFile.type)) {
      setError("Unsupported file type. Please use JPG, JPEG, or PNG.");
      return;
    }
    if (!isFileSizeValid(selectedFile.size)) {
      setError(`File size exceeds ${formatFileSize(MAX_FILE_SIZE)} limit.`);
      return;
    }

    // Read the file into memory immediately while the handle is guaranteed
    // valid. Mobile browsers can invalidate File handles between async ops.
    // The in-memory Blob never goes stale.
    try {
      const buffer = await selectedFile.arrayBuffer();
      const blob = new Blob([buffer], { type: selectedFile.type });
      setFile(selectedFile);
      setFileData(blob);
      setResult(null);
      setError("");
    } catch {
      setError("Failed to read file. Please try selecting the file again.");
    }
  };

  const handleDrop = (e: Event): void => {
    e.preventDefault();
    setIsDragging(false);
    const dragEvent = e as DragEvent;
    const droppedFile = dragEvent.dataTransfer?.files[0];
    if (droppedFile) handleFileSelect(droppedFile);
  };

  const handleDownload = (): void => {
    if (result?.compressedBlob && file) {
      downloadBlob(
        result.compressedBlob,
        generateCompressedFilename(file.name),
      );
    }
  };

  const handleReset = (): void => {
    setFile(null);
    setFileData(null);
    setOriginalUrl("");
    setOriginalDimensions(null);
    setResult(null);
    setQuality(PIXO_DEFAULT_QUALITY);
    setPreviewFailed(false);
    setError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <>
      {/* Upload Card */}
      <div class="card bg-base-100 shadow-xl">
        <div class="card-body">
          <h2 class="card-title justify-center text-xl md:text-2xl">
            Upload Your Image
          </h2>
          <p class="text-center text-base-content/70 text-sm md:text-base">
            Compress with{" "}
            <a
              href="https://docs.rs/pixo/latest/pixo/guides/wasm/index.html"
              target="_blank"
              rel="noopener noreferrer"
              class="link link-primary"
            >
              Pixo WASM
            </a>{" "}
            — Rust-powered encoder compiled to WebAssembly
          </p>

          {/* Drop Zone */}
          <button
            type="button"
            class={`mt-4 w-full cursor-pointer rounded-xl border-2 border-dashed bg-transparent p-6 text-center transition-all duration-200 md:p-12 ${
              isDragging
                ? "border-primary bg-primary/10"
                : "border-base-300 hover:border-primary hover:bg-primary/5"
            }`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e: Event) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={(e: Event) => {
              e.preventDefault();
              setIsDragging(false);
            }}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png"
              class="hidden"
              onChange={(e: Event) => {
                const target = e.target as HTMLInputElement;
                const selected = target.files?.[0];
                if (selected) handleFileSelect(selected);
              }}
            />
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="mx-auto h-12 w-12 text-base-content/40 md:h-16 md:w-16"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            <p class="mt-4 text-base-content/60 text-sm md:text-base">
              Drag and drop your image here, or click to select
            </p>
            <p class="mt-2 text-base-content/40 text-xs">
              Supports JPG, JPEG, PNG (Max size: {formatFileSize(MAX_FILE_SIZE)}
              )
            </p>
          </button>

          {/* Quality Slider — 1-100 integer for Pixo */}
          <div class="mt-6">
            <label class="label flex gap-8" for="pixo-quality-slider">
              <span class="font-semibold">JPEG Quality</span>
              <span class="font-bold text-primary">{quality}%</span>
            </label>
            <input
              id="pixo-quality-slider"
              type="range"
              min={PIXO_MIN_QUALITY}
              max={PIXO_MAX_QUALITY}
              step="1"
              value={String(quality)}
              onInput={(e: Event) => {
                const val = (e.target as HTMLInputElement).value;
                setQuality(parseInt(val, 10));
              }}
              class="range range-primary"
            />
          </div>
        </div>
      </div>

      {/* Preview + Stats */}
      {file && (
        <div class="mt-8">
          {/* Original Preview — lightweight <img> with blob URL */}
          <div class="card bg-base-100 shadow-xl">
            <div class="card-body p-4 md:p-6">
              <h3 class="card-title text-base md:text-lg">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-5 w-5 text-warning"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path
                    fill-rule="evenodd"
                    d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z"
                    clip-rule="evenodd"
                  />
                </svg>
                Original Preview
              </h3>
              <div class="flex min-h-[200px] items-center justify-center rounded-lg bg-base-200 p-2 md:min-h-[300px] md:p-4">
                {previewFailed ? (
                  <div class="text-center text-base-content/50">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      class="mx-auto h-12 w-12"
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
                    <p class="mt-2 text-sm">
                      Preview unavailable (image too large for display)
                    </p>
                    <p class="text-xs">Compression still works normally</p>
                  </div>
                ) : (
                  <img
                    src={originalUrl}
                    onLoad={(e: Event) => {
                      const img = e.target as HTMLImageElement;
                      setOriginalDimensions(
                        (prev) =>
                          prev ?? {
                            width: img.naturalWidth,
                            height: img.naturalHeight,
                          },
                      );
                    }}
                    onError={() => setPreviewFailed(true)}
                    class="max-h-[200px] max-w-full rounded-lg object-contain md:max-h-[300px]"
                    alt="Original file preview"
                  />
                )}
              </div>
              <div class="mt-2 space-y-1 text-base-content/70 text-xs md:text-sm">
                <p>
                  <strong>Original Size:</strong> {formatFileSize(file.size)}
                </p>
                {originalDimensions && (
                  <p>
                    <strong>Dimensions:</strong> {originalDimensions.width} x{" "}
                    {originalDimensions.height}
                  </p>
                )}
                <p>
                  <strong>Type:</strong> {file.type}
                </p>
              </div>
            </div>
          </div>

          {/* Compression Stats — numbers only, no result preview */}
          {result && (
            <div class="card mt-4 bg-base-100 shadow-xl md:mt-6">
              <div class="card-body p-4 md:p-6">
                <h3 class="card-title text-base md:text-lg">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="h-5 w-5 text-success"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      fill-rule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clip-rule="evenodd"
                    />
                  </svg>
                  Compression Result
                </h3>
                <div class="stats stats-vertical md:stats-horizontal w-full shadow">
                  <div class="stat">
                    <div class="stat-title">Compressed Size</div>
                    <div class="stat-value text-accent text-lg md:text-2xl">
                      {formatFileSize(result.compressedSize)}
                    </div>
                    <div class="stat-desc">
                      Output: {result.width} x {result.height}
                    </div>
                  </div>
                  <div class="stat">
                    <div class="stat-title">Compression Ratio</div>
                    <div class="stat-value text-lg text-primary md:text-2xl">
                      {getCompressionRatio(
                        result.originalSize,
                        result.compressedSize,
                      )}
                      %
                    </div>
                    <div class="stat-desc">Size Reduced</div>
                  </div>
                  <div class="stat">
                    <div class="stat-title">Space Saved</div>
                    <div class="stat-value text-lg text-secondary md:text-2xl">
                      {formatFileSize(
                        Math.max(
                          0,
                          calculateBytesSaved(
                            result.originalSize,
                            result.compressedSize,
                          ),
                        ),
                      )}
                    </div>
                    <div class="stat-desc">Bytes Saved</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons — always visible once a file is selected */}
          <div class="mt-4 flex flex-col items-center justify-center gap-2 sm:flex-row md:mt-6">
            {result && (
              <button
                type="button"
                class="btn btn-primary btn-wide"
                onClick={handleDownload}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="mr-2 h-5 w-5"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path
                    fill-rule="evenodd"
                    d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"
                    clip-rule="evenodd"
                  />
                </svg>
                Download Compressed
              </button>
            )}
            <button
              type="button"
              class="btn btn-outline btn-wide"
              onClick={handleReset}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="mr-2 h-5 w-5"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  fill-rule="evenodd"
                  d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z"
                  clip-rule="evenodd"
                />
              </svg>
              Start Over
            </button>
          </div>
        </div>
      )}

      {/* Loading Overlay */}
      {isLoading && <LoadingOverlay />}

      {/* Error Toast */}
      {error && <ErrorToast message={error} onDismiss={() => setError("")} />}
    </>
  );
};

const pixoRoot = document.getElementById("pixo-root");
if (pixoRoot) {
  render(<PixoCompressor />, pixoRoot);
}

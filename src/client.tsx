/** @jsxImportSource hono/jsx/dom */

/**
 * Client-side image compressor using Hono JSX DOM
 * with hooks for state management and Canvas API for compression
 */

import { useEffect, useRef, useState } from "hono/jsx";
import { render } from "hono/jsx/dom";

import {
  calculateBytesSaved,
  calculateScaledDimensions,
  clampQuality,
  DEFAULT_QUALITY,
  formatFileSize,
  generateCompressedFilename,
  getCompressionRatio,
  isFileTypeSupported,
  MAX_DIMENSION,
} from "./utils/imageUtils";

// Types

interface CompressionResult {
  compressedUrl: string;
  compressedSize: number;
  originalSize: number;
  width: number;
  height: number;
}

/**
 * Compress an image file using HTML Canvas API
 * @param file - The image file to compress
 * @param quality - Quality from 0.1 to 1.0
 * @returns Promise with compression result
 */
const compressImage = (
  file: File,
  quality: number,
): Promise<CompressionResult> => {
  return new Promise((resolve, reject) => {
    if (!isFileTypeSupported(file.type)) {
      reject(new Error("Unsupported file type. Please use JPG, JPEG, or PNG."));
      return;
    }

    const validQuality = clampQuality(quality);
    const reader = new FileReader();

    reader.onload = (e) => {
      const img = new Image();

      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        if (!ctx) {
          reject(new Error("Failed to get canvas context"));
          return;
        }

        const { width, height } = calculateScaledDimensions(
          img.width,
          img.height,
          MAX_DIMENSION,
        );

        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error("Failed to compress image"));
              return;
            }

            resolve({
              compressedUrl: URL.createObjectURL(blob),
              compressedSize: blob.size,
              originalSize: file.size,
              width: Math.round(width),
              height: Math.round(height),
            });
          },
          "image/jpeg",
          validQuality,
        );
      };

      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = e.target?.result as string;
    };

    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
};

/**
 * Trigger download of a file from an object URL
 */
const downloadFile = (url: string, filename: string): void => {
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// Sub-components

const LoadingOverlay = () => (
  <div class="fixed inset-0 bg-base-300/80 z-50 flex items-center justify-center">
    <div class="text-center">
      <span class="loading loading-spinner loading-lg text-primary" />
      <p class="mt-4 text-base-content font-semibold">Compressing image...</p>
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

const ImageCompressor = () => {
  // State
  const [file, setFile] = useState<File | null>(null);
  const [quality, setQuality] = useState(DEFAULT_QUALITY);
  const [originalUrl, setOriginalUrl] = useState("");
  const [originalDimensions, setOriginalDimensions] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [result, setResult] = useState<CompressionResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState("");

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const resultRef = useRef<CompressionResult | null>(null);

  // Effect: Create/cleanup original preview URL
  useEffect(() => {
    if (!file) return;

    const url = URL.createObjectURL(file);
    setOriginalUrl(url);
    setOriginalDimensions(null);

    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Effect: Compress image when file or quality changes (debounced)
  useEffect(() => {
    if (!file) return;

    let cancelled = false;
    setIsLoading(true);

    const timer = setTimeout(async () => {
      try {
        const newResult = await compressImage(file, quality);
        if (!cancelled) {
          if (resultRef.current?.compressedUrl) {
            URL.revokeObjectURL(resultRef.current.compressedUrl);
          }
          resultRef.current = newResult;
          setResult(newResult);
        } else {
          URL.revokeObjectURL(newResult.compressedUrl);
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
  }, [file, quality]);

  // Handlers

  const handleFileSelect = (selectedFile: File): void => {
    if (!isFileTypeSupported(selectedFile.type)) {
      setError("Unsupported file type. Please use JPG, JPEG, or PNG.");
      return;
    }
    setFile(selectedFile);
    setResult(null);
    setError("");
  };

  const handleDrop = (e: Event): void => {
    e.preventDefault();
    setIsDragging(false);
    const dragEvent = e as DragEvent;
    const droppedFile = dragEvent.dataTransfer?.files[0];
    if (droppedFile) handleFileSelect(droppedFile);
  };

  const handleDownload = (): void => {
    if (result?.compressedUrl && file) {
      downloadFile(result.compressedUrl, generateCompressedFilename(file.name));
    }
  };

  const handleReset = (): void => {
    if (resultRef.current?.compressedUrl) {
      URL.revokeObjectURL(resultRef.current.compressedUrl);
      resultRef.current = null;
    }
    setFile(null);
    setOriginalUrl("");
    setOriginalDimensions(null);
    setResult(null);
    setQuality(DEFAULT_QUALITY);
    setError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // JSX

  return (
    <>
      {/* Upload Card */}
      <div class="card bg-base-100 shadow-xl">
        <div class="card-body">
          <h2 class="card-title justify-center text-xl md:text-2xl">
            Upload Your Image
          </h2>
          <p class="text-center text-base-content/70 text-sm md:text-base">
            Compress JPG, JPEG, and PNG images locally – no upload to server
          </p>

          {/* Drop Zone */}
          <div
            class={`mt-4 border-2 border-dashed rounded-xl p-6 md:p-12
              text-center cursor-pointer transition-all duration-200
              ${
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
              class="h-12 w-12 md:h-16 md:w-16 mx-auto text-base-content/40"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
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
            <p class="mt-2 text-xs text-base-content/40">
              Supports JPG, JPEG, PNG (Max dimension: 4096px)
            </p>
          </div>

          {/* Quality Slider */}
          <div class="mt-6">
            <label class="label">
              <span class="label-text font-semibold">Compression Quality</span>
              <span class="label-text-alt text-primary font-bold">
                {Math.round(quality * 100)}%
              </span>
            </label>
            <input
              type="range"
              min="0.1"
              max="1"
              step="0.1"
              value={String(quality)}
              onInput={(e: Event) => {
                const val = (e.target as HTMLInputElement).value;
                setQuality(parseFloat(val));
              }}
              class="range range-primary"
            />
            <div class="flex w-full justify-between px-2 text-xs text-base-content/50 mt-1">
              <span>Low</span>
              <span>Medium</span>
              <span>High</span>
            </div>
          </div>
        </div>
      </div>

      {/* Preview Section */}
      {file && (
        <div class="mt-8">
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
            {/* Original Image Card */}
            <div class="card bg-base-100 shadow-xl">
              <div class="card-body p-4 md:p-6">
                <h3 class="card-title text-base md:text-lg">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="h-5 w-5 text-warning"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fill-rule="evenodd"
                      d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z"
                      clip-rule="evenodd"
                    />
                  </svg>
                  Original
                </h3>
                <div class="bg-base-200 rounded-lg p-2 md:p-4 flex items-center justify-center min-h-[200px] md:min-h-[300px]">
                  <img
                    src={originalUrl}
                    onLoad={(e: Event) => {
                      const img = e.target as HTMLImageElement;
                      setOriginalDimensions({
                        width: img.naturalWidth,
                        height: img.naturalHeight,
                      });
                    }}
                    class="max-w-full max-h-[200px] md:max-h-[300px] rounded-lg object-contain"
                    alt="Original image preview"
                  />
                </div>
                <div class="mt-2 text-xs md:text-sm text-base-content/70 space-y-1">
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

            {/* Compressed Image Card */}
            <div class="card bg-base-100 shadow-xl">
              <div class="card-body p-4 md:p-6">
                <h3 class="card-title text-base md:text-lg">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="h-5 w-5 text-success"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fill-rule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clip-rule="evenodd"
                    />
                  </svg>
                  Compressed
                </h3>
                <div class="bg-base-200 rounded-lg p-2 md:p-4 flex items-center justify-center min-h-[200px] md:min-h-[300px]">
                  {result ? (
                    <img
                      src={result.compressedUrl}
                      class="max-w-full max-h-[200px] md:max-h-[300px] rounded-lg object-contain"
                      alt="Compressed image preview"
                    />
                  ) : (
                    <span class="loading loading-spinner loading-md text-primary" />
                  )}
                </div>
                {result && (
                  <div class="mt-2 text-xs md:text-sm text-base-content/70 space-y-1">
                    <p>
                      <strong>Compressed Size:</strong>{" "}
                      {formatFileSize(result.compressedSize)}
                    </p>
                    <p>
                      <strong>Dimensions:</strong> {result.width} x{" "}
                      {result.height}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Stats & Actions */}
          {result && (
            <div class="card bg-base-100 shadow-xl mt-4 md:mt-6">
              <div class="card-body p-4 md:p-6">
                <div class="stats stats-vertical md:stats-horizontal shadow w-full">
                  <div class="stat">
                    <div class="stat-title">Compression Ratio</div>
                    <div class="stat-value text-primary">
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
                    <div class="stat-value text-secondary">
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

                {/* Action Buttons */}
                <div class="card-actions justify-center mt-4 md:mt-6 flex-col sm:flex-row gap-2">
                  <button
                    class="btn btn-primary btn-wide"
                    onClick={handleDownload}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      class="h-5 w-5 mr-2"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fill-rule="evenodd"
                        d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"
                        clip-rule="evenodd"
                      />
                    </svg>
                    Download Compressed
                  </button>
                  <button
                    class="btn btn-outline btn-wide"
                    onClick={handleReset}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      class="h-5 w-5 mr-2"
                      viewBox="0 0 20 20"
                      fill="currentColor"
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
            </div>
          )}
        </div>
      )}

      {/* Loading Overlay */}
      {isLoading && <LoadingOverlay />}

      {/* Error Toast */}
      {error && <ErrorToast message={error} onDismiss={() => setError("")} />}
    </>
  );
};

// Mount the client component into the #root element
const root = document.getElementById("root");
if (root) {
  render(<ImageCompressor />, root);
}

import { describe, expect, it } from 'vitest'

import {
  calculateBytesSaved,
  calculateScaledDimensions,
  clampQuality,
  DEFAULT_QUALITY,
  formatFileSize,
  generateCompressedFilename,
  getCompressionRatio,
  isFileTypeSupported,
  isValidQuality,
  MAX_DIMENSION,
  MAX_QUALITY,
  MIN_QUALITY,
  SUPPORTED_TYPES,
} from './imageUtils'

describe('imageUtils', () => {
  describe('constants', () => {
    it('should have correct SUPPORTED_TYPES', () => {
      expect(SUPPORTED_TYPES).toContain('image/jpeg')
      expect(SUPPORTED_TYPES).toContain('image/jpg')
      expect(SUPPORTED_TYPES).toContain('image/png')
      expect(SUPPORTED_TYPES).toHaveLength(3)
    })

    it('should have correct MAX_DIMENSION', () => {
      expect(MAX_DIMENSION).toBe(4096)
    })

    it('should have correct quality range', () => {
      expect(MIN_QUALITY).toBe(0.1)
      expect(MAX_QUALITY).toBe(1.0)
      expect(DEFAULT_QUALITY).toBe(0.8)
    })
  })

  describe('isFileTypeSupported', () => {
    it('should return true for supported JPEG type', () => {
      expect(isFileTypeSupported('image/jpeg')).toBe(true)
    })

    it('should return true for supported JPG type', () => {
      expect(isFileTypeSupported('image/jpg')).toBe(true)
    })

    it('should return true for supported PNG type', () => {
      expect(isFileTypeSupported('image/png')).toBe(true)
    })

    it('should return false for unsupported GIF type', () => {
      expect(isFileTypeSupported('image/gif')).toBe(false)
    })

    it('should return false for unsupported WebP type', () => {
      expect(isFileTypeSupported('image/webp')).toBe(false)
    })

    it('should return false for non-image types', () => {
      expect(isFileTypeSupported('application/pdf')).toBe(false)
      expect(isFileTypeSupported('text/plain')).toBe(false)
    })

    it('should return false for empty string', () => {
      expect(isFileTypeSupported('')).toBe(false)
    })
  })

  describe('calculateScaledDimensions', () => {
    it('should return original dimensions when within max', () => {
      const result = calculateScaledDimensions(800, 600)
      expect(result).toEqual({ width: 800, height: 600 })
    })

    it('should scale down width-dominated images', () => {
      const result = calculateScaledDimensions(8000, 4000, 4096)
      expect(result.width).toBe(4096)
      expect(result.height).toBe(2048)
    })

    it('should scale down height-dominated images', () => {
      const result = calculateScaledDimensions(4000, 8000, 4096)
      expect(result.width).toBe(2048)
      expect(result.height).toBe(4096)
    })

    it('should scale square images correctly', () => {
      const result = calculateScaledDimensions(5000, 5000, 4096)
      expect(result.width).toBe(4096)
      expect(result.height).toBe(4096)
    })

    it('should preserve aspect ratio when scaling down', () => {
      const result = calculateScaledDimensions(6000, 3000, 4096)
      const originalRatio = 6000 / 3000
      const newRatio = result.width / result.height
      expect(newRatio).toBeCloseTo(originalRatio, 1)
    })

    it('should use custom max dimension', () => {
      const result = calculateScaledDimensions(2000, 1000, 1000)
      expect(result.width).toBe(1000)
      expect(result.height).toBe(500)
    })

    it('should throw error for zero width', () => {
      expect(() => calculateScaledDimensions(0, 100)).toThrow('Width and height must be positive numbers')
    })

    it('should throw error for zero height', () => {
      expect(() => calculateScaledDimensions(100, 0)).toThrow('Width and height must be positive numbers')
    })

    it('should throw error for negative dimensions', () => {
      expect(() => calculateScaledDimensions(-100, 100)).toThrow('Width and height must be positive numbers')
      expect(() => calculateScaledDimensions(100, -100)).toThrow('Width and height must be positive numbers')
    })
  })

  describe('formatFileSize', () => {
    it('should format 0 bytes correctly', () => {
      expect(formatFileSize(0)).toBe('0 Bytes')
    })

    it('should format bytes correctly', () => {
      expect(formatFileSize(500)).toBe('500 Bytes')
    })

    it('should format kilobytes correctly', () => {
      expect(formatFileSize(1024)).toBe('1 KB')
      expect(formatFileSize(1536)).toBe('1.5 KB')
    })

    it('should format megabytes correctly', () => {
      expect(formatFileSize(1048576)).toBe('1 MB')
      expect(formatFileSize(1572864)).toBe('1.5 MB')
    })

    it('should format gigabytes correctly', () => {
      expect(formatFileSize(1073741824)).toBe('1 GB')
    })

    it('should handle decimal precision correctly', () => {
      expect(formatFileSize(1234567)).toBe('1.18 MB')
    })

    it('should throw error for negative bytes', () => {
      expect(() => formatFileSize(-1)).toThrow('Bytes cannot be negative')
    })
  })

  describe('getCompressionRatio', () => {
    it('should calculate 50% reduction correctly', () => {
      expect(getCompressionRatio(1000, 500)).toBe('50.0')
    })

    it('should calculate 0% reduction when sizes are equal', () => {
      expect(getCompressionRatio(1000, 1000)).toBe('0.0')
    })

    it('should handle negative ratio when compressed is larger', () => {
      expect(getCompressionRatio(500, 1000)).toBe('-100.0')
    })

    it('should calculate precise ratios', () => {
      expect(getCompressionRatio(1000, 333)).toBe('66.7')
    })

    it('should throw error for zero original size', () => {
      expect(() => getCompressionRatio(0, 500)).toThrow('Original size must be a positive number')
    })

    it('should throw error for negative original size', () => {
      expect(() => getCompressionRatio(-100, 500)).toThrow('Original size must be a positive number')
    })

    it('should throw error for negative compressed size', () => {
      expect(() => getCompressionRatio(1000, -500)).toThrow('Compressed size cannot be negative')
    })
  })

  describe('isValidQuality', () => {
    it('should return true for minimum quality', () => {
      expect(isValidQuality(0.1)).toBe(true)
    })

    it('should return true for maximum quality', () => {
      expect(isValidQuality(1.0)).toBe(true)
    })

    it('should return true for mid-range quality', () => {
      expect(isValidQuality(0.5)).toBe(true)
    })

    it('should return false for quality below minimum', () => {
      expect(isValidQuality(0.05)).toBe(false)
      expect(isValidQuality(0)).toBe(false)
    })

    it('should return false for quality above maximum', () => {
      expect(isValidQuality(1.1)).toBe(false)
      expect(isValidQuality(2)).toBe(false)
    })

    it('should return false for negative quality', () => {
      expect(isValidQuality(-0.5)).toBe(false)
    })
  })

  describe('clampQuality', () => {
    it('should return same value for valid quality', () => {
      expect(clampQuality(0.5)).toBe(0.5)
      expect(clampQuality(0.8)).toBe(0.8)
    })

    it('should clamp to minimum for low values', () => {
      expect(clampQuality(0)).toBe(0.1)
      expect(clampQuality(0.05)).toBe(0.1)
      expect(clampQuality(-1)).toBe(0.1)
    })

    it('should clamp to maximum for high values', () => {
      expect(clampQuality(1.5)).toBe(1.0)
      expect(clampQuality(2)).toBe(1.0)
    })

    it('should handle edge cases at boundaries', () => {
      expect(clampQuality(0.1)).toBe(0.1)
      expect(clampQuality(1.0)).toBe(1.0)
    })
  })

  describe('generateCompressedFilename', () => {
    it('should add default suffix and change extension to jpg', () => {
      expect(generateCompressedFilename('photo.png')).toBe('photo_compressed.jpg')
    })

    it('should handle jpeg files', () => {
      expect(generateCompressedFilename('image.jpeg')).toBe('image_compressed.jpg')
    })

    it('should handle jpg files', () => {
      expect(generateCompressedFilename('picture.jpg')).toBe('picture_compressed.jpg')
    })

    it('should use custom suffix', () => {
      expect(generateCompressedFilename('photo.png', '_small')).toBe('photo_small.jpg')
    })

    it('should handle filenames with multiple dots', () => {
      expect(generateCompressedFilename('my.photo.image.png')).toBe('my.photo.image_compressed.jpg')
    })

    it('should handle filenames without extension', () => {
      expect(generateCompressedFilename('photo')).toBe('photo_compressed.jpg')
    })

    it('should handle filenames with spaces', () => {
      expect(generateCompressedFilename('my photo.png')).toBe('my photo_compressed.jpg')
    })
  })

  describe('calculateBytesSaved', () => {
    it('should calculate positive savings', () => {
      expect(calculateBytesSaved(1000, 500)).toBe(500)
    })

    it('should return zero when sizes are equal', () => {
      expect(calculateBytesSaved(1000, 1000)).toBe(0)
    })

    it('should return negative when compressed is larger', () => {
      expect(calculateBytesSaved(500, 1000)).toBe(-500)
    })

    it('should handle large file sizes', () => {
      const original = 10 * 1024 * 1024 // 10 MB
      const compressed = 2 * 1024 * 1024 // 2 MB
      expect(calculateBytesSaved(original, compressed)).toBe(8 * 1024 * 1024)
    })
  })
})

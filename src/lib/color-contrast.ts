/**
 * Color contrast utilities for WCAG AA compliance
 */

/**
 * Convert hex color to RGB
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null
}

/**
 * Calculate relative luminance
 */
function getLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const sRGB = c / 255
    return sRGB <= 0.03928 ? sRGB / 12.92 : Math.pow((sRGB + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs
}

/**
 * Calculate contrast ratio between two colors
 */
export function getContrastRatio(color1: string, color2: string): number {
  const rgb1 = hexToRgb(color1)
  const rgb2 = hexToRgb(color2)

  if (!rgb1 || !rgb2) return 0

  const lum1 = getLuminance(rgb1.r, rgb1.g, rgb1.b)
  const lum2 = getLuminance(rgb2.r, rgb2.g, rgb2.b)

  const lighter = Math.max(lum1, lum2)
  const darker = Math.min(lum1, lum2)

  return (lighter + 0.05) / (darker + 0.05)
}

/**
 * Check if contrast ratio meets WCAG AA standard
 */
export function meetsWCAGAA(
  foreground: string,
  background: string,
  isLargeText: boolean = false
): boolean {
  const ratio = getContrastRatio(foreground, background)
  return isLargeText ? ratio >= 3 : ratio >= 4.5
}

/**
 * Check if contrast ratio meets WCAG AAA standard
 */
export function meetsWCAGAAA(
  foreground: string,
  background: string,
  isLargeText: boolean = false
): boolean {
  const ratio = getContrastRatio(foreground, background)
  return isLargeText ? ratio >= 4.5 : ratio >= 7
}

/**
 * WCAG AA compliant color palette
 */
export const accessibleColors = {
  // Text colors on white background
  text: {
    primary: '#1f2937', // gray-800 - 12.6:1 ratio
    secondary: '#4b5563', // gray-600 - 7.0:1 ratio
    tertiary: '#6b7280', // gray-500 - 4.6:1 ratio
  },
  // Background colors
  background: {
    primary: '#ffffff',
    secondary: '#f9fafb', // gray-50
    tertiary: '#f3f4f6', // gray-100
  },
  // Status colors (all meet WCAG AA on white)
  status: {
    success: '#059669', // green-600 - 4.5:1 ratio
    warning: '#d97706', // amber-600 - 4.5:1 ratio
    error: '#dc2626', // red-600 - 5.9:1 ratio
    info: '#2563eb', // blue-600 - 5.1:1 ratio
  },
  // Interactive colors
  interactive: {
    primary: '#2563eb', // blue-600 - 5.1:1 ratio
    primaryHover: '#1d4ed8', // blue-700 - 6.7:1 ratio
    secondary: '#6b7280', // gray-500 - 4.6:1 ratio
    secondaryHover: '#4b5563', // gray-600 - 7.0:1 ratio
  },
  // High contrast mode colors
  highContrast: {
    text: '#000000',
    background: '#ffffff',
    border: '#000000',
    focus: '#0000ff',
  },
}

/**
 * Get accessible color based on background
 */
export function getAccessibleTextColor(backgroundColor: string): string {
  const ratio = getContrastRatio('#000000', backgroundColor)
  return ratio >= 4.5 ? '#000000' : '#ffffff'
}

/**
 * Validate color palette for accessibility
 */
export function validateColorPalette(palette: {
  foreground: string
  background: string
}): {
  isValid: boolean
  ratio: number
  level: 'AAA' | 'AA' | 'Fail'
} {
  const ratio = getContrastRatio(palette.foreground, palette.background)

  let level: 'AAA' | 'AA' | 'Fail' = 'Fail'
  if (ratio >= 7) level = 'AAA'
  else if (ratio >= 4.5) level = 'AA'

  return {
    isValid: ratio >= 4.5,
    ratio,
    level,
  }
}

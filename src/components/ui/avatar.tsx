"use client"

import * as React from "react"
import * as AvatarPrimitive from "@radix-ui/react-avatar"
import { cn } from "@/lib/utils"

const Avatar = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Root
    ref={ref}
    className={cn(
      "relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full",
      className
    )}
    {...props}
  />
))
Avatar.displayName = AvatarPrimitive.Root.displayName

const AvatarImage = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Image>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>
>(({ className, onError, src, ...props }, ref) => {
  const [hasError, setHasError] = React.useState(false)

  // Check if src is a valid URL before attempting to load (URL constructor accepts string | URL only)
  const isValidUrl = React.useMemo(() => {
    if (!src || typeof src !== 'string') return false
    try {
      const url = new URL(src)
      // LINE CDN URLs that are too long or malformed should be rejected
      // LINE profile URLs are typically shorter and valid
      return url.protocol === 'https:' && url.hostname.includes('line-scdn.net')
    } catch {
      return false
    }
  }, [src])

  const handleError = React.useCallback((e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    // Silently handle image load errors (fallback will show)
    // LINE CDN URLs may expire or be invalid - this is expected
    setHasError(true)
    if (onError) {
      onError(e)
    }
  }, [onError])

  // Reset error state when src changes
  React.useEffect(() => {
    setHasError(false)
  }, [src])

  // Don't render image if it already failed, src is invalid, or URL is malformed
  if (hasError || !src || !isValidUrl) {
    return null
  }

  return (
    <AvatarPrimitive.Image
      ref={ref}
      className={cn("aspect-square h-full w-full", className)}
      onError={handleError}
      src={src}
      referrerPolicy="no-referrer"
      {...props}
    />
  )
})
AvatarImage.displayName = AvatarPrimitive.Image.displayName

const AvatarFallback = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Fallback>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Fallback
    ref={ref}
    className={cn(
      "flex h-full w-full items-center justify-center rounded-full bg-muted",
      className
    )}
    {...props}
  />
))
AvatarFallback.displayName = AvatarPrimitive.Fallback.displayName

export { Avatar, AvatarImage, AvatarFallback }

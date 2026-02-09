'use client'

/**
 * Text scaling support for users who need larger text
 * Ensures layout doesn't break at 200% zoom
 */
export function TextScalingSupport() {
  return (
    <style jsx global>{`
      /* Ensure text can scale up to 200% */
      html {
        font-size: 16px;
      }

      /* Use relative units for all text */
      body {
        font-size: 1rem;
        line-height: 1.5;
      }

      /* Ensure containers can grow with text */
      * {
        max-width: 100%;
      }

      /* Prevent text overflow */
      p,
      h1,
      h2,
      h3,
      h4,
      h5,
      h6,
      span,
      div {
        overflow-wrap: break-word;
        word-wrap: break-word;
        hyphens: auto;
      }

      /* Ensure buttons and inputs scale properly */
      button,
      input,
      textarea,
      select {
        font-size: inherit;
        line-height: inherit;
      }

      /* Minimum touch target size (44x44px) */
      button,
      a,
      input[type='checkbox'],
      input[type='radio'] {
        min-height: 44px;
        min-width: 44px;
      }

      /* Ensure icons scale with text */
      svg {
        width: 1em;
        height: 1em;
      }

      /* Responsive font sizes */
      @media (max-width: 640px) {
        html {
          font-size: 14px;
        }
      }

      @media (min-width: 1024px) {
        html {
          font-size: 16px;
        }
      }

      @media (min-width: 1280px) {
        html {
          font-size: 18px;
        }
      }

      /* Support for user zoom preferences */
      @media (prefers-reduced-motion: reduce) {
        * {
          animation-duration: 0.01ms !important;
          animation-iteration-count: 1 !important;
          transition-duration: 0.01ms !important;
        }
      }

      /* Ensure layout doesn't break at 200% zoom */
      @media (min-resolution: 2dppx) {
        .container {
          max-width: 100%;
        }
      }

      /* Flexible grid layouts */
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(min(100%, 300px), 1fr));
        gap: 1rem;
      }

      /* Flexible flex layouts */
      .flex-wrap {
        flex-wrap: wrap;
      }

      /* Ensure images scale properly */
      img {
        max-width: 100%;
        height: auto;
      }

      /* Ensure tables are responsive */
      table {
        width: 100%;
        overflow-x: auto;
        display: block;
      }

      /* Ensure modals are scrollable */
      [role='dialog'] {
        max-height: 90vh;
        overflow-y: auto;
      }
    `}</style>
  )
}

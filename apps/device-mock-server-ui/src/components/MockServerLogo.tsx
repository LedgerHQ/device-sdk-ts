interface MockServerLogoProps {
  /** Height in pixels; the width follows the artwork's ratio. */
  readonly size?: number;
  readonly className?: string;
}

/**
 * The mock server's mark: a device whose screen holds a cloud. It is drawn in
 * `currentColor`, with the screen and the bottom notch cut out of the body, so
 * it reads the same way on a light and on a dark background.
 */
export function MockServerLogo({ size = 24, className }: MockServerLogoProps) {
  return (
    <svg
      width={(size * 174) / 254}
      height={size}
      viewBox="0 0 174 254"
      fill="none"
      role="img"
      aria-label="Device Mock Server"
      className={className}
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        fill="currentColor"
        d="M20 0H150A20 20 0 0 1 170 20V234A20 20 0 0 1 150 254H20A20 20 0 0 1 0 234V20A20 20 0 0 1 20 0ZM26 12H143A14 14 0 0 1 157 26V192A14 14 0 0 1 143 206H26A14 14 0 0 1 12 192V26A14 14 0 0 1 26 12ZM130.5 226H146.5A6.5 6.5 0 0 1 153 232.5A6.5 6.5 0 0 1 146.5 239H130.5A6.5 6.5 0 0 1 124 232.5A6.5 6.5 0 0 1 130.5 226Z"
      />
      <rect x="166" y="31" width="8" height="30" rx="3" fill="currentColor" />
      <rect
        x="17"
        y="17"
        width="135"
        height="184"
        rx="10"
        fill="currentColor"
        opacity="0.12"
      />
      <g fill="currentColor">
        <circle cx="84.5" cy="105" r="28" />
        <circle cx="58" cy="120" r="20" />
        <circle cx="111" cy="120" r="20" />
        <rect x="58" y="105" width="53" height="35" />
      </g>
    </svg>
  );
}

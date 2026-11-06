export function GermanFlag({ className = 'w-7 h-5' }: { className?: string }) {
  return (
    <svg
      className={`${className} inline-block rounded-sm shadow-sm overflow-hidden flex-shrink-0 align-middle border border-black/30`}
      viewBox="0 0 5 3"
      aria-label="Deutsche Flagge"
    >
      <rect width="5" height="1" y="0" fill="#000000" />
      <rect width="5" height="1" y="1" fill="#DD0000" />
      <rect width="5" height="1" y="2" fill="#FFCE00" />
    </svg>
  )
}

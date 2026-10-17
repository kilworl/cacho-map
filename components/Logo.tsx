/** Wordmark with a pair of hand-drawn horns (the "cachos"). */
export function Logo() {
  return (
    <span className="logo">
      <svg viewBox="0 0 64 40" aria-hidden="true" className="logo-horns">
        <path d="M14 38c-2-10-8-14-10-24 4 5 8 7 12 6-3-5-3-10-1-16 2 8 7 12 12 14l-3 20z" />
        <path d="M50 38c2-10 8-14 10-24-4 5-8 7-12 6 3-5 3-10 1-16-2 8-7 12-12 14l3 20z" />
      </svg>
      <span>Cacho<b>·</b>Map</span>
    </span>
  );
}

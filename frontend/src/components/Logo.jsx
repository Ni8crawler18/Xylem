/**
 * Eigenparse logo — a stylized credential card with a circuit/proof motif.
 * Renders as inline SVG so it's crisp at any size and inherits the theme.
 */
function Logo({ size = 32, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Card body */}
      <rect x="4" y="6" width="32" height="28" rx="4" fill="#0D0D0D" stroke="#5B9A5B" strokeWidth="1.5" />

      {/* Header stripe */}
      <rect x="4" y="6" width="32" height="8" rx="4" fill="#5B9A5B" fillOpacity="0.15" />
      <rect x="4" y="10" width="32" height="4" fill="#5B9A5B" fillOpacity="0.15" />

      {/* Chip (like a smart card IC) */}
      <rect x="8" y="9" width="8" height="6" rx="1.5" fill="#5B9A5B" fillOpacity="0.4" stroke="#5B9A5B" strokeWidth="0.75" />
      <line x1="10" y1="9" x2="10" y2="15" stroke="#5B9A5B" strokeWidth="0.5" strokeOpacity="0.6" />
      <line x1="12" y1="9" x2="12" y2="15" stroke="#5B9A5B" strokeWidth="0.5" strokeOpacity="0.6" />
      <line x1="14" y1="9" x2="14" y2="15" stroke="#5B9A5B" strokeWidth="0.5" strokeOpacity="0.6" />
      <line x1="8" y1="12" x2="16" y2="12" stroke="#5B9A5B" strokeWidth="0.5" strokeOpacity="0.6" />

      {/* Circuit traces */}
      <circle cx="24" cy="20" r="1.5" fill="#5B9A5B" />
      <circle cx="30" cy="20" r="1" fill="#5B9A5B" fillOpacity="0.5" />
      <circle cx="12" cy="22" r="1" fill="#5B9A5B" fillOpacity="0.5" />
      <line x1="24" y1="20" x2="30" y2="20" stroke="#5B9A5B" strokeWidth="0.75" strokeOpacity="0.4" />
      <line x1="12" y1="22" x2="24" y2="20" stroke="#5B9A5B" strokeWidth="0.75" strokeOpacity="0.3" />

      {/* ZK check mark */}
      <path d="M17 26 L20 29 L27 22" stroke="#5B9A5B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

      {/* Data line placeholders */}
      <rect x="8" y="18" width="10" height="1.5" rx="0.75" fill="#5B9A5B" fillOpacity="0.15" />
      <rect x="8" y="26" width="7" height="1.5" rx="0.75" fill="#5B9A5B" fillOpacity="0.1" />
      <rect x="8" y="29" width="12" height="1.5" rx="0.75" fill="#5B9A5B" fillOpacity="0.1" />
    </svg>
  )
}

export default Logo

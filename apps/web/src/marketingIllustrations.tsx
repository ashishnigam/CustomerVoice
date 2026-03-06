export function PortalBoardIllustration(): JSX.Element {
  return (
    <svg viewBox="0 0 640 480" role="img" aria-label="CustomerVoice portal board illustration" className="marketing-illustration" style={{ filter: 'drop-shadow(0 20px 40px rgba(15,23,42,0.12))' }}>
      <defs>
        <linearGradient id="cv-bg-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f8fafc" />
          <stop offset="100%" stopColor="#e8f4ff" />
        </linearGradient>
        <linearGradient id="cv-accent" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#143f64" />
          <stop offset="100%" stopColor="#2a78b7" />
        </linearGradient>
        <linearGradient id="cv-green" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#10b981" />
          <stop offset="100%" stopColor="#34d399" />
        </linearGradient>
        <filter id="cv-blur">
          <feGaussianBlur stdDeviation="2" />
        </filter>
      </defs>

      {/* Window frame */}
      <rect x="20" y="20" width="600" height="440" rx="20" fill="url(#cv-bg-grad)" stroke="#e2e8f0" strokeWidth="1.5" />

      {/* Title bar */}
      <rect x="20" y="20" width="600" height="48" rx="20" fill="#fff" stroke="#e2e8f0" strokeWidth="1.5" />
      <rect x="20" y="48" width="600" height="20" fill="#fff" />
      <circle cx="48" cy="44" r="6" fill="#ff6b6b" />
      <circle cx="68" cy="44" r="6" fill="#ffd43b" />
      <circle cx="88" cy="44" r="6" fill="#51cf66" />
      <rect x="120" y="34" width="180" height="20" rx="10" fill="#f1f5f9" />

      {/* Sidebar */}
      <rect x="20" y="68" width="160" height="392" fill="#fff" />
      <line x1="180" y1="68" x2="180" y2="460" stroke="#e2e8f0" strokeWidth="1" />

      {/* Sidebar items */}
      <rect x="36" y="88" width="128" height="10" rx="5" fill="#143f64" opacity="0.85" />
      <rect x="36" y="114" width="100" height="8" rx="4" fill="#94a3b8" />
      <rect x="36" y="138" width="120" height="32" rx="10" fill="url(#cv-accent)" />
      <rect x="50" y="148" width="80" height="12" rx="6" fill="#fff" opacity="0.9" />
      <rect x="36" y="186" width="110" height="8" rx="4" fill="#cbd5e1" />
      <rect x="36" y="210" width="90" height="8" rx="4" fill="#cbd5e1" />
      <rect x="36" y="234" width="100" height="8" rx="4" fill="#cbd5e1" />

      {/* Main content area - idea cards */}
      <rect x="200" y="80" width="400" height="44" rx="12" fill="#fff" stroke="#e2e8f0" />
      <rect x="216" y="94" width="140" height="14" rx="7" fill="#f1f5f9" />
      <rect x="530" y="90" width="56" height="24" rx="12" fill="url(#cv-accent)" />
      <rect x="540" y="97" width="36" height="10" rx="5" fill="#fff" opacity="0.9" />

      {/* Card 1 */}
      <rect x="200" y="140" width="400" height="90" rx="14" fill="#fff" stroke="#e2e8f0" />
      <rect x="220" y="158" width="200" height="12" rx="6" fill="#0f172a" opacity="0.9" />
      <rect x="220" y="180" width="280" height="8" rx="4" fill="#cbd5e1" />
      <rect x="220" y="196" width="180" height="8" rx="4" fill="#cbd5e1" />
      <rect x="548" y="154" width="38" height="38" rx="12" fill="#eef2ff" />
      <text x="556" y="178" fill="#143f64" fontSize="16" fontWeight="700">42</text>
      <rect x="220" y="212" width="60" height="18" rx="9" fill="#dcfce7" />
      <rect x="288" y="212" width="50" height="18" rx="9" fill="#e8f4ff" />

      {/* Card 2 */}
      <rect x="200" y="246" width="400" height="90" rx="14" fill="#fff" stroke="#e2e8f0" />
      <rect x="220" y="264" width="180" height="12" rx="6" fill="#0f172a" opacity="0.9" />
      <rect x="220" y="286" width="300" height="8" rx="4" fill="#cbd5e1" />
      <rect x="220" y="302" width="220" height="8" rx="4" fill="#cbd5e1" />
      <rect x="548" y="260" width="38" height="38" rx="12" fill="#eef2ff" />
      <text x="556" y="284" fill="#143f64" fontSize="16" fontWeight="700">28</text>
      <rect x="220" y="318" width="70" height="18" rx="9" fill="#fef3c7" />

      {/* Card 3 */}
      <rect x="200" y="352" width="400" height="90" rx="14" fill="#fff" stroke="#e2e8f0" />
      <rect x="220" y="370" width="240" height="12" rx="6" fill="#0f172a" opacity="0.9" />
      <rect x="220" y="392" width="260" height="8" rx="4" fill="#cbd5e1" />
      <rect x="220" y="408" width="200" height="8" rx="4" fill="#cbd5e1" />
      <rect x="548" y="366" width="38" height="38" rx="12" fill="#eef2ff" />
      <text x="557" y="390" fill="#143f64" fontSize="16" fontWeight="700">15</text>
      <rect x="220" y="424" width="80" height="18" rx="9" fill="#dbeafe" />
      <rect x="308" y="424" width="60" height="18" rx="9" fill="#e8f4ff" />

      {/* Floating badge */}
      <g style={{ animation: 'float 4s ease-in-out infinite' }}>
        <rect x="520" y="30" width="90" height="32" rx="16" fill="url(#cv-green)" opacity="0.95" />
        <text x="540" y="51" fill="#fff" fontSize="12" fontWeight="700">Active</text>
      </g>
    </svg>
  );
}

export function FeedbackLoopIllustration(): JSX.Element {
  return (
    <svg viewBox="0 0 560 320" role="img" aria-label="CustomerVoice workflow illustration" className="marketing-illustration" style={{ filter: 'drop-shadow(0 16px 32px rgba(15,23,42,0.08))' }}>
      <defs>
        <linearGradient id="cv-loop-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f8fafc" />
          <stop offset="100%" stopColor="#eef6ff" />
        </linearGradient>
        <linearGradient id="cv-loop-accent" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#143f64" />
          <stop offset="100%" stopColor="#2a78b7" />
        </linearGradient>
        <linearGradient id="cv-loop-green" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#10b981" />
          <stop offset="100%" stopColor="#6ee7b7" />
        </linearGradient>
      </defs>

      <rect x="10" y="10" width="540" height="300" rx="24" fill="url(#cv-loop-bg)" stroke="#e2e8f0" strokeWidth="1.5" />

      {/* Connection lines */}
      <path d="M168 160 Q 280 60, 392 160" fill="none" stroke="#e2e8f0" strokeWidth="3" strokeDasharray="8 6" />
      <path d="M392 160 Q 280 260, 168 160" fill="none" stroke="#e2e8f0" strokeWidth="3" strokeDasharray="8 6" />

      {/* Arrows */}
      <path d="M280 80 L 290 62 L 270 62 Z" fill="#143f64" opacity="0.5" />
      <path d="M280 240 L 290 258 L 270 258 Z" fill="#10b981" opacity="0.5" />

      {/* Step nodes */}
      <circle cx="124" cy="160" r="48" fill="url(#cv-loop-accent)" />
      <text x="96" y="156" fill="#fff" fontSize="11" fontWeight="600">CAPTURE</text>
      <text x="99" y="172" fill="rgba(255,255,255,0.7)" fontSize="9">Ideas + Votes</text>

      <circle cx="280" cy="76" r="42" fill="#fff" stroke="#143f64" strokeWidth="3" />
      <text x="258" y="73" fill="#143f64" fontSize="11" fontWeight="600">TRIAGE</text>
      <text x="254" y="89" fill="#64748b" fontSize="9">Moderate</text>

      <circle cx="436" cy="160" r="48" fill="url(#cv-loop-green)" />
      <text x="405" y="156" fill="#fff" fontSize="11" fontWeight="600">PRIORITIZE</text>
      <text x="413" y="172" fill="rgba(255,255,255,0.7)" fontSize="9">RICE + Rev</text>

      <circle cx="280" cy="244" r="42" fill="#fff" stroke="#10b981" strokeWidth="3" />
      <text x="261" y="241" fill="#10b981" fontSize="11" fontWeight="600">NOTIFY</text>
      <text x="253" y="257" fill="#64748b" fontSize="9">Close Loop</text>
    </svg>
  );
}

export function EnterpriseReadyIllustration(): JSX.Element {
  return (
    <svg viewBox="0 0 560 340" role="img" aria-label="CustomerVoice enterprise illustration" className="marketing-illustration" style={{ filter: 'drop-shadow(0 16px 32px rgba(15,23,42,0.08))' }}>
      <defs>
        <linearGradient id="cv-ent-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f8fafc" />
          <stop offset="100%" stopColor="#edf2ff" />
        </linearGradient>
        <linearGradient id="cv-ent-accent" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#143f64" />
          <stop offset="100%" stopColor="#10b981" />
        </linearGradient>
      </defs>

      <rect x="10" y="10" width="540" height="320" rx="24" fill="url(#cv-ent-bg)" stroke="#e2e8f0" strokeWidth="1.5" />

      {/* Cloud shape */}
      <path d="M186 210c0-30 24-54 54-54 10 0 20 3 28 9 12-26 38-44 68-44 42 0 74 32 78 72 4-2 8-2 12-2 24 0 44 20 44 44s-20 44-44 44H232c-26 0-46-20-46-46 0-8 2-16 0-23z" fill="url(#cv-ent-accent)" opacity="0.88" />

      {/* Compliance cards */}
      <rect x="80" y="68" width="110" height="64" rx="16" fill="#fff" stroke="#e2e8f0" />
      <text x="110" y="106" fill="#143f64" fontSize="15" fontWeight="700">SOC 2</text>

      <rect x="210" y="52" width="110" height="80" rx="16" fill="#eef2ff" stroke="#e2e8f0" />
      <text x="243" y="98" fill="#143f64" fontSize="15" fontWeight="700">GDPR</text>

      <rect x="340" y="68" width="110" height="64" rx="16" fill="#fff" stroke="#e2e8f0" />
      <text x="369" y="106" fill="#143f64" fontSize="15" fontWeight="700">HIPAA</text>

      {/* Shield */}
      <rect x="230" y="220" width="100" height="74" rx="18" fill="#fff" stroke="#e2e8f0" />
      <path d="M280 234l22 8v16c0 14-9 26-22 32-14-6-22-18-22-32v-16l22-8z" fill="#143f64" />
      <path d="M270 262l8 8 16-18" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

import { useId } from "react";

/** Monogramme Passe D Média : le P blanc, le D or, le bouton lecture, le cadre caméra et la pelouse. */
export function LogoMark({ className = "logo-mark" }: { className?: string }) {
  const gold = useId();
  const grass = useId();
  const g = `url(#${gold})`;
  return (
    <svg className={className} viewBox="0 0 64 54" aria-hidden focusable="false">
      <defs>
        <linearGradient id={gold} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f6c950" />
          <stop offset="1" stopColor="#d9922a" />
        </linearGradient>
        <linearGradient id={grass} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4cc96a" />
          <stop offset="1" stopColor="#1f7a3a" />
        </linearGradient>
      </defs>
      <rect x="6" y="46" width="46" height="6" rx="1.6" fill={`url(#${grass})`} />
      <g fill="none" stroke="#f3f3f0" strokeWidth=".5">
        <path d="M29 46v6M6 47.6h2.4v2.8H6M52 47.6h-2.4v2.8H52" />
        <circle cx="29" cy="49" r="1.8" />
      </g>
      <g fill="none" stroke={g} strokeWidth="2.4" strokeLinecap="round">
        <path d="M5 14V8a3 3 0 0 1 3-3h5M44 5h4a3 3 0 0 1 3 3v6M5 34v6a3 3 0 0 0 3 3h3M51 34v6a3 3 0 0 1-3 3h-3" />
      </g>
      <path d="m53.5 21 6-4.2v14.4l-6-4.2z" fill={g} />
      <path d="M21 43.5h14c9.5 0 15.5-6.5 15.5-14.5 0-4.5-2-8.4-5.3-11l-3.6 4.2c2 1.6 3.1 4 3.1 6.8 0 4.8-3.6 8.7-9.6 8.7H22.4z" fill={g} />
      <path
        fill="var(--logo-p, #f3f3f0)"
        fillRule="evenodd"
        d="M9.5 43.5 17.5 5h15.5c9 0 14.5 5 13.5 12.3-1 7.5-7.5 12.4-16 12.4h-8.6l-2.9 13.8zM22.6 22.9h7.6c4.6 0 7.8-2.3 8.3-5.9.4-3.1-1.9-5.2-5.9-5.2h-7.6z"
      />
      <path d="m27.2 14.6 8.3 3.8-9.9 3.8z" fill={g} />
    </svg>
  );
}

/** Logo complet : monogramme + « PASSE D », le D en or. */
export function Logo({ suffix }: { suffix?: string }) {
  return (
    <>
      <LogoMark />
      {suffix ?? (
        <>
          Passe<span className="logo-d">D</span>
        </>
      )}
    </>
  );
}

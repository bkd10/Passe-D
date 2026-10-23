type P = { size?: number };
const base = (size = 20) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
});
export const SearchIcon = ({ size }: P) => (
  <svg {...base(size)}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
);
export const MenuIcon = ({ size }: P) => (
  <svg {...base(size)}><path d="M4 7h16M4 12h16M4 17h10" /></svg>
);
export const CloseIcon = ({ size }: P) => (
  <svg {...base(size)}><path d="M6 6l12 12M18 6 6 18" /></svg>
);
export const SunIcon = ({ size }: P) => (
  <svg {...base(size)}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
);
export const MoonIcon = ({ size }: P) => (
  <svg {...base(size)}><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" /></svg>
);
export const PlayIcon = ({ size }: P) => (
  <svg {...base(size)} fill="currentColor" stroke="none"><path d="M8 5v14l11-7z" /></svg>
);
export const ShareIcon = ({ size }: P) => (
  <svg {...base(size)}><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" /></svg>
);
export const LinkIcon = ({ size }: P) => (
  <svg {...base(size)}><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" /><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" /></svg>
);
export const ArrowIcon = ({ size }: P) => (
  <svg {...base(size)}><path d="M5 12h14M13 6l6 6-6 6" /></svg>
);

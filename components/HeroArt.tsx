/** Decorative "growth" illustration for the hero: rising bars, a gold trend line and a sprout. */
export default function HeroArt() {
  const base = 470;
  const bars = [70, 110, 160, 215, 280, 350];
  const xs = bars.map((_, i) => 90 + i * 100);
  const tops = bars.map((h) => base - h);
  // Trend line floats above the bars
  const pts = xs.map((x, i) => [x + 27, tops[i] - 40 - i * 6] as const);
  const d = pts
    .map(([x, y], i) => {
      if (i === 0) return `M ${x} ${y}`;
      const [px, py] = pts[i - 1];
      const cx = (px + x) / 2;
      return `C ${cx} ${py}, ${cx} ${y}, ${x} ${y}`;
    })
    .join(" ");
  const [ex, ey] = pts[pts.length - 1];
  const sx = xs[5] + 27; // sprout grows out of the tallest bar
  const sy = tops[5];

  return (
    <svg className="hero-art" viewBox="0 0 720 500" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="bar" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1f9a74" />
          <stop offset="1" stopColor="#00583d" stopOpacity="0.15" />
        </linearGradient>
        <linearGradient id="barHi" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2bb487" />
          <stop offset="1" stopColor="#00583d" stopOpacity="0.2" />
        </linearGradient>
        <linearGradient id="leaf" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#b8f5d0" />
          <stop offset="1" stopColor="#3cc48f" />
        </linearGradient>
        <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="6" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* grid */}
      {[110, 200, 290, 380, 470].map((y) => (
        <line key={y} x1="40" x2="700" y1={y} y2={y} stroke="#f6fffa" strokeOpacity="0.07" strokeDasharray="4 8" />
      ))}

      {/* bars */}
      {bars.map((h, i) => (
        <rect
          key={i}
          x={xs[i]}
          y={tops[i]}
          width="54"
          height={h}
          rx="8"
          fill={i === bars.length - 1 ? "url(#barHi)" : "url(#bar)"}
          opacity={0.45 + i * 0.1}
        />
      ))}

      {/* trend line */}
      <path d={d} fill="none" stroke="#eec04d" strokeWidth="4" strokeLinecap="round" filter="url(#glow)" />
      {pts.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={i === pts.length - 1 ? 0 : 6} fill="#000d01" stroke="#eec04d" strokeWidth="3" />
      ))}
      {/* arrow head */}
      <path
        d={`M ${ex - 16} ${ey + 4} L ${ex + 6} ${ey - 10} L ${ex - 4} ${ey + 16}`}
        fill="none"
        stroke="#eec04d"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
        filter="url(#glow)"
      />

      {/* sprout on the tallest bar */}
      <g transform={`translate(${sx - 52} ${sy})`}>
        <path d="M 52 0 C 52 -22, 50 -38, 56 -58" fill="none" stroke="#3cc48f" strokeWidth="4" strokeLinecap="round" />
        <path d="M 54 -40 C 30 -46, 12 -64, 14 -84 C 36 -82, 52 -66, 54 -40 Z" fill="url(#leaf)" />
        <path d="M 56 -56 C 74 -70, 96 -72, 108 -60 C 96 -42, 74 -40, 56 -56 Z" fill="url(#leaf)" />
      </g>
    </svg>
  );
}

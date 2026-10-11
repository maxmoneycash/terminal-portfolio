const clamp = (n: number) => Math.max(0, Math.min(1, n));

/** A pen flourish becomes a carrier: shared by the loader and film transitions. */
export function SignalBridge({ width, height, morph = 1, opacity = 1 }: {
  width: number; height: number; morph?: number; opacity?: number;
}) {
  const t = clamp(morph);
  const smooth = t * t * (3 - 2 * t);
  const points = Array.from({ length: 241 }, (_, i) => {
    const u = i / 240;
    const ink = -Math.sin(u * Math.PI) * height * .045 + Math.sin(u * Math.PI * 2) * height * .025;
    const envelope = Math.exp(-(((u - .5) * 5) ** 2));
    const carrier = Math.sin(u * Math.PI * 36) * envelope * height * .052;
    return `${i ? "L" : "M"}${width * (.07 + u * .86)},${height * .58 + ink * (1 - smooth) + carrier * smooth}`;
  }).join(" ");
  return <div aria-hidden="true" style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity,
    background: `rgba(4, 15, 25, ${smooth})` }}>
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} style={{ position: "absolute", inset: 0 }}>
      <path d={points} fill="none" stroke={t < .45 ? "#0d1a3d" : "#95ecb4"} strokeWidth={height > width ? 1.8 : 2.2}
        strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={Math.max(0, 1 - t * 3)} />
      <path d={points} fill="none" stroke="#95ecb4" strokeWidth={8} opacity={smooth * .09} />
    </svg>
  </div>;
}

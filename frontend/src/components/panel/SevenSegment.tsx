import { SEGMENTS } from '../../portfolio/segments'

// Segment rectangles inside a 20x36 digit cell.
const RECTS: Record<string, [x: number, y: number, w: number, h: number]> = {
  a: [3, 0, 14, 4],
  b: [16, 3, 4, 14],
  c: [16, 19, 4, 14],
  d: [3, 32, 14, 4],
  e: [0, 19, 4, 14],
  f: [0, 3, 4, 14],
  g: [3, 16, 14, 4],
}
const DIGIT_W = 20
const GAP = 6
const COLON_W = 8

/** A glowing LED-style readout. Unlit segments stay faintly visible, like a real display. */
export function SevenSegment({ text, label, height = '2.4em' }: { text: string; label: string; height?: string }) {
  let x = 0
  const cells = [...text].map((ch, i) => {
    const at = x
    x += (ch === ':' ? COLON_W : DIGIT_W) + GAP
    if (ch === ':') {
      return (
        <g key={i} transform={`translate(${at} 0)`} fill="var(--term-hi)">
          <circle cx={COLON_W / 2} cy={11} r={2.2} />
          <circle cx={COLON_W / 2} cy={25} r={2.2} />
        </g>
      )
    }
    const lit = SEGMENTS[ch] ?? ''
    return (
      <g key={i} transform={`translate(${at} 0) skewX(-6)`}>
        {Object.entries(RECTS).map(([seg, [rx, ry, w, h]]) => (
          <rect
            key={seg}
            x={rx}
            y={ry}
            width={w}
            height={h}
            rx={1.5}
            fill={lit.includes(seg) ? 'var(--term-hi)' : 'var(--term-dim)'}
            opacity={lit.includes(seg) ? 1 : 0.18}
          />
        ))}
      </g>
    )
  })
  const width = x - GAP + 4 // room for the skew
  return (
    <svg role="img" aria-label={label} viewBox={`-2 -1 ${width} 38`} style={{ height }} className="seven-seg overflow-visible">
      {cells}
    </svg>
  )
}

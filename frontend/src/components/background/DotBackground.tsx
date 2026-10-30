import { useEffect, useRef } from 'react'
import { BACKGROUND } from '../../portfolio/background'
import { useSettings } from '../../store/settings'

const SPACING = 12 // px between dot centres
const FPS = 20 // plenty for slow drift, light on the CPU

const clamp = (n: number) => Math.max(0, Math.min(1, n))
// Cheap deterministic noise for star placement and twinkle phase.
const hash = (x: number, y: number) => {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453
  return s - Math.floor(s)
}

/** Brightness 0..1 at grid cell (x, y) of a cols x rows screen grid. */
function level(x: number, y: number, cols: number, rows: number, t: number): number {
  const twinkle = 0.8 + 0.2 * Math.sin(t / 900 + hash(x, y) * 6.28)

  if (BACKGROUND) {
    // Fit the image like CSS background-size: cover.
    const scale = Math.max(cols / BACKGROUND.cols, rows / BACKGROUND.rows)
    const ix = Math.floor((x - (cols - BACKGROUND.cols * scale) / 2) / scale)
    const iy = Math.floor((y - (rows - BACKGROUND.rows * scale) / 2) / scale)
    if (ix < 0 || iy < 0 || ix >= BACKGROUND.cols || iy >= BACKGROUND.rows) return 0
    return (Number(BACKGROUND.levels[iy * BACKGROUND.cols + ix]) / 3) * twinkle
  }

  // Built-in scene: two dotted ridges drifting slowly, with sparse stars above.
  const u = x / cols
  const v = y / rows
  const drift = t / 6000
  const far = 0.55 + 0.07 * Math.sin(u * 5 + drift) + 0.03 * Math.sin(u * 13 - drift * 1.7)
  const near = 0.72 + 0.06 * Math.sin(u * 3.2 - drift * 0.8 + 1) + 0.025 * Math.sin(u * 17 + drift * 2.3)
  if (v > near) return clamp(1 - (v - near) * 2.6) * twinkle
  if (v > far) return clamp(0.55 - (v - far) * 1.8) * twinkle
  return hash(x, y) > 0.985 ? 0.35 * twinkle : 0
}

export function DotBackground() {
  const ref = useRef<HTMLCanvasElement>(null)
  const theme = useSettings((s) => s.theme) // redraw immediately on theme change
  const enabled = useSettings((s) => s.background)

  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx || !enabled) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let width = 0
    let height = 0
    let raf = 0
    let last = 0

    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      width = window.innerWidth
      height = window.innerHeight
      canvas.width = width * dpr
      canvas.height = height * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    const draw = (t: number) => {
      ctx.clearRect(0, 0, width, height)
      // Read the colour each frame: the theme attribute may change after this effect runs.
      ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--term-fg').trim() || '#33ff66'
      const cols = Math.ceil(width / SPACING)
      const rows = Math.ceil(height / SPACING)
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const l = level(x, y, cols, rows, t)
          if (l < 0.12) continue
          ctx.globalAlpha = 0.18 + l * 0.6
          ctx.beginPath()
          ctx.arc(x * SPACING + SPACING / 2, y * SPACING + SPACING / 2, 0.7 + l * 2.1, 0, Math.PI * 2)
          ctx.fill()
        }
      }
    }

    const loop = (t: number) => {
      raf = requestAnimationFrame(loop)
      if (document.hidden || t - last < 1000 / FPS) return
      last = t
      draw(t)
    }

    const onResize = () => {
      resize()
      draw(performance.now())
    }
    resize()
    draw(0)
    if (!reduced) raf = requestAnimationFrame(loop)
    window.addEventListener('resize', onResize)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
    }
  }, [theme, enabled])

  if (!enabled) return null
  return <canvas ref={ref} aria-hidden="true" className="pointer-events-none fixed inset-0 -z-0 h-full w-full" />
}

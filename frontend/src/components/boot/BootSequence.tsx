import { useEffect, useState } from 'react'
import { BOOT_LOG } from '../../filesystem/seed'
import { bigText } from '../../portfolio/ascii'

const LINES = [...BOOT_LOG, '', 'SYSTEM READY']
const BANNER = bigText('PeteOS')
const LINE_DELAY_MS = 140

export function BootSequence({ onDone }: { onDone: () => void }) {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const [shown, setShown] = useState(reduced ? LINES.length : 0)
  const ready = shown >= LINES.length

  useEffect(() => {
    if (ready) return
    const t = setTimeout(() => setShown((n) => n + 1), LINE_DELAY_MS)
    return () => clearTimeout(t)
  }, [shown, ready])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === 'Escape') onDone()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onDone])

  return (
    <div className="flex h-full flex-col overflow-y-auto p-4 sm:p-8">
      <div aria-live="polite" className="flex-1 whitespace-pre-wrap">
        {LINES.slice(0, shown).map((line, i) => (
          <p key={i} className={line.endsWith('OK') || line === 'SYSTEM READY' ? 'text-hi' : undefined}>
            {line || ' '}
          </p>
        ))}
        {ready && (
          <>
            <pre aria-label="PeteOS" className="glow-strong my-4 hidden text-[0.85em] leading-[1.1] text-hi sm:block">
              {BANNER}
            </pre>
            <p className="my-4 text-3xl text-hi sm:hidden">PeteOS</p>
            <button type="button" onClick={onDone} className="text-hi hover:bg-fg hover:text-bg" autoFocus>
              Press ENTER to log in<span className="cursor"> </span>
            </button>
          </>
        )}
      </div>
      {!ready && (
        <button type="button" onClick={onDone} className="self-end border border-dim px-3 text-sec hover:border-fg hover:text-hi">
          Skip boot [Esc]
        </button>
      )}
    </div>
  )
}

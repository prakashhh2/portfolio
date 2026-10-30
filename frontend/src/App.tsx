import { useCallback, useEffect, useState } from 'react'
import { DotBackground } from './components/background/DotBackground'
import { BootSequence } from './components/boot/BootSequence'
import { Terminal } from './components/terminal/Terminal'
import { useSettings } from './store/settings'

const BOOT_KEY = 'peteos.booted'

function alreadyBooted() {
  try {
    return sessionStorage.getItem(BOOT_KEY) === '1'
  } catch {
    return false
  }
}

export default function App() {
  const theme = useSettings((s) => s.theme)
  const crt = useSettings((s) => s.crt)
  const [booted, setBooted] = useState(alreadyBooted)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.documentElement.dataset.crt = crt ? 'on' : 'off'
  }, [theme, crt])

  const finishBoot = useCallback(() => {
    try {
      sessionStorage.setItem(BOOT_KEY, '1')
    } catch {
      // storage blocked: boot will just show again next visit
    }
    setBooted(true)
  }, [])

  return (
    <>
      <DotBackground />
      <main className="relative z-10 h-dvh p-0 sm:p-6">
        <div className="crt mx-auto h-full max-w-6xl">
          <div className="crt-content h-full">{booted ? <Terminal /> : <BootSequence onDone={finishBoot} />}</div>
        </div>
      </main>
    </>
  )
}

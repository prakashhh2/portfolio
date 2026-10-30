import { createContext, useContext, type ReactNode } from 'react'

// Lets any piece of command output run another command when clicked.
export const RunContext = createContext<(input: string) => void>(() => {})

export function Cmd({ run, children, plain }: { run: string; children?: ReactNode; plain?: boolean }) {
  const exec = useContext(RunContext)
  return (
    <button
      type="button"
      title={run}
      onClick={() => exec(run)}
      className={`text-left hover:bg-fg hover:text-bg ${plain ? '' : 'text-hi underline decoration-dotted underline-offset-4'}`}
    >
      {children ?? run}
    </button>
  )
}

export function ExtLink({ href, children }: { href: string; children: ReactNode }) {
  const external = /^https?:/.test(href)
  return (
    <a
      href={href}
      className="text-hi underline underline-offset-4 hover:bg-fg hover:text-bg"
      {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}
    >
      {children}
    </a>
  )
}

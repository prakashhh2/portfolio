import type { ReactNode } from 'react'
import type { Shell } from './shell'

export const CATEGORIES = ['Start here', 'Portfolio', 'Files', 'Text', 'System', 'Settings'] as const
export type Category = (typeof CATEGORIES)[number]

export type CommandContext = {
  name: string
  args: string[]
  /** Piped or redirected input; null when reading from the keyboard. */
  stdin: string | null
  stdout: (text: string) => void
  stderr: (text: string) => void
  /** Rich, clickable output. Null when stdout is piped or redirected, so commands fall back to text. */
  ui: ((node: ReactNode) => void) | null
  clear: () => void
  shell: Shell
}

export type Command = {
  name: string
  summary: string
  usage: string
  category: Category
  options?: [flag: string, description: string][]
  notes?: string
  /** Reported by `type` as a shell builtin. */
  builtin?: boolean
  /** Builtins with no file in /bin (like cd). */
  noBinary?: boolean
  run: (ctx: CommandContext) => number | Promise<number>
}

import { FsError } from '../filesystem/VirtualFileSystem'
import type { CommandContext } from './types'

export type OptSpec = {
  /** Boolean short flags, e.g. 'alhR'. */
  flags?: string
  /** Short flags that take a value, e.g. 'n'. */
  values?: string
  /** Long option -> short flag, e.g. { all: 'a', lines: 'n' }. */
  long?: Record<string, string>
  /** Flag that `-5` style numbers map to (head/tail). */
  numeric?: string
}
export type Opts = { opts: Map<string, string | true>; operands: string[] }

/** GNU-style option parsing: combined flags, values, `--`, and options after operands. */
export function getopt(ctx: CommandContext, spec: OptSpec): Opts | null {
  const opts = new Map<string, string | true>()
  const operands: string[] = []
  const { flags = '', values = '', long = {}, numeric } = spec
  const usageHint = `Try '${ctx.name} --help' for more information.\n`
  const bad = (msg: string) => {
    ctx.stderr(`${ctx.name}: ${msg}\n${usageHint}`)
    return null
  }

  const args = ctx.args
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === '--') {
      operands.push(...args.slice(i + 1))
      break
    }
    if (arg.startsWith('--')) {
      const [key, inline] = arg.slice(2).split(/=(.*)/s)
      const short = long[key]
      if (!short) return bad(`unrecognized option '${arg}'`)
      if (values.includes(short)) {
        const value = inline ?? args[++i]
        if (value === undefined) return bad(`option '--${key}' requires an argument`)
        opts.set(short, value)
      } else opts.set(short, true)
      continue
    }
    if (arg.length < 2 || !arg.startsWith('-')) {
      operands.push(arg)
      continue
    }
    for (let j = 1; j < arg.length; j++) {
      const c = arg[j]
      if (numeric && /\d/.test(c)) {
        opts.set(numeric, arg.slice(j))
        break
      }
      if (flags.includes(c)) opts.set(c, true)
      else if (values.includes(c)) {
        const value = arg.slice(j + 1) || args[++i]
        if (value === undefined) return bad(`option requires an argument -- '${c}'`)
        opts.set(c, value)
        break
      } else return bad(`invalid option -- '${c}'`)
    }
  }
  return { opts, operands }
}

/** Formats a filesystem error the GNU way, e.g. "cat: x: No such file or directory". */
export function fsFail(ctx: CommandContext, path: string, err: unknown, verb = ''): number {
  if (!(err instanceof FsError)) throw err
  ctx.stderr(`${ctx.name}: ${verb ? `${verb} '${path}'` : path}: ${err.message}\n`)
  return 1
}

/** Reads each operand (or stdin when there are none / for "-"). Errors are printed; returns ok status. */
export function readInputs(ctx: CommandContext, operands: string[], each: (content: string, name: string) => void): number {
  let status = 0
  for (const name of operands.length ? operands : ['-']) {
    if (name === '-') {
      // A real shell would wait for keyboard input; we have no interactive stdin.
      if (ctx.stdin === null) {
        ctx.stderr(`${ctx.name}: no input: give a file name or pipe text in (e.g. echo hi | ${ctx.name})\n`)
        status = 1
      } else each(ctx.stdin, '(standard input)')
      continue
    }
    try {
      each(ctx.shell.fs.readFile(ctx.shell.resolve(name)), name)
    } catch (err) {
      status = fsFail(ctx, name, err)
    }
  }
  return status
}

/** Splits text into lines, dropping the empty string after a final newline. */
export function splitLines(text: string): string[] {
  if (!text) return []
  const lines = text.split('\n')
  if (lines[lines.length - 1] === '') lines.pop()
  return lines
}

export const joinLines = (lines: string[]) => (lines.length ? lines.join('\n') + '\n' : '')

export function parseCount(ctx: CommandContext, value: string | true | undefined, fallback: number, what = 'lines'): number | null {
  if (value === undefined || value === true) return fallback
  const n = Number(value)
  if (!Number.isInteger(n) || n < 0) {
    ctx.stderr(`${ctx.name}: invalid number of ${what}: '${value}'\n`)
    return null
  }
  return n
}

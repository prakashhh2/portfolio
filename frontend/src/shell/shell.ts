import type { ReactNode } from 'react'
import { FsError, type VirtualFileSystem } from '../filesystem/VirtualFileSystem'
import { basename, joinPath, resolvePath } from '../filesystem/path'
import { ShellSyntaxError, type Pipeline, type SimpleCommand, type Word } from './ast'
import { parse } from './parser'
import type { Command, CommandContext } from './types'

export type Output = {
  stdout: (text: string) => void
  stderr: (text: string) => void
  /** Omit for plain-text output (tests, scripts). */
  ui?: (node: ReactNode) => void
  clear: () => void
}

const ASSIGNMENT = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/s

export class Shell {
  readonly env = new Map<string, string>()
  readonly history: string[] = []
  readonly startedAt = Date.now()
  status = 0

  constructor(
    public fs: VirtualFileSystem,
    public commands: Map<string, Command>,
    public home: string,
    user: string,
  ) {
    const defaults: Record<string, string> = {
      HOME: home,
      USER: user,
      LOGNAME: user,
      SHELL: '/bin/pete-sh',
      PATH: '/bin',
      PWD: home,
      HOSTNAME: 'peteos',
      TERM: 'vt100',
      LANG: 'en_US.UTF-8',
    }
    for (const [k, v] of Object.entries(defaults)) this.env.set(k, v)
  }

  get cwd(): string {
    return this.env.get('PWD') ?? '/'
  }

  resolve(path: string): string {
    return resolvePath(path, this.cwd)
  }

  /** Change directory; throws FsError like chdir(2). */
  chdir(path: string): void {
    const abs = this.resolve(path)
    if (this.fs.stat(abs).kind !== 'dir') throw new FsError('ENOTDIR')
    this.env.set('OLDPWD', this.cwd)
    this.env.set('PWD', abs)
  }

  async run(line: string, out: Output): Promise<number> {
    if (line.trim()) this.history.push(line)
    let script
    try {
      script = parse(line)
    } catch (err) {
      if (!(err instanceof ShellSyntaxError)) throw err
      out.stderr(`pete-sh: ${err.message}\n`)
      return (this.status = 2)
    }
    for (const andOr of script) {
      this.status = await this.runPipeline(andOr.first, out)
      for (const { op, pipeline } of andOr.rest) {
        if ((op === '&&') === (this.status === 0)) this.status = await this.runPipeline(pipeline, out)
      }
    }
    return this.status
  }

  private async runPipeline(cmds: Pipeline, out: Output): Promise<number> {
    let stdin: string | null = null
    let status = 0
    for (let i = 0; i < cmds.length; i++) {
      const result = await this.runSimple(cmds[i], i === 0 ? null : stdin, out, i < cmds.length - 1)
      status = result.status
      stdin = result.piped
    }
    return status // like bash without pipefail: the last command's status
  }

  private async runSimple(cmd: SimpleCommand, pipeIn: string | null, out: Output, piped: boolean) {
    const fail = (msg: string, status = 1) => {
      out.stderr(`pete-sh: ${msg}\n`)
      return { status, piped: '' }
    }

    const argv = cmd.words.flatMap((w) => this.expand(w))

    // Standalone NAME=value words set shell variables.
    if (argv.length && argv.every((a) => ASSIGNMENT.test(a))) {
      for (const a of argv) {
        const [, k, v] = a.match(ASSIGNMENT)!
        this.env.set(k, v)
      }
      return { status: 0, piped: '' }
    }
    if (argv.length && ASSIGNMENT.test(argv[0])) return fail('per-command variable assignments (NAME=value cmd) are not supported')

    // Redirections are opened before the command runs, as in bash.
    let stdinText = pipeIn
    let outFile: string | null = null
    let errFile: string | null = null
    let mergeErr = false
    for (const r of cmd.redirects) {
      if (r.op === '2>&1') {
        mergeErr = true
        continue
      }
      const targets = this.expand(r.target!)
      if (targets.length !== 1) return fail(`${targets.join(' ') || "''"}: ambiguous redirect`)
      const abs = this.resolve(targets[0])
      try {
        if (r.op === '<') stdinText = this.fs.readFile(abs)
        else {
          this.fs.writeFile(abs, '', r.op.endsWith('>>')) // create, or truncate for '>'
          if (r.op === '2>' || r.op === '2>>') errFile = abs
          else outFile = abs
          if (r.op === '&>') mergeErr = true
        }
      } catch (err) {
        if (err instanceof FsError) return fail(`${targets[0]}: ${err.message}`)
        throw err
      }
    }

    let outBuf = ''
    let errBuf = ''
    const toTerminal = !outFile && !piped
    const stdout = toTerminal ? out.stdout : (t: string) => void (outBuf += t)
    const stderr = mergeErr ? stdout : errFile ? (t: string) => void (errBuf += t) : out.stderr

    let status = 0
    if (argv.length) {
      const name = argv[0]
      const found = this.lookup(name)
      if (typeof found === 'string') {
        stderr(`pete-sh: ${found}\n`)
        status = found.endsWith('Permission denied') ? 126 : 127
      } else {
        const ctx: CommandContext = {
          name: found.name,
          args: argv.slice(1),
          stdin: stdinText,
          stdout,
          stderr,
          ui: toTerminal ? (out.ui ?? null) : null,
          clear: out.clear,
          shell: this,
        }
        if (ctx.args.length === 1 && ctx.args[0] === '--help') {
          stdout(`Usage: ${found.usage}\n${found.summary}\n`)
        } else {
          try {
            status = await found.run(ctx)
          } catch (err) {
            stderr(`${name}: ${err instanceof Error ? err.message : String(err)}\n`)
            status = 1
          }
        }
      }
    }

    if (outFile) this.fs.writeFile(outFile, outBuf, true)
    if (errFile) this.fs.writeFile(errFile, errBuf, true)
    return { status, piped: piped && !outFile ? outBuf : '' }
  }

  /** Finds a command by name or by path (/bin/ls). Returns an error message if not runnable. */
  private lookup(name: string): Command | string {
    if (!name.includes('/')) {
      const cmd = this.commands.get(name)
      if (cmd) return cmd
      const guess = this.suggest(name)
      return `${name}: command not found${guess ? ` (did you mean '${guess}'?)` : ''}`
    }
    const abs = this.resolve(name)
    if (!this.fs.exists(abs)) return `${name}: No such file or directory`
    const cmd = abs.startsWith('/bin/') ? this.commands.get(basename(abs)) : undefined
    if (cmd && !cmd.noBinary) return cmd
    return `${name}: Permission denied`
  }

  private suggest(name: string): string | undefined {
    let best: string | undefined
    let bestScore = name.length > 3 ? 3 : 2
    for (const key of this.commands.keys()) {
      const score = editDistance(name, key)
      if (score < bestScore) [best, bestScore] = [key, score]
    }
    return best
  }

  /** Expand one word into zero or more argv entries: variables, ~, then globs. */
  expand(word: Word): string[] {
    const only = word.length === 1 ? word[0] : null
    if (only?.kind === 'var' && !only.quoted) {
      // Unquoted lone variable: split into fields like bash.
      return this.varValue(only.name).split(/\s+/).filter(Boolean)
    }
    let value = ''
    let pattern = ''
    let hasGlob = false
    for (const part of word) {
      const text = part.kind === 'tilde' ? this.home : part.kind === 'var' ? this.varValue(part.name) : part.value
      value += text
      if (part.kind === 'text' && !part.quoted) {
        pattern += text.replace(/\\/g, '\\\\')
        hasGlob ||= /[*?]/.test(text)
      } else pattern += escapeGlob(text)
    }
    if (hasGlob) {
      const matches = this.glob(pattern)
      if (matches.length) return matches
    }
    return [value]
  }

  private varValue(name: string): string {
    return name === '?' ? String(this.status) : (this.env.get(name) ?? '')
  }

  /** Filename expansion for * and ?, segment by segment. Results are sorted. */
  glob(pattern: string): string[] {
    const results: string[] = []
    const segs = pattern.split('/')
    const walk = (dirAbs: string, shown: string, i: number) => {
      if (i === segs.length) return results.push(shown)
      const seg = segs[i]
      const join = (name: string) => (i === 0 && shown === '' ? name : shown === '/' ? `/${name}` : `${shown}/${name}`)
      if (seg === '') return walk(dirAbs, i === 0 ? '/' : shown, i + 1)
      if (!/(^|[^\\])[*?]/.test(seg)) {
        const name = seg.replace(/\\(.)/g, '$1')
        const next = resolvePath(name, dirAbs)
        if (this.fs.exists(next)) walk(next, join(name), i + 1)
        return
      }
      let entries
      try {
        entries = this.fs.readDir(dirAbs)
      } catch {
        return
      }
      const re = globToRegExp(seg)
      for (const [name, node] of entries) {
        if (name.startsWith('.') && !seg.startsWith('.')) continue
        if (!re.test(name)) continue
        if (i < segs.length - 1 && node.kind !== 'dir') continue
        walk(joinPath(dirAbs, name), join(name), i + 1)
      }
    }
    walk(pattern.startsWith('/') ? '/' : this.cwd, '', 0)
    return results
  }

  /** Tab completion for the last word of `line`. */
  complete(line: string): { line: string; options: string[] } {
    const start = Math.max(...[' ', '|', ';', '&', '>', '<'].map((c) => line.lastIndexOf(c))) + 1
    const word = line.slice(start)
    const before = line.slice(0, start).trimEnd()
    const commandPosition = before === '' || /(\||;|&&|\|\|)$/.test(before)

    let candidates: string[]
    let prefix = ''
    let base = word
    if (commandPosition && !word.includes('/')) {
      candidates = [...this.commands.keys()].filter((n) => n.startsWith(word)).map((n) => n + ' ')
    } else {
      const slash = word.lastIndexOf('/')
      prefix = slash === -1 ? '' : word.slice(0, slash + 1)
      base = word.slice(slash + 1)
      const dirPath = prefix.replace(/^~(?=\/|$)/, this.home) || '.'
      try {
        candidates = this.fs
          .readDir(this.resolve(dirPath))
          .filter(([name]) => name.startsWith(base) && (base.startsWith('.') || !name.startsWith('.')))
          .map(([name, node]) => name + (node.kind === 'dir' ? '/' : ' '))
      } catch {
        candidates = []
      }
    }
    if (!candidates.length) return { line, options: [] }
    const common = candidates.length === 1 ? candidates[0] : commonPrefix(candidates.map((c) => c.trimEnd()))
    const head = line.slice(0, start) + (commandPosition && !word.includes('/') ? '' : prefix)
    return { line: head + common, options: candidates.length > 1 ? candidates.map((c) => c.trimEnd()) : [] }
  }
}

function escapeGlob(s: string): string {
  return s.replace(/[\\*?]/g, '\\$&')
}

function globToRegExp(seg: string): RegExp {
  let re = ''
  for (let i = 0; i < seg.length; i++) {
    const c = seg[i]
    if (c === '\\' && i + 1 < seg.length) re += seg[++i].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    else if (c === '*') re += '.*'
    else if (c === '?') re += '.'
    else re += c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }
  return new RegExp(`^${re}$`)
}

function commonPrefix(words: string[]): string {
  return words.reduce((acc, w) => {
    let i = 0
    while (i < acc.length && acc[i] === w[i]) i++
    return acc.slice(0, i)
  })
}

export function editDistance(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  let prevPrev = prev
  for (let i = 1; i <= a.length; i++) {
    const row = [i]
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
      // A swap of two neighbouring letters ("hlep") counts as one edit.
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) row[j] = Math.min(row[j], prevPrev[j - 2] + 1)
    }
    prevPrev = prev
    prev = row
  }
  return prev[b.length]
}

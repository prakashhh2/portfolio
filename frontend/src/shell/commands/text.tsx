import { joinPath } from '../../filesystem/path'
import type { Command } from '../types'
import { fsFail, getopt, joinLines, readInputs, splitLines } from '../util'

function unescape(s: string): { text: string; stop: boolean } {
  // "\c" means: stop output here.
  const cut = s.indexOf('\\c')
  const body = cut === -1 ? s : s.slice(0, cut)
  const map: Record<string, string> = { n: '\n', t: '\t', '\\': '\\', a: '\x07', r: '\r', '0': '\0' }
  return { text: body.replace(/\\([ntar0\\])/g, (_, c: string) => map[c]), stop: cut !== -1 }
}

const echo: Command = {
  name: 'echo',
  summary: 'display a line of text',
  usage: 'echo [-neE] [STRING]...',
  category: 'Text',
  builtin: true,
  options: [
    ['-n', 'do not output the trailing newline'],
    ['-e', 'enable interpretation of backslash escapes (\\n, \\t, \\\\)'],
  ],
  run(ctx) {
    const args = [...ctx.args]
    let newline = true
    let escapes = false
    while (args[0] && /^-[neE]+$/.test(args[0])) {
      const flag = args.shift()!
      if (flag.includes('n')) newline = false
      if (flag.includes('e')) escapes = true
      if (flag.includes('E')) escapes = false
    }
    let text = args.join(' ')
    if (escapes) {
      const r = unescape(text)
      text = r.text
      if (r.stop) newline = false
    }
    ctx.stdout(text + (newline ? '\n' : ''))
    return 0
  },
}

/** printf-style formatting: %s %d %i %f %c %x %% with flags, width and precision. */
export function format(fmt: string, args: string[]): string {
  let out = ''
  let i = 0
  do {
    let used = 0
    out += unescape(fmt).text.replace(/%([-+ 0]*)(\d+)?(?:\.(\d+))?([sdifcx%])/g, (_, flags: string, width?: string, prec?: string, conv?: string) => {
      if (conv === '%') return '%'
      const arg = args[i++] ?? ''
      used++
      let s: string
      if (conv === 's') s = prec ? arg.slice(0, Number(prec)) : arg
      else if (conv === 'c') s = arg.charAt(0)
      else if (conv === 'f') s = (Number(arg) || 0).toFixed(prec ? Number(prec) : 6)
      else if (conv === 'x') s = Math.trunc(Number(arg) || 0).toString(16)
      else s = String(Math.trunc(Number(arg) || 0))
      if (flags.includes('+') && conv !== 's' && !s.startsWith('-')) s = '+' + s
      const w = Number(width ?? 0)
      if (flags.includes('-')) return s.padEnd(w)
      return flags.includes('0') && conv !== 's' ? s.padStart(w, '0') : s.padStart(w)
    })
    if (!used) break
  } while (i < args.length)
  return out
}

const printf: Command = {
  name: 'printf',
  summary: 'format and print data',
  usage: 'printf FORMAT [ARGUMENT]...',
  category: 'Text',
  builtin: true,
  notes: 'Supports %s %d %i %f %c %x %% with flags (-, +, 0), width and precision. The format is reused while arguments remain.',
  run(ctx) {
    if (!ctx.args.length) {
      ctx.stderr('pete-sh: printf: usage: printf format [arguments]\n')
      return 2
    }
    ctx.stdout(format(ctx.args[0], ctx.args.slice(1)))
    return 0
  },
}

function Highlighted({ lines }: { lines: { prefix: string; parts: [string, boolean][] }[] }) {
  return (
    <div>
      {lines.map((l, i) => (
        <p key={i}>
          {l.prefix && <span className="text-sec">{l.prefix}</span>}
          {l.parts.map(([t, hit], j) => (hit ? <span key={j} className="bg-fg text-bg">{t}</span> : <span key={j}>{t}</span>))}
        </p>
      ))}
    </div>
  )
}

const grep: Command = {
  name: 'grep',
  summary: 'print lines that match patterns',
  usage: 'grep [-ivnclrhHwFE] PATTERN [FILE]...',
  category: 'Text',
  options: [
    ['-i', 'ignore case'],
    ['-v', 'select non-matching lines'],
    ['-n', 'prefix each line with its line number'],
    ['-c', 'print only a count of matching lines per file'],
    ['-l', 'print only names of files with matches'],
    ['-r, -R', 'search directories recursively'],
    ['-w', 'match whole words only'],
    ['-F', 'treat PATTERN as a fixed string'],
    ['-h / -H', 'suppress / force file name prefixes'],
  ],
  notes: 'Patterns are JavaScript regular expressions (close to grep -E). Exit status is 0 if a line matched, 1 if none, 2 on error.',
  run(ctx) {
    const o = getopt(ctx, {
      flags: 'ivnclrRhHwFE',
      long: { 'ignore-case': 'i', 'invert-match': 'v', 'line-number': 'n', count: 'c', recursive: 'r', 'files-with-matches': 'l' },
    })
    if (!o) return 2
    const has = (f: string) => o.opts.has(f)
    const [pattern, ...files] = o.operands
    if (pattern === undefined) {
      ctx.stderr("Usage: grep [OPTION]... PATTERNS [FILE]...\nTry 'grep --help' for more information.\n")
      return 2
    }
    let source = has('F') ? pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : pattern
    if (has('w')) source = `\\b(?:${source})\\b`
    let re: RegExp
    try {
      re = new RegExp(source, has('i') ? 'gi' : 'g')
    } catch {
      ctx.stderr(`grep: Invalid regular expression: '${pattern}'\n`)
      return 2
    }
    const recursive = has('r') || has('R')
    const { fs } = ctx.shell

    // Expand directories when recursive.
    let status = 0
    const inputs: string[] = []
    for (const f of files.length ? files : recursive ? ['.'] : []) {
      try {
        const abs = ctx.shell.resolve(f)
        if (fs.stat(abs).kind === 'dir') {
          if (!recursive) {
            ctx.stderr(`grep: ${f}: Is a directory\n`)
            status = 2
            continue
          }
          fs.walk(abs, (p, node) => {
            if (node.kind === 'file') inputs.push(f === '.' ? p.slice(abs.length + 1) : joinPath(f.replace(/\/$/, ''), p.slice(abs.length + 1)))
          })
        } else inputs.push(f)
      } catch (err) {
        status = fsFail(ctx, f, err) && 2
      }
    }
    const showName = has('H') || (!has('h') && (inputs.length > 1 || recursive))

    const textOut: string[] = []
    const rich: { prefix: string; parts: [string, boolean][] }[] = []
    let matched = false
    const scan = (content: string, name: string) => {
      let count = 0
      splitLines(content).forEach((line, idx) => {
        re.lastIndex = 0
        if (re.test(line) === has('v')) return
        count++
        matched = true
        if (has('c') || has('l')) return
        const prefix = (showName ? `${name}:` : '') + (has('n') ? `${idx + 1}:` : '')
        textOut.push(prefix + line)
        const parts: [string, boolean][] = []
        if (has('v')) parts.push([line, false])
        else {
          let last = 0
          for (const m of line.matchAll(re)) {
            if (!m[0]) continue
            parts.push([line.slice(last, m.index), false], [m[0], true])
            last = m.index! + m[0].length
          }
          parts.push([line.slice(last), false])
        }
        rich.push({ prefix, parts })
      })
      if (has('c')) {
        const line = (showName ? `${name}:` : '') + count
        textOut.push(line)
        rich.push({ prefix: '', parts: [[line, false]] })
      } else if (has('l') && count) {
        textOut.push(name)
        rich.push({ prefix: '', parts: [[name, false]] })
      }
    }
    // No files and no -r: read stdin. Otherwise read the (already validated) file list.
    const readStatus = files.length || recursive ? readInputs(ctx, inputs, scan) : readInputs(ctx, [], scan)
    if (readStatus) status = 2
    if (ctx.ui && rich.length && !has('c') && !has('l')) ctx.ui(<Highlighted lines={rich} />)
    else ctx.stdout(joinLines(textOut))
    return status === 2 ? 2 : matched ? 0 : 1
  },
}

const wc: Command = {
  name: 'wc',
  summary: 'print newline, word, and byte counts',
  usage: 'wc [-lwc] [FILE]...',
  category: 'Text',
  options: [
    ['-l, --lines', 'print the newline counts'],
    ['-w, --words', 'print the word counts'],
    ['-c, --bytes', 'print the byte counts'],
  ],
  run(ctx) {
    const o = getopt(ctx, { flags: 'lwc', long: { lines: 'l', words: 'w', bytes: 'c' } })
    if (!o) return 2
    const pick = ['l', 'w', 'c'].filter((f) => o.opts.has(f))
    const cols = pick.length ? pick : ['l', 'w', 'c']
    const rows: [number[], string][] = []
    const totals = [0, 0, 0]
    const status = readInputs(ctx, o.operands, (content, name) => {
      const counts = [
        (content.match(/\n/g) ?? []).length,
        content.split(/\s+/).filter(Boolean).length,
        new TextEncoder().encode(content).length,
      ]
      counts.forEach((c, i) => (totals[i] += c))
      rows.push([counts, o.operands.length ? name : ''])
    })
    if (rows.length > 1) rows.push([totals, 'total'])
    const values = rows.map(([counts, name]) => [cols.map((c) => counts['lwc'.indexOf(c)]), name] as const)
    const single = values.length === 1 && cols.length === 1 && !values[0][1]
    const width = single ? 0 : Math.max(...values.flatMap(([v]) => v.map((n) => String(n).length)))
    ctx.stdout(joinLines(values.map(([v, name]) => [...v.map((n) => String(n).padStart(width)), ...(name ? [name] : [])].join(' '))))
    return status
  },
}

const sort: Command = {
  name: 'sort',
  summary: 'sort lines of text',
  usage: 'sort [-rnuf] [FILE]...',
  category: 'Text',
  options: [
    ['-r, --reverse', 'reverse the result'],
    ['-n, --numeric-sort', 'compare by leading number'],
    ['-u, --unique', 'output only the first of equal lines'],
    ['-f, --ignore-case', 'fold lower case to upper case'],
  ],
  run(ctx) {
    const o = getopt(ctx, { flags: 'rnuf', long: { reverse: 'r', 'numeric-sort': 'n', unique: 'u', 'ignore-case': 'f' } })
    if (!o) return 2
    const lines: string[] = []
    const status = readInputs(ctx, o.operands, (content) => lines.push(...splitLines(content)))
    const key = (s: string) => (o.opts.has('f') ? s.toLowerCase() : s)
    const num = (s: string) => parseFloat(s.trim()) || 0
    let sorted = [...lines].sort((a, b) => (o.opts.has('n') ? num(a) - num(b) : 0) || key(a).localeCompare(key(b)))
    if (o.opts.has('r')) sorted.reverse()
    if (o.opts.has('u')) sorted = sorted.filter((l, i) => i === 0 || key(l) !== key(sorted[i - 1]))
    ctx.stdout(joinLines(sorted))
    return status
  },
}

const uniq: Command = {
  name: 'uniq',
  summary: 'report or omit repeated adjacent lines',
  usage: 'uniq [-cdi] [FILE]',
  category: 'Text',
  options: [
    ['-c, --count', 'prefix lines by the number of occurrences'],
    ['-d, --repeated', 'only print duplicate lines'],
    ['-i, --ignore-case', 'ignore differences in case'],
  ],
  run(ctx) {
    const o = getopt(ctx, { flags: 'cdi', long: { count: 'c', repeated: 'd', 'ignore-case': 'i' } })
    if (!o) return 2
    if (o.operands.length > 1) {
      ctx.stderr(`uniq: extra operand '${o.operands[1]}' (writing to a file: use > instead)\n`)
      return 1
    }
    const lines: string[] = []
    const status = readInputs(ctx, o.operands, (content) => lines.push(...splitLines(content)))
    const same = (a: string, b: string) => (o.opts.has('i') ? a.toLowerCase() === b.toLowerCase() : a === b)
    const groups: [string, number][] = []
    for (const l of lines) {
      const last = groups[groups.length - 1]
      if (last && same(last[0], l)) last[1]++
      else groups.push([l, 1])
    }
    const out = groups.filter(([, n]) => !o.opts.has('d') || n > 1).map(([l, n]) => (o.opts.has('c') ? `${String(n).padStart(7)} ${l}` : l))
    ctx.stdout(joinLines(out))
    return status
  },
}

function parseList(list: string): ((n: number) => boolean) | null {
  const ranges: [number, number][] = []
  for (const part of list.split(',')) {
    const m = part.match(/^(\d*)-?(\d*)$/)
    if (!m || part === '-' || part === '') return null
    const lo = m[1] ? Number(m[1]) : 1
    const hi = part.includes('-') ? (m[2] ? Number(m[2]) : Infinity) : lo
    if (lo < 1) return null
    ranges.push([lo, hi])
  }
  return (n) => ranges.some(([lo, hi]) => n >= lo && n <= hi)
}

const cut: Command = {
  name: 'cut',
  summary: 'remove sections from each line',
  usage: 'cut (-f LIST [-d DELIM] | -c LIST) [FILE]...',
  category: 'Text',
  options: [
    ['-f LIST', 'select fields, e.g. 1,3 or 2-4'],
    ['-d DELIM', 'use DELIM instead of TAB as the field delimiter'],
    ['-c LIST', 'select characters'],
  ],
  run(ctx) {
    const o = getopt(ctx, { values: 'fdc', long: { fields: 'f', delimiter: 'd', characters: 'c' } })
    if (!o) return 2
    const fields = o.opts.get('f') as string | undefined
    const chars = o.opts.get('c') as string | undefined
    if (!fields === !chars) {
      ctx.stderr(`cut: ${fields ? 'only one type of list may be specified' : 'you must specify a list of bytes, characters, or fields'}\nTry 'cut --help' for more information.\n`)
      return 1
    }
    const delim = (o.opts.get('d') as string | undefined) ?? '\t'
    if (delim.length !== 1) {
      ctx.stderr('cut: the delimiter must be a single character\n')
      return 1
    }
    const keep = parseList(fields ?? chars!)
    if (!keep) {
      ctx.stderr(`cut: invalid field range\n`)
      return 1
    }
    const out: string[] = []
    const status = readInputs(ctx, o.operands, (content) => {
      for (const line of splitLines(content)) {
        if (chars) out.push([...line].filter((_, i) => keep(i + 1)).join(''))
        else if (!line.includes(delim)) out.push(line)
        else out.push(line.split(delim).filter((_, i) => keep(i + 1)).join(delim))
      }
    })
    ctx.stdout(joinLines(out))
    return status
  },
}

export const textCommands: Command[] = [echo, printf, grep, wc, sort, uniq, cut]

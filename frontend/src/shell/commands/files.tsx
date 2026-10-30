import { byteSize, FsError, type FsNode } from '../../filesystem/VirtualFileSystem'
import { basename, dirname, joinPath, resolvePath, tildify } from '../../filesystem/path'
import { Cmd } from '../../components/terminal/ui'
import type { Command, CommandContext } from '../types'
import { fsFail, getopt, joinLines, parseCount, readInputs, splitLines } from '../util'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const pad2 = (n: number) => String(n).padStart(2, '0')

/** Print a usage error and return exit status 1. */
function complain(ctx: CommandContext, message: string): number {
  ctx.stderr(message)
  return 1
}

export function modeString(node: FsNode): string {
  const bits = node.mode
  const rwx = (shift: number) =>
    ((bits >> shift) & 4 ? 'r' : '-') + ((bits >> shift) & 2 ? 'w' : '-') + ((bits >> shift) & 1 ? 'x' : '-')
  let others = rwx(0)
  if (bits & 0o1000) others = others.slice(0, 2) + (bits & 1 ? 't' : 'T')
  return (node.kind === 'dir' ? 'd' : '-') + rwx(6) + rwx(3) + others
}

function lsDate(ms: number): string {
  const d = new Date(ms)
  const recent = Math.abs(Date.now() - ms) < 182 * 86_400_000
  const day = String(d.getDate()).padStart(2, ' ')
  return `${MONTHS[d.getMonth()]} ${day} ${recent ? `${pad2(d.getHours())}:${pad2(d.getMinutes())}` : ` ${d.getFullYear()}`}`
}

export function humanSize(bytes: number): string {
  if (bytes < 1024) return String(bytes)
  const units = ['K', 'M', 'G']
  let n = bytes / 1024
  let u = 0
  while (n >= 1024 && u < units.length - 1) [n, u] = [n / 1024, u + 1]
  return (n < 10 ? (Math.ceil(n * 10) / 10).toFixed(1) : String(Math.ceil(n))) + units[u]
}

const links = (node: FsNode) => (node.kind === 'dir' ? 2 + [...node.children.values()].filter((c) => c.kind === 'dir').length : 1)
const blocks = (node: FsNode) => (node.kind === 'dir' ? 4 : Math.ceil(byteSize(node) / 4096) * 4)

function longLines(entries: [string, FsNode][], human: boolean): string[] {
  const rows = entries.map(([name, node]) => [
    modeString(node),
    String(links(node)),
    node.owner,
    node.owner,
    human ? humanSize(byteSize(node)) : String(byteSize(node)),
    lsDate(node.mtime),
    name,
  ])
  const width = (col: number) => Math.max(0, ...rows.map((r) => r[col].length))
  const [w1, w2, w3, w4] = [1, 2, 3, 4].map(width)
  return rows.map(
    ([mode, n, owner, group, size, date, name]) =>
      `${mode} ${n.padStart(w1)} ${owner.padEnd(w2)} ${group.padEnd(w3)} ${size.padStart(w4)} ${date} ${name}`,
  )
}

/** Clickable name grid: directories open, files print. */
function LsGrid({ items }: { items: { name: string; dir: boolean; path: string }[] }) {
  return (
    <p className="flex flex-wrap gap-x-[2ch]">
      {items.map((it) => (
        <Cmd key={it.name} run={it.dir ? `cd ${it.path} && ls` : `cat ${it.path}`} plain>
          <span className={it.dir ? 'text-hi font-bold' : undefined}>{it.name}</span>
        </Cmd>
      ))}
    </p>
  )
}

const ls: Command = {
  name: 'ls',
  summary: 'list directory contents',
  usage: 'ls [-1aAlhR] [FILE]...',
  category: 'Files',
  options: [
    ['-a, --all', 'do not ignore entries starting with .'],
    ['-A, --almost-all', 'like -a, but without . and ..'],
    ['-l', 'use a long listing format'],
    ['-h, --human-readable', 'with -l, print sizes like 1.2K'],
    ['-R, --recursive', 'list subdirectories recursively'],
    ['-1', 'list one file per line'],
  ],
  run(ctx) {
    const o = getopt(ctx, { flags: 'aAlhR1', long: { all: 'a', 'almost-all': 'A', 'human-readable': 'h', recursive: 'R' } })
    if (!o) return 2
    const has = (f: string) => o.opts.has(f)
    const { fs } = ctx.shell
    const targets = o.operands.length ? o.operands : ['.']
    let status = 0
    const files: [string, FsNode][] = []
    const dirs: [string, string][] = []
    for (const t of targets) {
      try {
        const abs = ctx.shell.resolve(t)
        const node = fs.stat(abs)
        if (node.kind === 'dir') dirs.push([t, abs])
        else files.push([t, node])
      } catch (err) {
        if (!(err instanceof FsError)) throw err
        ctx.stderr(`ls: cannot access '${t}': ${err.message}\n`)
        status = 2
      }
    }

    const sections: string[] = []
    const emit = (entries: [string, FsNode][], dirAbs: string | null, header: string | null) => {
      const prefix = header ? `${header}:\n` : ''
      if (has('l')) {
        const total = dirAbs ? [`total ${entries.reduce((s, [, n]) => s + blocks(n), 0)}`] : []
        sections.push(prefix + joinLines([...total, ...longLines(entries, has('h'))]))
      } else if (ctx.ui && !has('1')) {
        if (sections.length) ctx.stdout(sections.splice(0).join('\n') + '\n')
        if (header) ctx.stdout(prefix)
        ctx.ui(
          <LsGrid
            items={entries.map(([name, node]) => ({
              name,
              dir: node.kind === 'dir',
              path: shellQuote(tildify(dirAbs ? resolvePath(name, dirAbs) : ctx.shell.resolve(name), ctx.shell.home)),
            }))}
          />,
        )
        sections.push('') // keep a blank line before the next section
      } else {
        sections.push(prefix + joinLines(entries.map(([n]) => n)))
      }
    }

    const listDir = (shown: string, abs: string) => {
      let entries = fs.readDir(abs)
      if (!has('a') && !has('A')) entries = entries.filter(([n]) => !n.startsWith('.'))
      if (has('a')) entries = [['.', fs.stat(abs)], ['..', fs.stat(dirname(abs))], ...entries]
      const header = has('R') || targets.length > 1 ? shown : null
      emit(entries, abs, header)
      if (has('R')) {
        for (const [name, node] of entries) {
          if (node.kind === 'dir' && name !== '.' && name !== '..') listDir(shown === '/' ? `/${name}` : `${shown}/${name}`, joinPath(abs, name))
        }
      }
    }

    if (files.length) emit(files, null, null)
    for (const [shown, abs] of dirs) listDir(shown, abs)
    const text = sections.filter((s, i) => s || i < sections.length - 1).join('\n')
    if (text.trim()) ctx.stdout(text)
    return status
  },
}

function shellQuote(s: string): string {
  return /^[\w@%+=:,./~-]+$/.test(s) ? s : `'${s.replace(/'/g, `'\\''`)}'`
}

const cd: Command = {
  name: 'cd',
  summary: 'change the working directory',
  usage: 'cd [DIR]',
  category: 'Files',
  builtin: true,
  noBinary: true,
  notes: 'With no DIR, goes to $HOME. "cd -" returns to the previous directory.',
  run(ctx) {
    if (ctx.args.length > 1) {
      ctx.stderr('pete-sh: cd: too many arguments\n')
      return 1
    }
    let target = ctx.args[0] ?? ctx.shell.home
    if (target === '-') {
      const old = ctx.shell.env.get('OLDPWD')
      if (!old) {
        ctx.stderr('pete-sh: cd: OLDPWD not set\n')
        return 1
      }
      target = old
    }
    try {
      ctx.shell.chdir(target)
    } catch (err) {
      if (!(err instanceof FsError)) throw err
      ctx.stderr(`pete-sh: cd: ${target}: ${err.message}\n`)
      return 1
    }
    if (ctx.args[0] === '-') ctx.stdout(ctx.shell.cwd + '\n')
    return 0
  },
}

const pwd: Command = {
  name: 'pwd',
  summary: 'print name of current/working directory',
  usage: 'pwd',
  category: 'Files',
  builtin: true,
  run(ctx) {
    if (!getopt(ctx, { flags: 'LP' })) return 2
    ctx.stdout(ctx.shell.cwd + '\n')
    return 0
  },
}

const tree: Command = {
  name: 'tree',
  summary: 'list contents of directories in a tree-like format',
  usage: 'tree [-adL level] [DIR]',
  category: 'Files',
  options: [
    ['-a', 'include hidden files'],
    ['-d', 'list directories only'],
    ['-L level', 'descend at most level directories deep'],
  ],
  notes: 'Uses ASCII line drawing, like tree --charset=ascii.',
  run(ctx) {
    const o = getopt(ctx, { flags: 'ad', values: 'L' })
    if (!o) return 2
    const max = parseCount(ctx, o.opts.get('L'), Infinity, 'levels')
    if (max === null) return 2
    const root = o.operands[0] ?? '.'
    const { fs } = ctx.shell
    let abs
    try {
      abs = ctx.shell.resolve(root)
      if (fs.stat(abs).kind !== 'dir') throw new FsError('ENOTDIR')
    } catch (err) {
      return fsFail(ctx, root, err) && 2
    }
    const out = [root]
    let nDirs = 0
    let nFiles = 0
    const walk = (dir: string, indent: string, depth: number) => {
      if (depth > max) return
      const entries = fs
        .readDir(dir)
        .filter(([n, node]) => (o.opts.has('a') || !n.startsWith('.')) && (!o.opts.has('d') || node.kind === 'dir'))
      entries.forEach(([name, node], i) => {
        const last = i === entries.length - 1
        out.push(`${indent}${last ? '`-- ' : '|-- '}${name}`)
        if (node.kind === 'dir') {
          nDirs++
          walk(joinPath(dir, name), indent + (last ? '    ' : '|   '), depth + 1)
        } else nFiles++
      })
    }
    walk(abs, '', 1)
    out.push('', `${nDirs} director${nDirs === 1 ? 'y' : 'ies'}${o.opts.has('d') ? '' : `, ${nFiles} file${nFiles === 1 ? '' : 's'}`}`)
    ctx.stdout(joinLines(out))
    return 0
  },
}

const cat: Command = {
  name: 'cat',
  summary: 'concatenate files and print on the standard output',
  usage: 'cat [-n] [FILE]...',
  category: 'Files',
  options: [['-n, --number', 'number all output lines']],
  run(ctx) {
    const o = getopt(ctx, { flags: 'n', long: { number: 'n' } })
    if (!o) return 2
    let n = 0
    return readInputs(ctx, o.operands, (content) => {
      if (!o.opts.has('n')) return ctx.stdout(content)
      const lines = content.split('\n')
      const tail = lines.pop() // text after the last newline (usually empty)
      ctx.stdout(lines.map((l) => `${String(++n).padStart(6)}\t${l}\n`).join('') + (tail ? `${String(++n).padStart(6)}\t${tail}` : ''))
    })
  },
}

function headTail(which: 'head' | 'tail'): Command {
  return {
    name: which,
    summary: `output the ${which === 'head' ? 'first' : 'last'} part of files`,
    usage: `${which} [-n NUM] [FILE]...`,
    category: 'Files',
    options: [['-n, --lines=NUM', `print the ${which === 'head' ? 'first' : 'last'} NUM lines instead of 10`]],
    run(ctx) {
      const o = getopt(ctx, { values: 'n', long: { lines: 'n' }, numeric: 'n' })
      if (!o) return 2
      const count = parseCount(ctx, o.opts.get('n'), 10)
      if (count === null) return 1
      const many = o.operands.length > 1
      let first = true
      return readInputs(ctx, o.operands, (content, name) => {
        const lines = splitLines(content)
        const picked = which === 'head' ? lines.slice(0, count) : count === 0 ? [] : lines.slice(-count)
        if (many) ctx.stdout(`${first ? '' : '\n'}==> ${name} <==\n`)
        first = false
        ctx.stdout(joinLines(picked))
      })
    },
  }
}

const touch: Command = {
  name: 'touch',
  summary: 'create empty files or update timestamps',
  usage: 'touch FILE...',
  category: 'Files',
  run(ctx) {
    const o = getopt(ctx, {})
    if (!o) return 2
    if (!o.operands.length) return complain(ctx, "touch: missing file operand\nTry 'touch --help' for more information.\n")
    let status = 0
    for (const f of o.operands) {
      try {
        ctx.shell.fs.touch(ctx.shell.resolve(f))
      } catch (err) {
        status = fsFail(ctx, f, err, 'cannot touch')
      }
    }
    return status
  },
}

const mkdir: Command = {
  name: 'mkdir',
  summary: 'make directories',
  usage: 'mkdir [-p] DIRECTORY...',
  category: 'Files',
  options: [['-p, --parents', 'no error if existing, make parent directories as needed']],
  run(ctx) {
    const o = getopt(ctx, { flags: 'p', long: { parents: 'p' } })
    if (!o) return 2
    if (!o.operands.length) return complain(ctx, "mkdir: missing operand\nTry 'mkdir --help' for more information.\n")
    let status = 0
    for (const d of o.operands) {
      try {
        ctx.shell.fs.mkdir(ctx.shell.resolve(d), o.opts.has('p'))
      } catch (err) {
        status = fsFail(ctx, d, err, 'cannot create directory')
      }
    }
    return status
  },
}

const rm: Command = {
  name: 'rm',
  summary: 'remove files or directories',
  usage: 'rm [-rf] FILE...',
  category: 'Files',
  options: [
    ['-r, -R, --recursive', 'remove directories and their contents recursively'],
    ['-f, --force', 'ignore nonexistent files, never prompt'],
  ],
  notes: 'Portfolio files are read-only; you can only remove files you created.',
  run(ctx) {
    const o = getopt(ctx, { flags: 'rRf', long: { recursive: 'r', force: 'f' } })
    if (!o) return 2
    const force = o.opts.has('f')
    if (!o.operands.length) {
      if (force) return 0
      ctx.stderr("rm: missing operand\nTry 'rm --help' for more information.\n")
      return 1
    }
    let status = 0
    for (const f of o.operands) {
      if (['.', '..'].includes(basename(f))) {
        ctx.stderr(`rm: refusing to remove '.' or '..' directory: skipping '${f}'\n`)
        status = 1
        continue
      }
      try {
        ctx.shell.fs.remove(ctx.shell.resolve(f), { recursive: o.opts.has('r') || o.opts.has('R') })
      } catch (err) {
        if (force && err instanceof FsError && err.code === 'ENOENT') continue
        status = fsFail(ctx, f, err, 'cannot remove')
      }
    }
    return status
  },
}

const rmdir: Command = {
  name: 'rmdir',
  summary: 'remove empty directories',
  usage: 'rmdir DIRECTORY...',
  category: 'Files',
  run(ctx) {
    const o = getopt(ctx, {})
    if (!o) return 2
    if (!o.operands.length) return complain(ctx, "rmdir: missing operand\nTry 'rmdir --help' for more information.\n")
    let status = 0
    for (const d of o.operands) {
      try {
        const abs = ctx.shell.resolve(d)
        if (ctx.shell.fs.stat(abs).kind !== 'dir') throw new FsError('ENOTDIR')
        ctx.shell.fs.remove(abs, { dirOk: true })
      } catch (err) {
        status = fsFail(ctx, d, err, 'failed to remove')
      }
    }
    return status
  },
}

/** Shared by cp and mv: resolves SOURCE... DEST into (src, dest) pairs. */
function copyMove(ctx: CommandContext, operands: string[], act: (src: string, dest: string, shown: string) => void): number {
  const { fs } = ctx.shell
  if (operands.length === 0) {
    ctx.stderr(`${ctx.name}: missing file operand\nTry '${ctx.name} --help' for more information.\n`)
    return 1
  }
  if (operands.length === 1) {
    ctx.stderr(`${ctx.name}: missing destination file operand after '${operands[0]}'\nTry '${ctx.name} --help' for more information.\n`)
    return 1
  }
  const sources = operands.slice(0, -1)
  const destArg = operands[operands.length - 1]
  const destAbs = ctx.shell.resolve(destArg)
  const destIsDir = fs.exists(destAbs) && fs.stat(destAbs).kind === 'dir'
  if (sources.length > 1 && !destIsDir) {
    ctx.stderr(`${ctx.name}: target '${destArg}' is not a directory\n`)
    return 1
  }
  let status = 0
  for (const src of sources) {
    const srcAbs = ctx.shell.resolve(src)
    if (!fs.exists(srcAbs)) {
      ctx.stderr(`${ctx.name}: cannot stat '${src}': No such file or directory\n`)
      status = 1
      continue
    }
    const target = destIsDir ? joinPath(destAbs, basename(srcAbs)) : destAbs
    try {
      act(srcAbs, target, src)
    } catch (err) {
      if (!(err instanceof FsError)) throw err
      const shown = destIsDir ? joinPath(destArg, basename(srcAbs)) : destArg
      if (err.code === 'EINVAL') ctx.stderr(`${ctx.name}: cannot ${ctx.name === 'cp' ? 'copy' : 'move'} a directory, '${src}', into itself, '${shown}'\n`)
      else if (ctx.name === 'mv') ctx.stderr(`mv: cannot move '${src}' to '${shown}': ${err.message}\n`)
      else ctx.stderr(`cp: cannot create regular file '${shown}': ${err.message}\n`)
      status = 1
    }
  }
  return status
}

const cp: Command = {
  name: 'cp',
  summary: 'copy files and directories',
  usage: 'cp [-r] SOURCE... DEST',
  category: 'Files',
  options: [['-r, -R, --recursive', 'copy directories recursively']],
  run(ctx) {
    const o = getopt(ctx, { flags: 'rR', long: { recursive: 'r' } })
    if (!o) return 2
    const recursive = o.opts.has('r') || o.opts.has('R')
    return copyMove(ctx, o.operands, (src, dest, shown) => {
      if (!recursive && ctx.shell.fs.stat(src).kind === 'dir') {
        ctx.stderr(`cp: -r not specified; omitting directory '${shown}'\n`)
        return
      }
      ctx.shell.fs.copy(src, dest, recursive)
    })
  },
}

const mv: Command = {
  name: 'mv',
  summary: 'move (rename) files',
  usage: 'mv SOURCE... DEST',
  category: 'Files',
  run(ctx) {
    const o = getopt(ctx, {})
    if (!o) return 2
    return copyMove(ctx, o.operands, (src, dest) => ctx.shell.fs.move(src, dest))
  },
}

const find: Command = {
  name: 'find',
  summary: 'search for files in a directory hierarchy',
  usage: 'find [PATH...] [-name PATTERN] [-iname PATTERN] [-type f|d] [-maxdepth N]',
  category: 'Files',
  options: [
    ['-name PATTERN', 'base name matches shell PATTERN (* and ?)'],
    ['-iname PATTERN', 'like -name, case-insensitive'],
    ['-type f|d', 'only files (f) or directories (d)'],
    ['-maxdepth N', 'descend at most N levels'],
  ],
  run(ctx) {
    const paths: string[] = []
    const tests: ((name: string, node: FsNode) => boolean)[] = []
    let maxDepth = Infinity
    const args = ctx.args
    let i = 0
    while (i < args.length && !args[i].startsWith('-')) paths.push(args[i++])
    while (i < args.length) {
      const pred = args[i++]
      const value = args[i++]
      if (!['-name', '-iname', '-type', '-maxdepth'].includes(pred)) {
        ctx.stderr(`find: unknown predicate '${pred}'\n`)
        return 1
      }
      if (value === undefined) {
        ctx.stderr(`find: missing argument to '${pred}'\n`)
        return 1
      }
      if (pred === '-type') {
        if (value !== 'f' && value !== 'd') {
          ctx.stderr(`find: Unknown argument to -type: ${value}\n`)
          return 1
        }
        tests.push((_, n) => (value === 'd') === (n.kind === 'dir'))
      } else if (pred === '-maxdepth') {
        maxDepth = Number(value)
        if (!Number.isInteger(maxDepth) || maxDepth < 0) {
          ctx.stderr(`find: Expected a positive decimal integer argument to -maxdepth, but got '${value}'\n`)
          return 1
        }
      } else {
        const re = new RegExp(
          '^' + value.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$',
          pred === '-iname' ? 'i' : '',
        )
        tests.push((name) => re.test(name))
      }
    }
    let status = 0
    const out: string[] = []
    for (const start of paths.length ? paths : ['.']) {
      try {
        ctx.shell.fs.walk(ctx.shell.resolve(start), (abs, node, depth) => {
          if (depth > maxDepth) return
          const rel = depth === 0 ? start : start.replace(/\/$/, '') + abs.slice(ctx.shell.resolve(start).length)
          if (tests.every((t) => t(basename(abs), node))) out.push(rel)
        })
      } catch (err) {
        status = fsFail(ctx, start, err)
      }
    }
    ctx.stdout(joinLines(out))
    return status
  },
}

const stat: Command = {
  name: 'stat',
  summary: 'display file status',
  usage: 'stat FILE...',
  category: 'Files',
  run(ctx) {
    const o = getopt(ctx, {})
    if (!o) return 2
    if (!o.operands.length) return complain(ctx, "stat: missing operand\nTry 'stat --help' for more information.\n")
    let status = 0
    for (const f of o.operands) {
      try {
        const node = ctx.shell.fs.stat(ctx.shell.resolve(f))
        const d = new Date(node.mtime)
        const when = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`
        const id = node.owner === 'root' ? 0 : 1000
        const type = node.kind === 'dir' ? 'directory' : byteSize(node) ? 'regular file' : 'regular empty file'
        ctx.stdout(
          joinLines([
            `  File: ${f}`,
            `  Size: ${String(byteSize(node)).padEnd(10)}Blocks: ${String(blocks(node) * 2).padEnd(10)} IO Block: 4096   ${type}`,
            `Access: (${(node.mode & 0o7777).toString(8).padStart(4, '0')}/${modeString(node)})  Uid: (${String(id).padStart(5)}/${node.owner.padStart(8)})   Gid: (${String(id).padStart(5)}/${node.owner.padStart(8)})`,
            `Modify: ${when}`,
          ]),
        )
      } catch (err) {
        status = fsFail(ctx, f, err, 'cannot stat')
      }
    }
    return status
  },
}

const file: Command = {
  name: 'file',
  summary: 'determine file type',
  usage: 'file FILE...',
  category: 'Files',
  run(ctx) {
    const o = getopt(ctx, {})
    if (!o) return 2
    if (!o.operands.length) return complain(ctx, 'Usage: file FILE...\n')
    for (const f of o.operands) {
      let kind: string
      try {
        const node = ctx.shell.fs.stat(ctx.shell.resolve(f))
        if (node.kind === 'dir') kind = 'directory'
        else if (!node.content) kind = 'empty'
        else {
          const text = /[^\x00-\x7f]/.test(node.content) ? 'Unicode text, UTF-8 text' : 'ASCII text'
          kind = node.content.startsWith('#!') ? `a ${node.content.slice(2).split('\n')[0].trim()} script, ${text} executable` : text
        }
      } catch (err) {
        kind = `cannot open \`${f}' (${err instanceof FsError ? err.message : String(err)})`
      }
      ctx.stdout(`${f}: ${kind}\n`)
    }
    return 0
  },
}

export const fileCommands: Command[] = [ls, cd, pwd, tree, cat, headTail('head'), headTail('tail'), touch, mkdir, rm, rmdir, cp, mv, find, stat, file]

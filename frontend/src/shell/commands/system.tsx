import { Cmd } from '../../components/terminal/ui'
import { CATEGORIES, type Command } from '../types'
import { getopt, joinLines } from '../util'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const FULL_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const FULL_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const pad2 = (n: number) => String(n).padStart(2, '0')

function tzName(d: Date): string {
  return new Intl.DateTimeFormat('en-US', { timeZoneName: 'short' }).formatToParts(d).find((p) => p.type === 'timeZoneName')?.value ?? 'UTC'
}

export function formatDate(d: Date, fmt = '%a %b %e %H:%M:%S %Z %Y'): string {
  const map: Record<string, string> = {
    a: DAYS[d.getDay()],
    A: FULL_DAYS[d.getDay()],
    b: MONTHS[d.getMonth()],
    B: FULL_MONTHS[d.getMonth()],
    d: pad2(d.getDate()),
    e: String(d.getDate()).padStart(2, ' '),
    m: pad2(d.getMonth() + 1),
    Y: String(d.getFullYear()),
    y: pad2(d.getFullYear() % 100),
    H: pad2(d.getHours()),
    M: pad2(d.getMinutes()),
    S: pad2(d.getSeconds()),
    Z: tzName(d),
    s: String(Math.floor(d.getTime() / 1000)),
    F: `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`,
    T: `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`,
    '%': '%',
  }
  return fmt.replace(/%(.)/g, (m, c: string) => map[c] ?? m)
}

export function sessionUptime(startedAt: number): string {
  const mins = Math.floor((Date.now() - startedAt) / 60_000)
  if (mins < 60) return `${mins} min`
  return `${Math.floor(mins / 60)}:${pad2(mins % 60)}`
}

const UNAME: Record<string, string> = {
  s: 'PeteOS',
  n: 'peteos',
  r: '1.0.0-pete',
  v: '#1 SMP PREEMPT (simulated)',
  m: 'virtual',
  o: 'PeteOS',
}

const help: Command = {
  name: 'help',
  summary: 'list commands, or describe one',
  usage: 'help [COMMAND]',
  category: 'Start here',
  builtin: true,
  noBinary: true,
  run(ctx) {
    const all = [...ctx.shell.commands.values()]
    if (ctx.args[0]) {
      const cmd = ctx.shell.commands.get(ctx.args[0])
      if (!cmd) {
        ctx.stderr(`pete-sh: help: no help topics match '${ctx.args[0]}'. Try 'help' or 'man ${ctx.args[0]}'.\n`)
        return 1
      }
      ctx.stdout(`${cmd.name}: ${cmd.usage}\n    ${cmd.summary}\n    See 'man ${cmd.name}' for details.\n`)
      return 0
    }
    const groups = CATEGORIES.map((cat) => [cat, all.filter((c) => c.category === cat)] as const).filter(([, cs]) => cs.length)
    if (ctx.ui) {
      ctx.ui(
        <div className="space-y-2">
          <p className="text-sec">pete-sh, a small Bash-like shell. Click a command, or type it. 'man pete-sh' lists shell features.</p>
          {groups.map(([cat, cs]) => (
            <div key={cat}>
              <p className="text-hi">{cat}</p>
              {cs.map((c) => (
                <p key={c.name} className="flex">
                  <span className="w-[12ch] shrink-0 pl-[2ch]">
                    <Cmd run={c.name} />
                  </span>
                  <span className="min-w-0 text-sec">{c.summary}</span>
                </p>
              ))}
            </div>
          ))}
        </div>,
      )
    } else {
      ctx.stdout(joinLines(groups.flatMap(([cat, cs]) => [`${cat}:`, ...cs.map((c) => `  ${c.name.padEnd(10)} ${c.summary}`)])))
    }
    return 0
  },
}

const man: Command = {
  name: 'man',
  summary: 'an interface to the system reference manuals',
  usage: 'man PAGE',
  category: 'System',
  notes: "Try 'man pete-sh' for the shell's supported features.",
  run(ctx) {
    const page = ctx.args[0]
    if (!page) {
      ctx.stderr("What manual page do you want?\nFor example, try 'man man'.\n")
      return 1
    }
    if (page === 'pete-sh' || page === 'peteos') {
      ctx.stdout(ctx.shell.fs.readFile('/usr/share/doc/peteos/SUPPORTED.md'))
      return 0
    }
    const cmd = ctx.shell.commands.get(page)
    if (!cmd) {
      ctx.stderr(`No manual entry for ${page}\n`)
      return 16
    }
    const title = `${cmd.name.toUpperCase()}(1)`
    const lines = [
      `${title.padEnd(24)}PeteOS Manual${title.padStart(24)}`,
      '',
      'NAME',
      `       ${cmd.name} - ${cmd.summary}`,
      '',
      'SYNOPSIS',
      `       ${cmd.usage}`,
    ]
    if (cmd.options?.length) {
      lines.push('', 'OPTIONS')
      for (const [flag, desc] of cmd.options) lines.push(`       ${flag}`, `              ${desc}`)
    }
    if (cmd.notes) lines.push('', 'NOTES', `       ${cmd.notes}`)
    lines.push('', 'PETEOS', `       A browser re-implementation of a common subset of ${cmd.name}. Unsupported options are rejected.`)
    ctx.stdout(joinLines(lines))
    return 0
  },
}

const history: Command = {
  name: 'history',
  summary: 'display or clear the command history',
  usage: 'history [-c]',
  category: 'System',
  builtin: true,
  noBinary: true,
  run(ctx) {
    const o = getopt(ctx, { flags: 'c' })
    if (!o) return 2
    if (o.opts.has('c')) {
      ctx.shell.history.length = 0
      return 0
    }
    ctx.stdout(joinLines(ctx.shell.history.map((h, i) => `${String(i + 1).padStart(5)}  ${h}`)))
    return 0
  },
}

const env: Command = {
  name: 'env',
  summary: 'print the environment',
  usage: 'env',
  category: 'System',
  run(ctx) {
    if (ctx.args.length) {
      ctx.stderr('env: running a command with a modified environment is not supported\n')
      return 125
    }
    ctx.stdout(joinLines([...ctx.shell.env].map(([k, v]) => `${k}=${v}`)))
    return 0
  },
}

const printenv: Command = {
  name: 'printenv',
  summary: 'print all or part of the environment',
  usage: 'printenv [VARIABLE]...',
  category: 'System',
  run(ctx) {
    if (!ctx.args.length) return env.run(ctx)
    const values = ctx.args.map((k) => ctx.shell.env.get(k))
    ctx.stdout(joinLines(values.filter((v): v is string => v !== undefined)))
    return values.every((v) => v !== undefined) ? 0 : 1
  },
}

const exportCmd: Command = {
  name: 'export',
  summary: 'set shell variables',
  usage: 'export [NAME[=VALUE]]...',
  category: 'System',
  builtin: true,
  noBinary: true,
  run(ctx) {
    if (!ctx.args.length) {
      ctx.stdout(joinLines([...ctx.shell.env].map(([k, v]) => `declare -x ${k}="${v}"`)))
      return 0
    }
    let status = 0
    for (const arg of ctx.args) {
      const m = arg.match(/^([A-Za-z_][A-Za-z0-9_]*)(?:=(.*))?$/s)
      if (!m) {
        ctx.stderr(`pete-sh: export: \`${arg}': not a valid identifier\n`)
        status = 1
      } else if (m[2] !== undefined) ctx.shell.env.set(m[1], m[2])
      else if (!ctx.shell.env.has(m[1])) ctx.shell.env.set(m[1], '')
    }
    return status
  },
}

const unset: Command = {
  name: 'unset',
  summary: 'remove shell variables',
  usage: 'unset NAME...',
  category: 'System',
  builtin: true,
  noBinary: true,
  run(ctx) {
    for (const k of ctx.args) ctx.shell.env.delete(k)
    return 0
  },
}

const which: Command = {
  name: 'which',
  summary: 'locate a command',
  usage: 'which COMMAND...',
  category: 'System',
  run(ctx) {
    let status = 0
    for (const name of ctx.args) {
      const cmd = ctx.shell.commands.get(name)
      if (cmd && !cmd.noBinary) ctx.stdout(`/bin/${name}\n`)
      else {
        ctx.stderr(`which: no ${name} in (${ctx.shell.env.get('PATH') ?? ''})\n`)
        status = 1
      }
    }
    return ctx.args.length ? status : 1
  },
}

const type: Command = {
  name: 'type',
  summary: 'describe how a name would be interpreted',
  usage: 'type NAME...',
  category: 'System',
  builtin: true,
  noBinary: true,
  run(ctx) {
    let status = 0
    for (const name of ctx.args) {
      const cmd = ctx.shell.commands.get(name)
      if (!cmd) {
        ctx.stderr(`pete-sh: type: ${name}: not found\n`)
        status = 1
      } else ctx.stdout(cmd.builtin ? `${name} is a shell builtin\n` : `${name} is /bin/${name}\n`)
    }
    return status
  },
}

const date: Command = {
  name: 'date',
  summary: 'print the system date and time',
  usage: 'date [+FORMAT]',
  category: 'System',
  options: [['+FORMAT', 'e.g. +%Y-%m-%d; supports %a %A %b %B %d %e %m %y %Y %H %M %S %Z %s %F %T %%']],
  run(ctx) {
    const arg = ctx.args[0]
    if (arg && !arg.startsWith('+')) {
      ctx.stderr(`date: setting or parsing dates is not supported: '${arg}'\n`)
      return 1
    }
    ctx.stdout(formatDate(new Date(), arg?.slice(1)) + '\n')
    return 0
  },
}

const uname: Command = {
  name: 'uname',
  summary: 'print system information',
  usage: 'uname [-asnrvmo]',
  category: 'System',
  options: [
    ['-a', 'print all information'],
    ['-s / -n / -r / -v / -m / -o', 'kernel name / node name / release / version / machine / OS'],
  ],
  notes: 'Values describe the simulated PeteOS machine, not your computer.',
  run(ctx) {
    const o = getopt(ctx, { flags: 'asnrvmo', long: { all: 'a' } })
    if (!o) return 2
    const keys = o.opts.has('a') ? 'snrvmo' : [...'snrvmo'].filter((k) => o.opts.has(k)).join('') || 's'
    ctx.stdout([...keys].map((k) => UNAME[k]).join(' ') + '\n')
    return 0
  },
}

const uptime: Command = {
  name: 'uptime',
  summary: 'tell how long this session has been running',
  usage: 'uptime [-p]',
  category: 'System',
  notes: 'Uptime is the real time since you opened PeteOS. Nothing else runs, so the load average is 0.',
  run(ctx) {
    const o = getopt(ctx, { flags: 'p', long: { pretty: 'p' } })
    if (!o) return 2
    const mins = Math.floor((Date.now() - ctx.shell.startedAt) / 60_000)
    if (o.opts.has('p')) {
      const h = Math.floor(mins / 60)
      const parts = [h && `${h} hour${h > 1 ? 's' : ''}`, `${mins % 60} minute${mins % 60 === 1 ? '' : 's'}`].filter(Boolean)
      ctx.stdout(`up ${parts.join(', ')}\n`)
    } else {
      ctx.stdout(` ${formatDate(new Date(), '%T')} up ${sessionUptime(ctx.shell.startedAt)},  1 user,  load average: 0.00, 0.00, 0.00\n`)
    }
    return 0
  },
}

const simple = (name: string, summary: string, run: Command['run'], extra: Partial<Command> = {}): Command => ({
  name,
  summary,
  usage: name,
  category: 'System',
  run,
  ...extra,
})

export const systemCommands: Command[] = [
  help,
  man,
  history,
  env,
  printenv,
  exportCmd,
  unset,
  which,
  type,
  date,
  uname,
  uptime,
  simple('clear', 'clear the terminal screen (Ctrl+L)', (ctx) => {
    ctx.clear()
    return 0
  }),
  simple('whoami', 'print effective user name', (ctx) => {
    ctx.stdout(`${ctx.shell.env.get('USER')}\n`)
    return 0
  }),
  simple('hostname', 'show the system host name', (ctx) => {
    ctx.stdout(ctx.shell.fs.readFile('/etc/hostname'))
    return 0
  }),
  simple('true', 'do nothing, successfully', () => 0, { builtin: true }),
  simple('false', 'do nothing, unsuccessfully', () => 1, { builtin: true }),
]

import { Cmd, ExtLink } from '../../components/terminal/ui'
import { joinPath } from '../../filesystem/path'
import { profile } from '../../portfolio/profile'
import { projects } from '../../portfolio/projects'
import { PORTRAIT } from '../../portfolio/portrait'
import { skills } from '../../portfolio/skills'
import { getWeather, WEATHER_PLACE } from '../../services/weather'
import { THEMES, useSettings, type Theme } from '../../store/settings'
import type { Shell } from '../shell'
import type { Command, CommandContext } from '../types'
import { getopt, joinLines } from '../util'
import { sessionUptime } from './system'

const LOGO = [
  '       ____________',
  '      /            \\',
  '     |   PETE  OS   |',
  '     |      >_      |',
  '      \\____________/',
]

function browserName(): string {
  const ua = navigator.userAgent
  return (
    [
      ['Edg/', 'Edge'],
      ['Firefox/', 'Firefox'],
      ['Chrome/', 'Chrome'],
      ['Safari/', 'Safari'],
    ].find(([needle]) => ua.includes(needle))?.[1] ?? 'Browser'
  )
}

/** Info rows. Values from your browser are real; the rest describe the simulated machine. */
export function systemInfo(shell: Shell): [string, string][] {
  let files = 0
  shell.fs.walk('/', (_, node) => void (node.kind === 'file' && files++))
  const nav = navigator as Navigator & { deviceMemory?: number }
  const heap = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory
  const rows: [string, string][] = [
    ['OS', 'PeteOS 1.0 (virtual)'],
    ['Host', `${browserName()} (your browser)`],
    ['Kernel', '1.0.0-pete (simulated)'],
    ['Uptime', sessionUptime(shell.startedAt)],
    ['Shell', 'pete-sh'],
    ['Resolution', `${screen.width}x${screen.height}`],
    ['Theme', `${useSettings.getState().theme} phosphor`],
    ['CPU', `${nav.hardwareConcurrency || '?'} logical cores (your device)`],
  ]
  if (nav.deviceMemory) rows.push(['Memory', `~${nav.deviceMemory} GB (your device)`])
  if (heap) rows.push(['JS heap', `${(heap.usedJSHeapSize / 1048576).toFixed(1)} MiB used by PeteOS`])
  rows.push(
    ['Files', `${files} in the virtual filesystem`],
    ['', ''],
    ['User', profile.name],
    ['Role', 'Software Developer'],
    ['Education', profile.education[0].school],
    ['Focus', 'AI / Software Engineering'],
    ['Projects', projects.map((p) => p.title).join(', ')],
    ...profile.achievements.map((a) => ['Award', a.title] as [string, string]),
    ['Status', profile.status],
  )
  return rows
}

export function art(): string[] {
  return PORTRAIT ?? LOGO
}

export function NeofetchView({ shell, showArt = true, showInfo = true }: { shell: Shell; showArt?: boolean; showInfo?: boolean }) {
  const title = `${shell.env.get('USER')}@peteos`
  return (
    <div className="flex flex-col gap-x-[3ch] gap-y-2 sm:flex-row">
      {showArt && (
        <pre aria-hidden="true" className={`glow-strong shrink-0 leading-[1.05] text-hi ${PORTRAIT ? 'text-[0.62em]' : ''}`}>
          {art().join('\n')}
        </pre>
      )}
      {showInfo && (
        <div className="min-w-0">
          <p className="text-hi">{title}</p>
          <p className="text-sec">{'-'.repeat(title.length)}</p>
          {systemInfo(shell).map(([k, v], i) =>
            k ? (
              <p key={k + i}>
                <span className="text-hi">{k}</span>: {v}
              </p>
            ) : (
              <p key={i}>&nbsp;</p>
            ),
          )}
        </div>
      )}
    </div>
  )
}

function neofetchText(shell: Shell, showArt: boolean, showInfo: boolean): string {
  const title = `${shell.env.get('USER')}@peteos`
  const info = showInfo ? [title, '-'.repeat(title.length), ...systemInfo(shell).map(([k, v]) => (k ? `${k}: ${v}` : ''))] : []
  const left = showArt ? art() : []
  const width = Math.max(0, ...left.map((l) => l.length)) + 3
  const rows = Math.max(left.length, info.length)
  return joinLines(Array.from({ length: rows }, (_, i) => (showArt && showInfo ? (left[i] ?? '').padEnd(width) : left[i] ?? '') + (info[i] ?? '')).map((l) => l.trimEnd()))
}

function fetchCommand(name: string): Command {
  return {
    name,
    summary: 'show system and profile information',
    usage: `${name} [--ascii | --off]`,
    category: 'Start here',
    options: [
      ['--ascii', 'only show the ASCII art'],
      ['--off', 'only show the information'],
    ],
    notes: 'Host, resolution, CPU, memory and uptime come from your browser. OS and kernel describe the simulated PeteOS machine.',
    run(ctx) {
      const o = getopt(ctx, { long: { ascii: 'A', off: 'O' } })
      if (!o) return 2
      const showArt = !o.opts.has('O')
      const showInfo = !o.opts.has('A')
      if (ctx.ui) ctx.ui(<NeofetchView shell={ctx.shell} showArt={showArt} showInfo={showInfo} />)
      else ctx.stdout(neofetchText(ctx.shell, showArt, showInfo))
      return 0
    },
  }
}

/** Print portfolio files straight from the virtual filesystem, so commands and `cat` always agree. */
function printFiles(ctx: CommandContext, paths: string[]): number {
  const { fs, home } = ctx.shell
  const texts = paths.map((p) => fs.readFile(joinPath(home, p)))
  ctx.stdout(texts.join('\n'))
  return 0
}

const filesIn = (ctx: CommandContext, dir: string) => ctx.shell.fs.readDir(joinPath(ctx.shell.home, dir)).map(([n]) => `${dir}/${n}`)

function portfolio(name: string, summary: string, run: Command['run'], extra: Partial<Command> = {}): Command {
  return { name, summary, usage: name, category: 'Portfolio', run, ...extra }
}

function openUrl(ctx: CommandContext, label: string, url: string | null): number {
  if (!url) {
    ctx.stderr(`${ctx.name}: ${label} link is not set yet\n`)
    return 1
  }
  if (ctx.ui) {
    window.open(url, '_blank', 'noopener,noreferrer')
    ctx.ui(
      <p>
        Opening <ExtLink href={url}>{url}</ExtLink>
      </p>,
    )
  } else ctx.stdout(url + '\n')
  return 0
}

export const portfolioCommands: Command[] = [
  fetchCommand('neofetch'),
  fetchCommand('fastfetch'),
  portfolio('about', 'who Prakash is', (ctx) => {
    printFiles(ctx, ['about/bio.txt'])
    ctx.ui?.(
      <p className="mt-2">
        Next: <Cmd run="projects" /> <Cmd run="skills" /> <Cmd run="contact" />
      </p>,
    )
    return 0
  }, { category: 'Start here' }),
  portfolio(
    'projects',
    'list projects, or show one',
    (ctx) => {
      const id = ctx.args[0]
      if (!id) {
        const width = Math.max(...projects.map((p) => p.id.length)) + 2
        if (ctx.ui) {
          ctx.ui(
            <div>
              {projects.map((p) => (
                <p key={p.id} className="flex">
                  <span className="shrink-0" style={{ width: `${width}ch` }}>
                    <Cmd run={`projects ${p.id}`}>{p.id}</Cmd>
                  </span>
                  <span className="min-w-0 text-sec">{p.tagline}</span>
                </p>
              ))}
              <p className="mt-2 text-sec">Files live in ~/projects. Try: cd ~/projects/relay4 && ls</p>
            </div>,
          )
        } else ctx.stdout(joinLines(projects.map((p) => `${p.id.padEnd(width)}${p.tagline}`)))
        return 0
      }
      if (!projects.some((p) => p.id === id)) {
        ctx.stderr(`projects: no such project '${id}' (try: ${projects.map((p) => p.id).join(', ')})\n`)
        return 1
      }
      printFiles(ctx, [`projects/${id}/README.md`, `projects/${id}/links.txt`])
      ctx.ui?.(
        <p className="mt-2">
          More: <Cmd run={`cat ~/projects/${id}/architecture.md`}>architecture</Cmd>{' '}
          <Cmd run={`cat ~/projects/${id}/tech-stack.txt`}>tech stack</Cmd> <Cmd run="projects">all projects</Cmd>
        </p>,
      )
      return 0
    },
    { usage: 'projects [NAME]', category: 'Start here' },
  ),
  portfolio('skills', 'languages, frameworks and tools', (ctx) => {
    const groups = Object.keys(skills)
    const width = Math.max(...groups.map((g) => g.length)) + 2
    const files = filesIn(ctx, 'skills')
    const lines = groups.map((g) => {
      const path = files.find((f) => f.endsWith(`/${g.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}.txt`))
      const items = path ? ctx.shell.fs.readFile(joinPath(ctx.shell.home, path)).trim().split('\n') : []
      return `${(g + ':').padEnd(width)}${items.join(', ')}`
    })
    ctx.stdout(joinLines(lines))
    return 0
  }),
  portfolio('experience', 'research and work experience', (ctx) => printFiles(ctx, filesIn(ctx, 'experience'))),
  portfolio('education', 'where Prakash studies', (ctx) => printFiles(ctx, ['about/education.md'])),
  portfolio('achievements', 'awards and wins', (ctx) => printFiles(ctx, filesIn(ctx, 'achievements'))),
  portfolio('contact', 'how to reach Prakash', (ctx) => {
    if (!ctx.ui) return printFiles(ctx, ['contact/contact.txt'])
    const l = profile.links
    ctx.ui(
      <div>
        <p>
          email:{'    '}
          <ExtLink href={`mailto:${l.email}`}>{l.email}</ExtLink>
        </p>
        <p>
          github:{'   '}
          <ExtLink href={l.github}>{l.github}</ExtLink>
        </p>
        <p>linkedin: {l.linkedin ? <ExtLink href={l.linkedin}>{l.linkedin}</ExtLink> : <span className="text-sec">(not set yet)</span>}</p>
      </div>,
    )
    return 0
  }),
  portfolio('resume', 'get the resume', (ctx) => {
    const url = profile.links.resume
    if (ctx.ui) {
      ctx.ui(
        <p>
          Resume: <ExtLink href={url}>Prakash_Kusari_Resume.docx</ExtLink>
        </p>,
      )
    } else ctx.stdout(new URL(url, location.origin).href + '\n')
    return 0
  }),
  {
    name: 'weather',
    summary: `current weather in ${WEATHER_PLACE.name}`,
    usage: 'weather',
    category: 'System',
    notes: 'Live data from open-meteo.com, cached for 15 minutes. Uses Prakash\'s city, never your location.',
    async run(ctx) {
      const w = await getWeather()
      if (!w) {
        ctx.stderr('weather: could not reach open-meteo.com (offline?)\n')
        return 1
      }
      const at = new Date(w.fetchedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
      ctx.stdout(`${WEATHER_PLACE.name}: ${Math.round(w.tempF)}°F, ${w.condition} (updated ${at})\n`)
      return 0
    },
  },
  portfolio('github', 'open GitHub in a new tab', (ctx) => openUrl(ctx, 'GitHub', profile.links.github)),
  portfolio('linkedin', 'open LinkedIn in a new tab', (ctx) => openUrl(ctx, 'LinkedIn', profile.links.linkedin)),
]

function toggle(name: string, summary: string, key: 'panel' | 'background', set: (on: boolean) => void): Command {
  return {
    name,
    summary,
    usage: `${name} [on|off]`,
    category: 'Settings',
    run(ctx) {
      const want = ctx.args[0]
      if (!want) {
        ctx.stdout(`${name} is ${useSettings.getState()[key] ? 'on' : 'off'}\n`)
        return 0
      }
      if (want !== 'on' && want !== 'off') {
        ctx.stderr(`${name}: expected 'on' or 'off', got '${want}'\n`)
        return 1
      }
      set(want === 'on')
      return 0
    },
  }
}

export const settingsCommands: Command[] = [
  toggle('panel', 'show or hide the side panel (wide screens)', 'panel', (on) => useSettings.getState().setPanel(on)),
  toggle('bg', 'turn the animated dot background on or off', 'background', (on) => useSettings.getState().setBackground(on)),
  {
    name: 'theme',
    summary: 'change the screen colour',
    usage: `theme [${THEMES.join('|')}]`,
    category: 'Settings',
    run(ctx) {
      const want = ctx.args[0]
      if (!want) {
        const current = useSettings.getState().theme
        ctx.stdout(joinLines(THEMES.map((t) => `${t === current ? '*' : ' '} ${t}`)))
        return 0
      }
      if (!THEMES.includes(want as Theme)) {
        ctx.stderr(`theme: unknown theme '${want}' (choose: ${THEMES.join(', ')})\n`)
        return 1
      }
      useSettings.getState().setTheme(want as Theme)
      return 0
    },
  },
  {
    name: 'crt',
    summary: 'turn CRT effects (scanlines, glow, flicker) on or off',
    usage: 'crt [on|off]',
    category: 'Settings',
    run(ctx) {
      const want = ctx.args[0]
      if (!want) {
        ctx.stdout(`crt effects are ${useSettings.getState().crt ? 'on' : 'off'}\n`)
        return 0
      }
      if (want !== 'on' && want !== 'off') {
        ctx.stderr(`crt: expected 'on' or 'off', got '${want}'\n`)
        return 1
      }
      useSettings.getState().setCrt(want === 'on')
      return 0
    },
  },
]

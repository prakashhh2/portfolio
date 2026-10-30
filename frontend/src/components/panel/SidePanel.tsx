import { useEffect, useState, type ReactNode } from 'react'
import { joinPath, tildify } from '../../filesystem/path'
import { profile } from '../../portfolio/profile'
import { sessionUptime } from '../../shell/commands/system'
import type { Shell } from '../../shell/shell'
import { getWeather, WEATHER_PLACE, type Weather } from '../../services/weather'
import { Cmd } from '../terminal/ui'
import { SevenSegment } from './SevenSegment'

const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
const pad2 = (n: number) => String(n).padStart(2, '0')

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-1">
      <h2 className="text-dim">
        -- <span className="text-sec">{title}</span> {'-'.repeat(Math.max(2, 24 - title.length))}
      </h2>
      {children}
    </section>
  )
}

function Clock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  const h12 = now.getHours() % 12 || 12
  const time = `${pad2(h12)}:${pad2(now.getMinutes())}`
  const ampm = now.getHours() < 12 ? 'AM' : 'PM'
  const tz = new Intl.DateTimeFormat('en-US', { timeZoneName: 'short' }).formatToParts(now).find((p) => p.type === 'timeZoneName')?.value
  return (
    <Section title="TIME">
      <div className="flex items-end gap-[1ch]">
        <SevenSegment text={time} label={`${time} ${ampm}`} />
        <span className="text-sec">
          {pad2(now.getSeconds())}
          <br />
          {ampm}
        </span>
      </div>
      <p className="text-sec">
        {DAYS[now.getDay()]} {pad2(now.getDate())} {MONTHS[now.getMonth()]} {now.getFullYear()} · {tz}
      </p>
    </Section>
  )
}

function Temperature() {
  const [weather, setWeather] = useState<Weather | null | undefined>(undefined)
  useEffect(() => {
    let alive = true
    const load = () => getWeather().then((w) => alive && setWeather(w))
    load()
    const id = setInterval(load, 15 * 60_000)
    return () => {
      alive = false
      clearInterval(id)
    }
  }, [])

  const temp = weather ? `${Math.round(weather.tempF)}°F` : '--°F'
  const updated = weather && new Date(weather.fetchedAt)
  return (
    <Section title="TEMP">
      <SevenSegment text={temp} height="2em" label={weather ? `${Math.round(weather.tempF)} degrees Fahrenheit` : 'temperature unavailable'} />
      <p className="text-sec">
        {WEATHER_PLACE.name} · {weather === undefined ? 'loading…' : weather ? weather.condition : 'offline'}
      </p>
      {updated && (
        <p className="text-dim">
          updated {pad2(updated.getHours())}:{pad2(updated.getMinutes())} · open-meteo
        </p>
      )}
    </Section>
  )
}

export function SidePanel({ shell }: { shell: Shell }) {
  const cwd = shell.cwd
  let entries: [string, boolean][] = []
  try {
    entries = shell.fs
      .readDir(cwd)
      .filter(([n]) => !n.startsWith('.'))
      .map(([n, node]) => [n, node.kind === 'dir'])
  } catch {
    // cwd was removed; show nothing
  }
  const shown = (name: string) => tildify(joinPath(cwd, name), shell.home)

  return (
    <aside aria-label="System panel" className="space-y-4 overflow-y-auto border-l border-dim px-5 py-5 text-[0.9em]">
      <Clock />
      <Temperature />
      <Section title="STATUS">
        <p>
          <span className="text-sec">user </span>
          {shell.env.get('USER')}@peteos
        </p>
        <p className="truncate">
          <span className="text-sec">cwd </span>
          {tildify(cwd, shell.home)}
        </p>
        <p>
          <span className="text-sec">up </span>
          {sessionUptime(shell.startedAt)}
          <span className="text-sec"> exit </span>
          <span className={shell.status ? 'text-hi' : undefined}>{shell.status}</span>
        </p>
      </Section>
      <Section title="FILES">
        {cwd !== '/' && (
          <p>
            <Cmd run="cd .. && ls" plain>
              ../
            </Cmd>
          </p>
        )}
        {entries.slice(0, 12).map(([name, dir]) => (
          <p key={name} className="truncate">
            <Cmd run={dir ? `cd ${shown(name)} && ls` : `cat ${shown(name)}`} plain>
              <span className={dir ? 'font-bold text-hi' : undefined}>
                {name}
                {dir ? '/' : ''}
              </span>
            </Cmd>
          </p>
        ))}
        {entries.length > 12 && <p className="text-dim">… {entries.length - 12} more (ls)</p>}
      </Section>
      <Section title="LINKS">
        {profile.achievements.map((a) => (
          <p key={a.id} className="text-hi">
            ★ {a.title}
          </p>
        ))}
        <p className="flex flex-wrap gap-x-[2ch]">
          <Cmd run="resume" />
          <Cmd run="github" />
          <Cmd run="contact" />
        </p>
      </Section>
    </aside>
  )
}

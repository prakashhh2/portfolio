import { memo, useCallback, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { tildify } from '../../filesystem/path'
import { createShell } from '../../shell/registry'
import { useSettings } from '../../store/settings'
import { SidePanel } from '../panel/SidePanel'
import type { Output } from '../../shell/shell'
import { QUICK_COMMANDS, Welcome } from './Welcome'
import { RunContext } from './ui'

type Chunk = { kind: 'out' | 'err'; text: string } | { kind: 'ui'; node: ReactNode }
type Entry = { id: number; prompt: string | null; input: string; chunks: Chunk[] }

const finePointer = () => window.matchMedia('(pointer: fine)').matches

function Prompt({ text }: { text: string }) {
  return <span className="shrink-0 text-sec">{text}&nbsp;</span>
}

// Memoised so typing in the input never re-renders past output.
const EntryView = memo(function EntryView({ entry }: { entry: Entry }) {
  return (
    <div className="mb-2">
      {entry.prompt !== null && (
        <p className="flex">
          <Prompt text={entry.prompt} />
          <span className="break-all">{entry.input}</span>
        </p>
      )}
      {entry.chunks.map((c, i) =>
        c.kind === 'ui' ? (
          <div key={i}>{c.node}</div>
        ) : (
          <span key={i} className={c.kind === 'err' ? 'text-hi' : undefined}>
            {c.text}
          </span>
        ),
      )}
    </div>
  )
})

export function Terminal() {
  const shell = useRef(createShell()).current
  const panel = useSettings((s) => s.panel)
  const [entries, setEntries] = useState<Entry[]>(() => [{ id: 0, prompt: null, input: '', chunks: [{ kind: 'ui', node: <Welcome shell={shell} /> }] }])
  const [input, setInput] = useState('')
  const [caret, setCaret] = useState(0)
  const [focused, setFocused] = useState(false)
  const [options, setOptions] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  const historyIndex = useRef(0)
  const nextId = useRef(1)
  const inputRef = useRef<HTMLInputElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  const prompt = () => `${shell.env.get('USER')}@peteos:${tildify(shell.cwd, shell.home)}$`

  const setLine = (value: string, at = value.length) => {
    setInput(value)
    setCaret(at)
    setOptions([])
    requestAnimationFrame(() => inputRef.current?.setSelectionRange(at, at))
  }

  const push = (entry: Omit<Entry, 'id'>) => setEntries((prev) => [...prev, { ...entry, id: nextId.current++ }])

  const run = useCallback(
    async (line: string) => {
      if (busyRef.current) return
      busyRef.current = true
      setBusy(true)
      const shown = prompt()
      let chunks: Chunk[] = []
      let cleared = false
      const add = (kind: 'out' | 'err') => (text: string) => {
        if (!text) return
        const last = chunks[chunks.length - 1]
        if (last && last.kind === kind) last.text += text
        else chunks.push({ kind, text })
      }
      const out: Output = {
        stdout: add('out'),
        stderr: add('err'),
        ui: (node) => chunks.push({ kind: 'ui', node }),
        clear: () => {
          cleared = true
          chunks = []
        },
      }
      try {
        await shell.run(line, out)
      } catch (err) {
        out.stderr(`pete-sh: internal error: ${err instanceof Error ? err.message : String(err)}\n`)
      }
      // Trim the final newline: each entry is already its own block.
      const tail = chunks[chunks.length - 1]
      if (tail && tail.kind !== 'ui') tail.text = tail.text.replace(/\n$/, '')
      if (cleared) setEntries(chunks.length ? [{ id: nextId.current++, prompt: null, input: '', chunks }] : [])
      else push({ prompt: shown, input: line, chunks })
      historyIndex.current = shell.history.length
      setLine('')
      busyRef.current = false
      setBusy(false)
      if (finePointer()) inputRef.current?.focus()
    },
    // shell and the helpers only touch refs and state setters, so this never goes stale
    [],
  )

  useEffect(() => {
    // Leave the welcome screen at the top; follow output once commands run.
    if (entries.length === 1 && entries[0].id === 0 && !options.length) return
    bottomRef.current?.scrollIntoView({ block: 'end' })
  }, [entries, options])

  useEffect(() => {
    if (finePointer()) inputRef.current?.focus()
  }, [])

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    const h = shell.history
    if (e.key === 'Enter') {
      e.preventDefault()
      void run(input)
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault()
      const i = Math.min(h.length, Math.max(0, historyIndex.current + (e.key === 'ArrowUp' ? -1 : 1)))
      historyIndex.current = i
      setLine(h[i] ?? '')
    } else if (e.key === 'Tab' && input.trim()) {
      // Only grab Tab while there is something to complete, so keyboard users can still tab out.
      e.preventDefault()
      const before = input.slice(0, caret)
      const result = shell.complete(before)
      const next = result.line + input.slice(caret)
      setInput(next)
      setCaret(result.line.length)
      setOptions(result.options)
      requestAnimationFrame(() => inputRef.current?.setSelectionRange(result.line.length, result.line.length))
    } else if (e.ctrlKey && !e.altKey && !e.metaKey) {
      const key = e.key.toLowerCase()
      if (key === 'c') {
        if (window.getSelection()?.toString()) return // let copy work
        e.preventDefault()
        push({ prompt: prompt(), input: input + '^C', chunks: [] })
        historyIndex.current = h.length
        setLine('')
      } else if (key === 'l') {
        e.preventDefault()
        setEntries([])
      } else if (key === 'a') {
        e.preventDefault()
        setLine(input, 0)
      } else if (key === 'e') {
        e.preventDefault()
        setLine(input)
      } else if (key === 'u') {
        e.preventDefault()
        setLine(input.slice(caret), 0)
      }
    }
  }

  return (
    <RunContext.Provider value={run}>
      <div className="flex h-full">
        <div className="flex min-w-0 flex-1 flex-col">
          <div
            className="flex-1 overflow-y-auto px-4 pt-4 sm:px-8 sm:pt-6"
            onClick={(e) => {
              const el = e.target as HTMLElement
              if (!window.getSelection()?.toString() && !el.closest('a,button')) inputRef.current?.focus()
            }}
          >
            <div role="log" aria-live="polite" aria-label="Terminal output" className="whitespace-pre-wrap break-words">
              {entries.map((entry) => (
                <EntryView key={entry.id} entry={entry} />
              ))}
            </div>

            <div className={`flex ${busy ? 'opacity-50' : ''}`}>
              <Prompt text={prompt()} />
              <div className="relative min-w-0 flex-1">
                <span aria-hidden="true" className="whitespace-pre-wrap break-all">
                  {input.slice(0, caret)}
                  <span className={focused ? 'cursor' : 'cursor-idle'}>{input[caret] ?? ' '}</span>
                  {input.slice(caret + 1)}
                </span>
                <label htmlFor="terminal-input" className="sr-only">
                  Type a command
                </label>
                <input
                  id="terminal-input"
                  ref={inputRef}
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value)
                    setCaret(e.target.selectionStart ?? e.target.value.length)
                    setOptions([])
                  }}
                  onSelect={(e) => setCaret(e.currentTarget.selectionStart ?? input.length)}
                  onKeyDown={onKeyDown}
                  onFocus={() => setFocused(true)}
                  onBlur={() => setFocused(false)}
                  autoComplete="off"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  enterKeyHint="go"
                  className="absolute inset-0 w-full bg-transparent text-transparent caret-transparent outline-none"
                />
              </div>
            </div>

            {options.length > 0 && <p className="whitespace-pre-wrap text-sec">{options.join('  ')}</p>}
            <div ref={bottomRef} className="h-4" />
          </div>

          <nav aria-label="Quick commands" className="flex flex-wrap gap-2 border-t border-dim px-4 py-2 sm:px-8">
            {QUICK_COMMANDS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => void run(c)}
                className="border border-dim px-2 text-sec hover:border-fg hover:text-hi"
              >
                {c}
              </button>
            ))}
          </nav>
        </div>
        {/* Wide screens only; re-renders after every command, so it tracks cwd and exit status. */}
        {panel && (
          <div className="hidden w-[34ch] shrink-0 lg:flex">
            <SidePanel shell={shell} />
          </div>
        )}
      </div>
    </RunContext.Provider>
  )
}

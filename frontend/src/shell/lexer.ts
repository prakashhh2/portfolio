import { ShellSyntaxError, type Operator, type Token, type Word, type WordPart } from './ast'

const VAR_START = /[A-Za-z_]/
const VAR_CHAR = /[A-Za-z0-9_]/

// Longest operators first so ">>" wins over ">".
const OPERATORS: Operator[] = ['2>&1', '2>>', '&>', '2>', '>>', '||', '&&', '|', ';', '>', '<']

export function lex(input: string): Token[] {
  const tokens: Token[] = []
  let parts: WordPart[] = []
  let inWord = false
  let i = 0

  const pushText = (value: string, quoted: boolean) => {
    const last = parts[parts.length - 1]
    if (last?.kind === 'text' && last.quoted === quoted) last.value += value
    else parts.push({ kind: 'text', value, quoted })
    inWord = true
  }
  const endWord = () => {
    if (inWord) tokens.push({ type: 'word', word: parts })
    parts = []
    inWord = false
  }
  // Reads $NAME, ${NAME} or $? starting at input[i] === '$'. Returns false for a literal '$'.
  const readVar = (quoted: boolean): boolean => {
    const next = input[i + 1]
    if (next === '?') {
      parts.push({ kind: 'var', name: '?', quoted })
      i += 2
    } else if (next === '{') {
      const close = input.indexOf('}', i + 2)
      const name = close === -1 ? '' : input.slice(i + 2, close)
      if (!/^([A-Za-z_][A-Za-z0-9_]*|\?)$/.test(name)) throw new ShellSyntaxError(`${input.slice(i)}: bad substitution`)
      parts.push({ kind: 'var', name, quoted })
      i = close + 1
    } else if (next === '(') {
      throw new ShellSyntaxError('command substitution $(...) is not supported')
    } else if (next && VAR_START.test(next)) {
      let j = i + 1
      while (j < input.length && VAR_CHAR.test(input[j])) j++
      parts.push({ kind: 'var', name: input.slice(i + 1, j), quoted })
      i = j
    } else {
      return false
    }
    inWord = true
    return true
  }

  while (i < input.length) {
    const ch = input[i]

    if (/\s/.test(ch)) {
      endWord()
      i++
      continue
    }
    if (ch === '#' && !inWord) break

    // "2>" is only an operator when the 2 starts a new word.
    const op = OPERATORS.find((o) => input.startsWith(o, i) && (!o.startsWith('2') || !inWord))
    if (op) {
      endWord()
      tokens.push({ type: 'op', op })
      i += op.length
      continue
    }
    if (ch === '&') throw new ShellSyntaxError('background jobs (&) are not supported')
    if (ch === '`') throw new ShellSyntaxError('command substitution `...` is not supported')

    if (ch === '\\') {
      if (i + 1 < input.length) pushText(input[i + 1], true)
      i += 2
    } else if (ch === "'") {
      const close = input.indexOf("'", i + 1)
      if (close === -1) throw new ShellSyntaxError("unexpected EOF while looking for matching `''")
      pushText(input.slice(i + 1, close), true)
      i = close + 1
    } else if (ch === '"') {
      inWord = true
      i++
      for (;;) {
        if (i >= input.length) throw new ShellSyntaxError('unexpected EOF while looking for matching `"\'')
        const c = input[i]
        if (c === '"') break
        if (c === '\\' && '$`"\\'.includes(input[i + 1] ?? '')) {
          pushText(input[i + 1], true)
          i += 2
        } else if (c === '$' && readVar(true)) {
          // variable consumed
        } else if (c === '`') {
          throw new ShellSyntaxError('command substitution `...` is not supported')
        } else {
          pushText(c, true)
          i++
        }
      }
      i++
    } else if (ch === '$' && readVar(false)) {
      // variable consumed
    } else if (ch === '~' && !inWord && /^(\/|\s|$|[|;&<>])/.test(input.slice(i + 1, i + 2) || '')) {
      parts.push({ kind: 'tilde' })
      inWord = true
      i++
    } else {
      pushText(ch, false)
      i++
    }
  }
  endWord()
  return tokens
}

export function wordToString(word: Word): string {
  return word.map((p) => (p.kind === 'text' ? p.value : p.kind === 'var' ? `$${p.name}` : '~')).join('')
}

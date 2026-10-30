import { ShellSyntaxError, type AndOr, type Pipeline, type RedirectOp, type Script, type SimpleCommand, type Token } from './ast'
import { lex } from './lexer'

// Grammar:
//   script   := and_or (';' and_or)* ';'?
//   and_or   := pipeline (('&&' | '||') pipeline)*
//   pipeline := command ('|' command)*
//   command  := (WORD | redirect)+
//   redirect := ('>' | '>>' | '<' | '2>' | '2>>' | '&>') WORD | '2>&1'

const REDIRECTS = new Set<string>(['>', '>>', '<', '2>', '2>>', '2>&1', '&>'])

export function parse(input: string): Script {
  const tokens = lex(input)
  let pos = 0

  const peek = (): Token | undefined => tokens[pos]
  const unexpected = (t: Token | undefined): never => {
    throw new ShellSyntaxError(`syntax error near unexpected token \`${t ? (t.type === 'op' ? t.op : 'word') : 'newline'}'`)
  }

  const command = (): SimpleCommand => {
    const cmd: SimpleCommand = { words: [], redirects: [] }
    for (let t = peek(); t; t = peek()) {
      if (t.type === 'word') {
        cmd.words.push(t.word)
        pos++
      } else if (REDIRECTS.has(t.op)) {
        pos++
        const op = t.op as RedirectOp
        if (op === '2>&1') {
          cmd.redirects.push({ op, target: null })
          continue
        }
        const target = peek()
        if (target?.type !== 'word') unexpected(target)
        cmd.redirects.push({ op, target: (target as { word: SimpleCommand['words'][number] }).word })
        pos++
      } else break
    }
    if (!cmd.words.length && !cmd.redirects.length) unexpected(peek())
    return cmd
  }

  const pipeline = (): Pipeline => {
    const cmds = [command()]
    while (peek()?.type === 'op' && (peek() as { op: string }).op === '|') {
      pos++
      cmds.push(command())
    }
    return cmds
  }

  const andOr = (): AndOr => {
    const node: AndOr = { first: pipeline(), rest: [] }
    for (let t = peek(); t?.type === 'op' && (t.op === '&&' || t.op === '||'); t = peek()) {
      pos++
      node.rest.push({ op: t.op, pipeline: pipeline() })
    }
    return node
  }

  const script: Script = []
  while (pos < tokens.length) {
    script.push(andOr())
    const t = peek()
    if (!t) break
    if (t.type === 'op' && t.op === ';') pos++
    else unexpected(t)
  }
  return script
}

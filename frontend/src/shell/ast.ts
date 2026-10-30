// A word is kept as parts so expansion ($VAR, ~, globs) happens at run time,
// after earlier commands in the same line have changed the environment.
export type WordPart =
  | { kind: 'text'; value: string; quoted: boolean }
  | { kind: 'var'; name: string; quoted: boolean }
  | { kind: 'tilde' }
export type Word = WordPart[]

export type RedirectOp = '>' | '>>' | '<' | '2>' | '2>>' | '2>&1' | '&>'
export type Operator = '|' | '||' | '&&' | ';' | RedirectOp

export type Token = { type: 'word'; word: Word } | { type: 'op'; op: Operator }

export type Redirect = { op: RedirectOp; target: Word | null } // null only for 2>&1
export type SimpleCommand = { words: Word[]; redirects: Redirect[] }
export type Pipeline = SimpleCommand[]
export type AndOr = { first: Pipeline; rest: { op: '&&' | '||'; pipeline: Pipeline }[] }
export type Script = AndOr[]

export class ShellSyntaxError extends Error {}

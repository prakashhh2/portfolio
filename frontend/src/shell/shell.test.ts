import { beforeEach, describe, expect, it } from 'vitest'
import { resolvePath } from '../filesystem/path'
import { parse } from './parser'
import { createShell } from './registry'
import type { Shell } from './shell'

let shell: Shell

/** Runs one line and returns what a user would see. */
async function sh(line: string) {
  let out = ''
  let err = ''
  const status = await shell.run(line, {
    stdout: (t) => void (out += t),
    stderr: (t) => void (err += t),
    clear: () => {},
  })
  return { out, err, status }
}

const text = sh // no ui hook: commands print plain text, as when piped

beforeEach(() => {
  shell = createShell()
})

describe('paths', () => {
  it('normalizes . and ..', () => {
    expect(resolvePath('a/./b/../c', '/home/x')).toBe('/home/x/a/c')
    expect(resolvePath('../../..', '/home/x')).toBe('/')
    expect(resolvePath('/etc//motd', '/tmp')).toBe('/etc/motd')
  })
})

describe('parser', () => {
  it('builds pipelines, and-or lists and redirects', () => {
    const [first, second] = parse('cat a | grep -i x > out.txt && echo ok; ls')
    expect(first.first).toHaveLength(2)
    expect(first.first[1].redirects[0].op).toBe('>')
    expect(first.rest[0].op).toBe('&&')
    expect(second.first[0].words).toHaveLength(1)
  })
  it('rejects bad syntax', () => {
    expect(() => parse('| ls')).toThrow(/unexpected token `\|'/)
    expect(() => parse('echo "open')).toThrow(/unexpected EOF/)
    expect(() => parse('echo $(whoami)')).toThrow(/not supported/)
  })
})

describe('spec examples', () => {
  it('navigates with pwd and cd', async () => {
    expect((await sh('pwd')).out).toBe('/home/prakash\n')
    await sh('cd projects')
    expect((await sh('pwd')).out).toBe('/home/prakash/projects\n')
    await sh('cd ..')
    expect((await sh('pwd')).out).toBe('/home/prakash\n')
    await sh('cd /etc')
    expect((await sh('cd -')).out).toBe('/home/prakash\n')
    await sh('cd')
    expect(shell.cwd).toBe('/home/prakash')
  })

  it('creates, writes and reads files', async () => {
    await sh('mkdir experiments')
    await sh('cd experiments')
    await sh('echo "Hello PeteOS" > hello.txt')
    expect(await sh('cat hello.txt')).toEqual({ out: 'Hello PeteOS\n', err: '', status: 0 })
  })

  it('works inside the sandbox', async () => {
    expect((await sh('mkdir sandbox/test')).status).toBe(0)
    await sh('echo "hello world" > sandbox/test/a.txt')
    expect((await sh('cat sandbox/test/a.txt')).out).toBe('hello world\n')
    expect((await sh('grep "hello" sandbox/test/a.txt')).out).toBe('hello world\n')
  })

  it('reports missing files', async () => {
    expect(await sh('cat missing.txt')).toEqual({ out: '', err: 'cat: missing.txt: No such file or directory\n', status: 1 })
  })

  it('pipes real file content through grep', async () => {
    const r = await sh('cat projects/relay4/README.md | grep -i "voice"')
    expect(r.status).toBe(0)
    expect(r.out.split('\n').filter(Boolean).every((l) => /voice/i.test(l))).toBe(true)
    expect(r.out).toContain('ElevenLabs voice conversation')
  })
})

describe('ls', () => {
  it('hides dotfiles unless -a', async () => {
    expect((await text('ls')).out).not.toContain('.secrets')
    const all = (await text('ls -a')).out.split('\n')
    expect(all.slice(0, 2)).toEqual(['.', '..'])
    expect(all).toContain('.secrets')
    expect((await text('ls -A')).out.split('\n')).not.toContain('.')
  })
  it('long format shows permissions and a total', async () => {
    const out = (await sh('ls -la projects/relay4')).out
    expect(out).toMatch(/^total \d+\n/)
    expect(out).toMatch(/-r--r--r-- 1 prakash prakash +\d+ \w{3} [ \d]\d [\d: ]{5} README\.md/)
    expect(out).toMatch(/^dr-xr-xr-x .* \.$/m)
  })
  it('rejects unknown flags', async () => {
    expect(await sh('ls -z')).toEqual({ out: '', err: "ls: invalid option -- 'z'\nTry 'ls --help' for more information.\n", status: 2 })
  })
  it('reports missing paths with status 2', async () => {
    expect((await sh('ls nope')).err).toBe("ls: cannot access 'nope': No such file or directory\n")
  })
})

describe('shell features', () => {
  it('handles quoting and escapes', async () => {
    expect((await sh(`echo 'a  b' "c $HOME" d\\ e`)).out).toBe('a  b c /home/prakash d e\n')
    expect((await sh(`echo '$HOME' "\\$HOME"`)).out).toBe('$HOME $HOME\n')
  })
  it('expands ~ and globs', async () => {
    expect((await sh('echo ~/x')).out).toBe('/home/prakash/x\n')
    expect((await sh('echo *.md')).out).toBe('README.md\n')
    expect((await sh('ls projects/*/README.md | wc -l')).out).toBe('3\n')
    expect((await sh('echo nomatch*')).out).toBe('nomatch*\n')
    expect((await sh('echo "*.md"')).out).toBe('*.md\n')
  })
  it('sets variables and $?', async () => {
    await sh('export GREETING=hi')
    await sh('NAME=pete')
    expect((await sh('echo $GREETING ${NAME}')).out).toBe('hi pete\n')
    expect(await sh('cat nope 2>/dev/null; echo $?')).toEqual({ out: '1\n', err: '', status: 0 })
    expect((await sh('echo gone > /dev/null && cat /dev/null')).out).toBe('')
  })
  it('runs && || and ;', async () => {
    expect((await sh('false && echo no; true && echo yes')).out).toBe('yes\n')
    expect((await sh('false || echo fallback')).out).toBe('fallback\n')
    expect((await sh('true || echo skipped')).out).toBe('')
  })
  it('redirects stdout, stderr and stdin', async () => {
    await sh('cd sandbox')
    await sh('echo one > f.txt')
    await sh('echo two >> f.txt')
    expect((await sh('cat f.txt')).out).toBe('one\ntwo\n')
    expect((await sh('wc -l < f.txt')).out).toBe('2\n')
    await sh('cat nope 2> err.txt')
    expect((await sh('cat err.txt')).out).toBe('cat: nope: No such file or directory\n')
    expect((await sh('cat nope 2>&1 | wc -l')).out).toBe('1\n')
    const r = await sh('cat nope | wc -l')
    expect([r.out, r.err]).toEqual(['0\n', 'cat: nope: No such file or directory\n'])
  })
  it('refuses to modify portfolio files', async () => {
    expect((await sh('echo hi > README.md')).err).toBe('pete-sh: README.md: Permission denied\n')
    expect((await sh('rm README.md')).err).toBe("rm: cannot remove 'README.md': Permission denied\n")
    expect((await sh('rm -rf projects')).status).toBe(1)
    expect((await sh('touch /etc/new')).err).toBe("touch: cannot touch '/etc/new': Permission denied\n")
  })
  it('reports unknown commands with status 127', async () => {
    const r = await sh('hlep')
    expect(r.status).toBe(127)
    expect(r.err).toBe("pete-sh: hlep: command not found (did you mean 'help'?)\n")
    expect((await sh('/bin/pwd')).out).toBe('/home/prakash\n')
  })
  it('records history', async () => {
    await sh('pwd')
    expect((await sh('history')).out).toBe('    1  pwd\n    2  history\n')
  })
})

describe('file commands', () => {
  it('cp, mv, rm and rmdir', async () => {
    await sh('cd sandbox && mkdir -p a/b && echo x > a/b/f')
    expect((await sh('rmdir a')).err).toBe("rmdir: failed to remove 'a': Directory not empty\n")
    expect((await sh('cp a c')).err).toBe("cp: -r not specified; omitting directory 'a'\n")
    await sh('cp -r a c && mv c/b/f c/b/g')
    expect((await sh('cat c/b/g')).out).toBe('x\n')
    expect((await sh('rm a')).err).toBe("rm: cannot remove 'a': Is a directory\n")
    expect((await sh('rm -r a && ls')).out).not.toContain('a\n')
    expect((await sh('cp ~/README.md . && cat README.md | head -n 1')).out).toBe('# Welcome to PeteOS\n')
  })
  it('find, head, tail, wc, sort, uniq, cut', async () => {
    expect((await sh('find projects -name "*.md" -type f | wc -l')).out).toBe('6\n')
    expect((await sh('head -n 1 projects/solpos/README.md')).out).toBe('# SolPOS\n')
    expect((await sh('tail -1 skills/languages.txt')).out).toBe('SQL\n')
    expect((await sh('printf "b\\na\\nb\\n" | sort | uniq -c')).out).toBe('      1 a\n      2 b\n')
    expect((await sh('cut -d: -f1 contact/contact.txt')).out).toBe('email\ngithub\nlinkedin\n')
    expect((await sh('echo "one two three" | wc -w')).out).toBe('3\n')
  })
  it('grep flags and exit codes', async () => {
    expect((await sh('grep -rl Solana projects')).out).toBe(
      'projects/credence/architecture.md\nprojects/credence/README.md\nprojects/credence/tech-stack.txt\nprojects/solpos/architecture.md\nprojects/solpos/README.md\nprojects/solpos/tech-stack.txt\n',
    )
    expect((await sh('grep -c USDC projects/solpos/README.md')).out).toBe('1\n')
    expect((await sh('grep zzz README.md')).status).toBe(1)
    expect((await sh('grep x projects')).status).toBe(2)
  })
  it('tree uses ASCII drawing', async () => {
    const out = (await sh('tree projects/relay4')).out
    expect(out).toBe('projects/relay4\n|-- architecture.md\n|-- links.txt\n|-- README.md\n`-- tech-stack.txt\n\n0 directories, 4 files\n')
  })
})

describe('completion', () => {
  it('completes commands and paths', () => {
    expect(shell.complete('ca').line).toBe('cat ')
    expect(shell.complete('cd proj').line).toBe('cd projects/')
    expect(shell.complete('cat projects/relay4/R').line).toBe('cat projects/relay4/README.md ')
    expect(shell.complete('ls ~/.sec').line).toBe('ls ~/.secrets/')
    const many = shell.complete('cat projects/relay4/')
    expect(many.options).toEqual(['architecture.md', 'links.txt', 'README.md', 'tech-stack.txt']) // GNU en_US order
  })
})

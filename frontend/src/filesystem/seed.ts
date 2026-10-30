import { profile } from '../portfolio/profile'
import { projects } from '../portfolio/projects'
import { skills } from '../portfolio/skills'
import { newDir, newFile, VirtualFileSystem, type DirNode, type FsNode } from './VirtualFileSystem'

export const HOME = `/home/${profile.user}`
export const BOOT_LOG = [
  'PETE BIOS v1.0',
  'Copyright (C) PeteOS',
  '',
  'POST: CPU ............................ OK',
  'POST: Memory ......................... OK',
  'POST: Video (phosphor) ............... OK',
  'Mounting virtual filesystem .......... OK',
  'Loading profile: prakash ............. OK',
  'Starting pete-sh ..................... OK',
]

// Stable timestamps: every seeded node gets a fixed time an hour after the last,
// so `ls -l` looks the same on every visit.
let clock = Date.UTC(2026, 8, 1, 14, 0)
const tick = () => (clock += 3_600_000)

type Opts = { mode?: number; owner?: string; writable?: boolean }
const ro = { writable: false }
const file = (content: string, opts: Opts = {}) => newFile(content, { ...ro, mtime: tick(), ...opts })
const dir = (entries: Record<string, FsNode>, opts: Opts = {}) => newDir(entries, { ...ro, mtime: tick(), ...opts })
const rootOwned = { owner: 'root' }

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
const lines = (...xs: (string | false | null | undefined)[]) => xs.filter((x) => x !== false && x != null).join('\n') + '\n'

const SUPPORTED = `# pete-sh: supported features

pete-sh is a small, Bash-like shell written for this portfolio. It is not Bash
and does not claim POSIX compliance. Everything runs in your browser against
a virtual filesystem; nothing touches your real computer.

## Grammar
  cmd1 | cmd2          pipelines (stdout only; stderr goes to the screen)
  cmd1 && cmd2         run cmd2 if cmd1 succeeded
  cmd1 || cmd2         run cmd2 if cmd1 failed
  cmd1 ; cmd2          run in sequence
  > file  >> file      redirect stdout (truncate / append)
  2> file 2>> file     redirect stderr
  2>&1   &> file       merge stderr into stdout
  < file               read stdin from a file
  'single' "double"    quoting; backslash escapes outside single quotes
  $VAR \${VAR} $?      variable expansion ($? = last exit status)
  ~                    home directory
  * ?                  filename globbing
  NAME=value           set a shell variable
  # comment            ignored

## Not supported
  command substitution $(...) and \`...\`, background jobs (&), here-docs,
  arithmetic, functions, aliases, loops and if/while/for.
  Unsupported options print an error instead of being ignored.

## Files
Portfolio files are read-only. You can create files and folders in
your home directory, in ~/sandbox, and in /tmp.
`

export function buildSeed(binaries: { name: string; summary: string }[]): DirNode {
  clock = Date.UTC(2026, 8, 1, 14, 0)
  const links = profile.links

  const home = dir(
    {
      'README.md': file(
        lines(
          `# Welcome to ${profile.brand}`,
          '',
          `This is the home directory of ${profile.name}.`,
          `${profile.role}`,
          '',
          'Things to try:',
          '  ls                      list this directory',
          '  cd projects && ls       look at projects',
          '  cat projects/relay4/README.md',
          '  grep -ri solana projects',
          '  tree                    see everything at once',
          '  help                    list every command',
          '',
          'Portfolio files are read-only. ~/sandbox and /tmp are yours to play in.',
        ),
      ),
      '.profile': file(lines('# Environment PeteOS sets at login (see: env)', `export USER=${profile.user}`, 'export SHELL=/bin/pete-sh', `export EDITOR=none # no editors here, try echo "text" > file`)),
      '.secrets': dir({
        'note.txt': file(lines('You found the hidden directory.', 'Hidden files start with a dot; `ls -a` shows them.', 'More secrets are coming in a future update.')),
      }),
      about: dir({
        'bio.txt': file(lines(profile.name, profile.role, '', ...profile.bio, '', `Location: ${profile.location}`, `Status:   ${profile.status}`)),
        'education.md': file(
          lines('# Education', '', ...profile.education.flatMap((e) => [`## ${e.school}`, e.degree, e.years && `Years: ${e.years}`, ''])),
        ),
        'interests.txt': file(lines(...profile.interests)),
      }),
      projects: dir(
        Object.fromEntries(
          projects.map((p) => [
            p.id,
            dir({
              'README.md': file(p.readme),
              'architecture.md': file(p.architecture),
              'tech-stack.txt': file(lines(...p.tech)),
              'links.txt': file(lines(`repo: ${p.repo ?? '(not linked yet)'}`, `demo: ${p.demo ?? '(not linked yet)'}`)),
            }),
          ]),
        ),
      ),
      skills: dir(Object.fromEntries(Object.entries(skills).map(([group, items]) => [`${slug(group)}.txt`, file(lines(...items))]))),
      experience: dir(
        Object.fromEntries(
          profile.experience.map((e) => [`${e.id}.md`, file(lines(`# ${e.title}`, `${e.org} · ${e.years}`, '', e.summary))]),
        ),
      ),
      achievements: dir(Object.fromEntries(profile.achievements.map((a) => [`${a.id}.txt`, file(lines(a.title, '', a.detail))]))),
      resume: dir({
        'README.txt': file(lines('The full resume is a document, not a text file.', 'Run `resume` to get a download link.', '', `Path on the web: ${links.resume}`)),
      }),
      contact: dir({
        'contact.txt': file(
          lines(`email:    ${links.email}`, `github:   ${links.github}`, `linkedin: ${links.linkedin ?? '(not set yet)'}`),
        ),
      }),
      sandbox: dir(
        { 'README.txt': file(lines('This directory is writable. Try:', '  echo "hello" > hello.txt', '  mkdir -p notes/ideas', '  ls -la')) },
        { writable: true, mode: 0o755 },
      ),
    },
    { writable: true, mode: 0o755 },
  )

  return dir(
    {
      bin: dir(
        Object.fromEntries(binaries.map((b) => [b.name, file(lines('#!/bin/pete-sh', `# ${b.name} — ${b.summary}`, '# built into PeteOS'), { ...rootOwned, mode: 0o555 })])),
        rootOwned,
      ),
      dev: dir({ null: file('', { owner: 'root', writable: true, mode: 0o666 }) }, rootOwned),
      etc: dir(
        {
          hostname: file('peteos\n', rootOwned),
          motd: file(lines(`Welcome to ${profile.brand} 1.0. Type 'help' to get started.`), rootOwned),
          'os-release': file(lines('NAME="PeteOS"', 'VERSION="1.0 (Virtual)"', 'ID=peteos', 'PRETTY_NAME="PeteOS 1.0"'), rootOwned),
          'peteos.conf': file(lines('# PeteOS configuration (read-only)', 'shell=/bin/pete-sh', `home=${HOME}`, 'writable=~ ~/sandbox /tmp'), rootOwned),
        },
        rootOwned,
      ),
      home: dir({ [profile.user]: home }, rootOwned),
      tmp: dir({}, { writable: true, mode: 0o1777, owner: 'root' }),
      usr: dir(
        { share: dir({ doc: dir({ peteos: dir({ 'SUPPORTED.md': file(SUPPORTED, rootOwned) }, rootOwned) }, rootOwned) }, rootOwned) },
        rootOwned,
      ),
      var: dir({ log: dir({ 'boot.log': file(lines(...BOOT_LOG), rootOwned) }, rootOwned) }, rootOwned),
    },
    rootOwned,
  )
}

export function createFileSystem(binaries: { name: string; summary: string }[]): VirtualFileSystem {
  return new VirtualFileSystem(buildSeed(binaries))
}

import { basename, dirname, joinPath } from './path'

// An in-memory tree. Seeded portfolio content is read-only; only directories
// marked writable (home, ~/sandbox, /tmp) accept new entries, and only
// user-created nodes can be changed or removed.

type Meta = { mode: number; mtime: number; owner: string; writable: boolean }
export type FileNode = Meta & { kind: 'file'; content: string }
export type DirNode = Meta & { kind: 'dir'; children: Map<string, FsNode> }
export type FsNode = FileNode | DirNode

const MESSAGES = {
  ENOENT: 'No such file or directory',
  ENOTDIR: 'Not a directory',
  EISDIR: 'Is a directory',
  EACCES: 'Permission denied',
  EEXIST: 'File exists',
  ENOTEMPTY: 'Directory not empty',
  EINVAL: 'Invalid argument',
} as const
export type FsCode = keyof typeof MESSAGES

export class FsError extends Error {
  constructor(public code: FsCode) {
    super(MESSAGES[code])
  }
}

export function newFile(content: string, opts: Partial<Meta> = {}): FileNode {
  const writable = opts.writable ?? true
  return { kind: 'file', content, mode: writable ? 0o644 : 0o444, mtime: Date.now(), owner: 'prakash', writable, ...opts }
}

export function newDir(entries: Record<string, FsNode> = {}, opts: Partial<Meta> = {}): DirNode {
  const writable = opts.writable ?? true
  return {
    kind: 'dir',
    children: new Map(Object.entries(entries)),
    mode: writable ? 0o755 : 0o555,
    mtime: Date.now(),
    owner: 'prakash',
    writable,
    ...opts,
  }
}

export function byteSize(node: FsNode): number {
  return node.kind === 'dir' ? 4096 : new TextEncoder().encode(node.content).length
}

export class VirtualFileSystem {
  constructor(public root: DirNode) {}

  /** Returns the node at an absolute path, or throws ENOENT / ENOTDIR. */
  stat(abs: string): FsNode {
    let node: FsNode = this.root
    for (const seg of abs.split('/').filter(Boolean)) {
      if (node.kind !== 'dir') throw new FsError('ENOTDIR')
      const next = node.children.get(seg)
      if (!next) throw new FsError('ENOENT')
      node = next
    }
    return node
  }

  exists(abs: string): boolean {
    try {
      this.stat(abs)
      return true
    } catch {
      return false
    }
  }

  readFile(abs: string): string {
    const node = this.stat(abs)
    if (node.kind === 'dir') throw new FsError('EISDIR')
    return node.content
  }

  /** Directory entries sorted like GNU ls in an English locale (dots and case ignored). */
  readDir(abs: string): [string, FsNode][] {
    const node = this.stat(abs)
    if (node.kind !== 'dir') throw new FsError('ENOTDIR')
    return [...node.children].sort(([a], [b]) => sortKey(a).localeCompare(sortKey(b)) || a.localeCompare(b))
  }

  private parentDir(abs: string): DirNode {
    const parent = this.stat(dirname(abs))
    if (parent.kind !== 'dir') throw new FsError('ENOTDIR')
    return parent
  }

  writeFile(abs: string, content: string, append = false): void {
    if (abs === '/dev/null') return // discards everything
    const parent = this.parentDir(abs)
    const existing = parent.children.get(basename(abs))
    if (existing) {
      if (existing.kind === 'dir') throw new FsError('EISDIR')
      if (!existing.writable) throw new FsError('EACCES')
      existing.content = append ? existing.content + content : content
      existing.mtime = Date.now()
      return
    }
    if (!parent.writable) throw new FsError('EACCES')
    parent.children.set(basename(abs), newFile(content))
    parent.mtime = Date.now()
  }

  touch(abs: string): void {
    const parent = this.parentDir(abs)
    const existing = parent.children.get(basename(abs))
    if (!existing) return this.writeFile(abs, '')
    if (!existing.writable) throw new FsError('EACCES')
    existing.mtime = Date.now()
  }

  mkdir(abs: string, parents = false): void {
    if (parents) {
      let path = ''
      for (const seg of abs.split('/').filter(Boolean)) {
        path += '/' + seg
        const node = this.exists(path) ? this.stat(path) : null
        if (node?.kind === 'file') throw new FsError('ENOTDIR')
        if (!node) this.mkdir(path)
      }
      return
    }
    const parent = this.parentDir(abs)
    if (parent.children.has(basename(abs))) throw new FsError('EEXIST')
    if (!parent.writable) throw new FsError('EACCES')
    parent.children.set(basename(abs), newDir())
    parent.mtime = Date.now()
  }

  /** Remove a file, an empty directory (`dirOk`), or a whole tree (`recursive`). */
  remove(abs: string, { recursive = false, dirOk = false } = {}): void {
    if (abs === '/') throw new FsError('EACCES')
    const node = this.stat(abs)
    const parent = this.parentDir(abs)
    if (node.kind === 'dir') {
      if (!recursive && !dirOk) throw new FsError('EISDIR')
      if (!recursive && node.children.size) throw new FsError('ENOTEMPTY')
    }
    if (!parent.writable || !allWritable(node)) throw new FsError('EACCES')
    parent.children.delete(basename(abs))
    parent.mtime = Date.now()
  }

  copy(src: string, dest: string, recursive = false): void {
    const node = this.stat(src)
    if (node.kind === 'dir' && !recursive) throw new FsError('EISDIR')
    if (node.kind === 'dir' && (dest + '/').startsWith(src + '/')) throw new FsError('EINVAL')
    const parent = this.parentDir(dest)
    const existing = parent.children.get(basename(dest))
    if (existing && (existing.kind === 'dir' || !existing.writable)) throw new FsError(existing.kind === 'dir' ? 'EISDIR' : 'EACCES')
    if (!parent.writable) throw new FsError('EACCES')
    parent.children.set(basename(dest), cloneWritable(node))
    parent.mtime = Date.now()
  }

  move(src: string, dest: string): void {
    if (src === dest) return
    const node = this.stat(src)
    if (node.kind === 'dir' && (dest + '/').startsWith(src + '/')) throw new FsError('EINVAL')
    const srcParent = this.parentDir(src)
    const destParent = this.parentDir(dest)
    const existing = destParent.children.get(basename(dest))
    if (existing?.kind === 'dir') throw new FsError('EISDIR')
    if (!srcParent.writable || !node.writable || !destParent.writable || (existing && !existing.writable)) {
      throw new FsError('EACCES')
    }
    srcParent.children.delete(basename(src))
    destParent.children.set(basename(dest), node)
    srcParent.mtime = destParent.mtime = Date.now()
  }

  /** Every path under `abs` (depth-first, sorted), including `abs` itself. */
  walk(abs: string, visit: (path: string, node: FsNode, depth: number) => void, depth = 0): void {
    const node = this.stat(abs)
    visit(abs, node, depth)
    if (node.kind === 'dir') for (const [name] of this.readDir(abs)) this.walk(joinPath(abs, name), visit, depth + 1)
  }
}

function sortKey(name: string): string {
  return name.replace(/^\.+/, '').toLowerCase()
}

function allWritable(node: FsNode): boolean {
  return node.writable && (node.kind === 'file' || [...node.children.values()].every(allWritable))
}

function cloneWritable(node: FsNode): FsNode {
  if (node.kind === 'file') return newFile(node.content)
  return newDir(Object.fromEntries([...node.children].map(([k, v]) => [k, cloneWritable(v)])))
}

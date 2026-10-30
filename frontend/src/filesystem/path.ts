/** Resolve `path` against `cwd` into a normalized absolute path ("." and ".." applied). */
export function resolvePath(path: string, cwd: string): string {
  const full = path.startsWith('/') ? path : `${cwd}/${path}`
  const out: string[] = []
  for (const seg of full.split('/')) {
    if (seg === '' || seg === '.') continue
    if (seg === '..') out.pop()
    else out.push(seg)
  }
  return '/' + out.join('/')
}

export function basename(path: string): string {
  const trimmed = path.replace(/\/+$/, '')
  return trimmed.slice(trimmed.lastIndexOf('/') + 1) || '/'
}

export function dirname(abs: string): string {
  const i = abs.lastIndexOf('/')
  return i <= 0 ? '/' : abs.slice(0, i)
}

export function joinPath(dir: string, name: string): string {
  return dir === '/' ? `/${name}` : `${dir}/${name}`
}

/** Show a path the way a prompt does: $HOME becomes "~". */
export function tildify(abs: string, home: string): string {
  if (abs === home) return '~'
  return abs.startsWith(home + '/') ? '~' + abs.slice(home.length) : abs
}

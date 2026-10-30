import { profile } from '../../portfolio/profile'
import { NeofetchView } from '../../shell/commands/portfolio'
import type { Shell } from '../../shell/shell'
import { Cmd } from './ui'

export const QUICK_COMMANDS = ['help', 'ls', 'projects', 'neofetch', 'contact', 'resume']

export function Welcome({ shell }: { shell: Shell }) {
  return (
    <div className="space-y-3">
      <NeofetchView shell={shell} />
      <div>
        <p>
          Welcome to {profile.brand}, the interactive portfolio of <span className="text-hi">{profile.name}</span>.
        </p>
        <p className="text-sec">A small Linux-style shell runs in your browser. Explore it like a real machine.</p>
      </div>
      <p>
        Try:{' '}
        {['help', 'ls', 'cat README.md', 'projects', 'tree projects'].map((c, i) => (
          <span key={c}>
            {i > 0 && '  '}
            <Cmd run={c} />
          </span>
        ))}
      </p>
      <p className="text-sec">Tab completes, ↑/↓ history, Ctrl+C cancels the line, Ctrl+L clears.</p>
    </div>
  )
}

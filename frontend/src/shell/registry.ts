import { createFileSystem, HOME } from '../filesystem/seed'
import { profile } from '../portfolio/profile'
import { fileCommands } from './commands/files'
import { portfolioCommands, settingsCommands } from './commands/portfolio'
import { systemCommands } from './commands/system'
import { textCommands } from './commands/text'
import { Shell } from './shell'
import type { Command } from './types'

export const COMMANDS = new Map<string, Command>(
  [...portfolioCommands, ...fileCommands, ...textCommands, ...systemCommands, ...settingsCommands].map((c) => [c.name, c]),
)

export function createShell(): Shell {
  const binaries = [...COMMANDS.values()].filter((c) => !c.noBinary)
  return new Shell(createFileSystem(binaries), COMMANDS, HOME, profile.user)
}

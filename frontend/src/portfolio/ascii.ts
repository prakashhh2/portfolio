// Figlet "standard"-style letters, joined in code so rows always line up.
// Backslashes are doubled because these are ordinary string literals.
const LETTERS: Record<string, string[]> = {
  P: [' ____  ', '|  _ \\ ', '| |_) |', '|  __/ ', '|_|    '],
  R: [' ____  ', '|  _ \\ ', '| |_) |', '|  _ < ', '|_| \\_\\'],
  A: ['    _    ', '   / \\   ', '  / _ \\  ', ' / ___ \\ ', '/_/   \\_\\'],
  K: [' _  __', "| |/ /", "| ' / ", '| . \\ ', '|_|\\_\\'],
  S: [' ____  ', '/ ___| ', '\\___ \\ ', ' ___) |', '|____/ '],
  H: [' _   _ ', '| | | |', '| |_| |', '|  _  |', '|_| |_|'],
  O: ['  ___  ', ' / _ \\ ', '| | | |', '| |_| |', ' \\___/ '],
  e: ['      ', '  ___ ', ' / _ \\', '|  __/', ' \\___|'],
  t: [' _   ', '| |_ ', '| __|', '| |_ ', ' \\__|'],
}

export function bigText(word: string): string {
  return [0, 1, 2, 3, 4]
    .map((row) => [...word].map((ch) => LETTERS[ch][row]).join('').trimEnd())
    .join('\n')
}

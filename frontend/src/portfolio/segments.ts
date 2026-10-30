// Which segments light up for each character on a seven-segment display.
//    a
//  f   b
//    g
//  e   c
//    d
export const SEGMENTS: Record<string, string> = {
  '0': 'abcdef',
  '1': 'bc',
  '2': 'abged',
  '3': 'abgcd',
  '4': 'fgbc',
  '5': 'afgcd',
  '6': 'afgedc',
  '7': 'abc',
  '8': 'abcdefg',
  '9': 'abcdfg',
  '-': 'g',
  '°': 'abgf',
  F: 'aefg',
  C: 'adef',
  ' ': '',
}

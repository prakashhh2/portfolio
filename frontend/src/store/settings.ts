import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// "-hc" themes are high contrast: near-opaque black glass, brighter secondary text, white highlights.
export const THEMES = ['green-hc', 'amber-hc', 'green', 'amber', 'white', 'blue', 'contrast'] as const
export type Theme = (typeof THEMES)[number]
export const DEFAULT_THEME: Theme = 'green-hc'

type Settings = {
  theme: Theme
  crt: boolean
  background: boolean
  panel: boolean
  setTheme: (theme: Theme) => void
  setCrt: (on: boolean) => void
  setBackground: (on: boolean) => void
  setPanel: (on: boolean) => void
}

export const useSettings = create<Settings>()(
  persist(
    (set) => ({
      theme: DEFAULT_THEME,
      crt: true,
      background: true,
      panel: true,
      setTheme: (theme) => set({ theme }),
      setCrt: (crt) => set({ crt }),
      setBackground: (background) => set({ background }),
      setPanel: (panel) => set({ panel }),
    }),
    {
      name: 'peteos.settings',
      version: 1,
      // v0 defaulted to plain 'green'; move people still on it to the new high-contrast default.
      migrate: (state, version) => {
        const s = state as Partial<Settings>
        if (version < 1 && (!s.theme || s.theme === 'green')) s.theme = DEFAULT_THEME
        return s as Settings
      },
    },
  ),
)

import { useState, useEffect } from 'react'

type AccentPreset = {
  name: string
  hex: string
  hover: string
}

const DARK_ACCENTS: AccentPreset[] = [
  { name: 'Emerald', hex: '#53c28b', hover: '#6ee7a8' },
  { name: 'Sky', hex: '#60a5fa', hover: '#93c5fd' },
  { name: 'Violet', hex: '#a78bfa', hover: '#c4b5fd' },
  { name: 'Amber', hex: '#fbbf24', hover: '#fcd34d' },
  { name: 'Rose', hex: '#fb7185', hover: '#fda4af' },
]

const LIGHT_ACCENTS: AccentPreset[] = [
  { name: 'Emerald', hex: '#059669', hover: '#047857' },
  { name: 'Blue', hex: '#2563eb', hover: '#1d4ed8' },
  { name: 'Purple', hex: '#7c3aed', hover: '#6d28d9' },
  { name: 'Amber', hex: '#d97706', hover: '#b45309' },
  { name: 'Rose', hex: '#e11d48', hover: '#be123c' },
]

function hexToRgb(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return { r, g, b }
}

function applyAccent(hex: string, hover: string) {
  const { r, g, b } = hexToRgb(hex)
  const el = document.documentElement
  el.style.setProperty('--color-accent', hex)
  el.style.setProperty('--color-accent-hover', hover)
  el.style.setProperty('--color-group-bg', `rgba(${r}, ${g}, ${b}, 0.06)`)
  el.style.setProperty('--color-group-border', `rgba(${r}, ${g}, ${b}, 0.25)`)
  el.style.setProperty('--color-group-collapsed-bg', `rgba(${r}, ${g}, ${b}, 0.12)`)
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('flow-builder-theme') as 'dark' | 'light') || 'dark'
  })

  const [accentIdx, setAccentIdx] = useState<number>(() => {
    const stored = localStorage.getItem(`flow-builder-accent-${theme}`)
    return stored ? parseInt(stored, 10) : 0
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('flow-builder-theme', theme)
    const storedIdx = localStorage.getItem(`flow-builder-accent-${theme}`)
    const idx = storedIdx ? parseInt(storedIdx, 10) : 0
    setAccentIdx(idx)
    const presets = theme === 'dark' ? DARK_ACCENTS : LIGHT_ACCENTS
    const preset = presets[idx] ?? presets[0]
    applyAccent(preset.hex, preset.hover)
  }, [theme])

  const isDark = theme === 'dark'
  const toggle = () => setTheme(isDark ? 'light' : 'dark')
  const accents = isDark ? DARK_ACCENTS : LIGHT_ACCENTS

  const pickAccent = (idx: number) => {
    setAccentIdx(idx)
    localStorage.setItem(`flow-builder-accent-${theme}`, String(idx))
    const preset = accents[idx]
    applyAccent(preset.hex, preset.hover)
  }

  return (
    <div
      className="fixed bottom-14 left-4 z-50 flex flex-col gap-2 px-3 py-2.5 rounded-lg text-xs"
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        color: 'var(--color-text-muted)',
      }}
    >
      {/* Theme toggle row */}
      <div className="flex items-center gap-2">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="8" cy="8" r="4" />
          <line x1="8" y1="1" x2="8" y2="3" />
          <line x1="8" y1="13" x2="8" y2="15" />
          <line x1="1" y1="8" x2="3" y2="8" />
          <line x1="13" y1="8" x2="15" y2="8" />
        </svg>
        <button
          onClick={toggle}
          style={{
            width: 36,
            height: 20,
            borderRadius: 10,
            border: '1px solid var(--color-border)',
            background: isDark ? 'var(--color-accent)' : 'var(--color-border)',
            position: 'relative',
            cursor: 'pointer',
            padding: 0,
            transition: 'background 0.2s',
          }}
        >
          <div
            style={{
              width: 14,
              height: 14,
              borderRadius: '50%',
              background: 'white',
              position: 'absolute',
              top: 2,
              left: isDark ? 19 : 2,
              transition: 'left 0.2s',
              boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
            }}
          />
        </button>
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M13 8.5a5.5 5.5 0 0 1-7.5-7.5 6 6 0 1 0 7.5 7.5z" />
        </svg>
      </div>

      {/* Accent color row */}
      <div className="flex items-center gap-1.5">
        {accents.map((preset, i) => (
          <button
            key={preset.name}
            onClick={() => pickAccent(i)}
            title={preset.name}
            style={{
              width: 18,
              height: 18,
              borderRadius: '50%',
              background: preset.hex,
              border: i === accentIdx ? '2px solid var(--color-text)' : '2px solid transparent',
              cursor: 'pointer',
              padding: 0,
              outline: 'none',
              transition: 'border-color 0.15s',
              boxShadow: i === accentIdx ? '0 0 0 1px var(--color-surface)' : 'none',
            }}
          />
        ))}
      </div>
    </div>
  )
}

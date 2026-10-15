import type { ReactNode } from 'react'

export function Pill({ tone, children }: { tone?: 'success' | 'warning'; children: ReactNode }) {
  return <span className={tone ? `pill ${tone}` : 'pill'}>{children}</span>
}

export function Tag({ active = false, children }: { active?: boolean; children: ReactNode }) {
  return <span className={active ? 'tag active' : 'tag'}>{children}</span>
}

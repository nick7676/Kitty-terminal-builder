import type { ReactNode } from 'react'

export function Field({ label, children }: { label: ReactNode; children: ReactNode }) {
  return <div className="field"><span>{label}</span>{children}</div>
}

export function TextField({ label, value, placeholder, onChange, list, suggestions }: {
  label: string
  value: string
  placeholder?: string
  onChange: (value: string) => void
  list?: string
  suggestions?: readonly string[]
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input className="input" list={list} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
      {suggestions && list ? <datalist id={list}>{suggestions.map((choice) => <option key={choice} value={choice} />)}</datalist> : null}
    </label>
  )
}

export function SliderField({ label, value, min, max, step, fallback = 0, onChange }: {
  label: string
  value: string
  min: number
  max: number
  step: number
  fallback?: number
  onChange: (value: string) => void
}) {
  return (
    <label className="field slider-row">
      <span>{label} <b>{value}</b></span>
      <input type="range" min={min} max={max} step={step} value={Number.parseFloat(value) || fallback} onChange={(event) => onChange(event.target.value)} />
    </label>
  )
}

type SegmentOption<T extends string> = T | { value: T; label: string }

export function Segmented<T extends string>({ value, options, onChange }: {
  value: string
  options: readonly SegmentOption<T>[]
  onChange: (value: T) => void
}) {
  const items = options.map((option) => (typeof option === 'string' ? { value: option, label: option } : option))
  return (
    <div className="segment">
      {items.map((item) => (
        <button key={item.value} className={value === item.value ? 'active' : ''} type="button" onClick={() => onChange(item.value)}>{item.label}</button>
      ))}
    </div>
  )
}

export function ChoiceGrid({ value, options, onChange }: { value: string; options: readonly string[]; onChange: (value: string) => void }) {
  return (
    <div className="choice-grid">
      {options.map((item) => (
        <button key={item} className={value === item ? 'active' : ''} type="button" onClick={() => onChange(item)}>{item}</button>
      ))}
    </div>
  )
}

export function SelectField({ label, value, onChange, children, mono = false }: {
  label: string
  value: string
  onChange: (value: string) => void
  children: ReactNode
  mono?: boolean
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <select className={mono ? 'select mono' : 'select'} value={value} onChange={(event) => onChange(event.target.value)}>{children}</select>
    </label>
  )
}

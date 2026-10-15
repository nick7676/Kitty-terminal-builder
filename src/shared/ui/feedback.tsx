import type { ReactNode, RefObject } from 'react'

export function SearchField({ id, value, placeholder, onChange }: { id?: string; value: string; placeholder: string; onChange: (value: string) => void }) {
  return (
    <div className="search-wrap">
      <input id={id} className="input" placeholder={placeholder} value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  )
}

export function Notice({ children }: { children: ReactNode }) {
  return <div className="notice">{children}</div>
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>
}

export function CheckList({ items }: { items: { label: string; detail: ReactNode }[] }) {
  return (
    <div className="check-list">
      {items.map((item) => <div className="check" key={item.label}><span>{item.label}</span>{item.detail}</div>)}
    </div>
  )
}

export function ImageFileInput({ inputRef, onFile }: { inputRef: RefObject<HTMLInputElement | null>; onFile: (file: File) => void }) {
  return (
    <input ref={inputRef} hidden type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(event) => {
      const file = event.target.files?.[0]
      if (file) onFile(file)
    }} />
  )
}

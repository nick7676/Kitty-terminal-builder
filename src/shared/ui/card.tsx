import type { CSSProperties, ReactNode } from 'react'

export function Card({ padded = false, className = '', style, children }: { padded?: boolean; className?: string; style?: CSSProperties; children: ReactNode }) {
  return <div className={['card', padded ? 'card-pad' : '', className].filter(Boolean).join(' ')} style={style}>{children}</div>
}

export function Panel({ title, extra, children }: { title: string; extra?: ReactNode; children: ReactNode }) {
  return (
    <section className="card card-pad">
      {extra ? <div className="panel-title"><b>{title}</b>{extra}</div> : <b>{title}</b>}
      {children}
    </section>
  )
}

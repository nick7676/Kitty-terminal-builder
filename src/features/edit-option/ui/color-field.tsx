import { cssColor } from '@/entities/appearance'
import { useWorkspace } from '@/entities/workspace'
import { useOption } from '../model/use-option'

export function ColorField({ name, label, fallback, compact = false }: { name: string; label: string; fallback: string; compact?: boolean }) {
  const editValue = useWorkspace((state) => state.editValue)
  const option = useOption(name, fallback)
  return (
    <label className={`swatch ${compact ? 'compact' : ''}`} title={label}>
      <input type="color" aria-label={label} value={cssColor(option.effective, fallback)} onChange={(event) => editValue(name, event.target.value)} />
      <span><b>{compact ? label.replace('Bright ', 'B.') : label}</b>
        <input className="input" value={option.raw} placeholder={fallback} onChange={(event) => editValue(name, event.target.value)} />
      </span>
    </label>
  )
}

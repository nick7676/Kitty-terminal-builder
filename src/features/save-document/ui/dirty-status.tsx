import { Pill } from '@/shared/ui'
import { useDirty } from '../model/save'

export function DirtyStatus({ labels = ['Modified', 'Saved'] }: { labels?: readonly [string, string] }) {
  const dirty = useDirty()
  return <Pill tone={dirty ? 'warning' : 'success'}>{dirty ? labels[0] : labels[1]}</Pill>
}

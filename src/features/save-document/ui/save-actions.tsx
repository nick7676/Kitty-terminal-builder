import type { ReactNode } from 'react'
import { isTauri } from '@/shared/api'
import { Button } from '@/shared/ui'
import { useSaveDocument } from '../model/save'
import { DirtyStatus } from './dirty-status'

export function SaveActions({ children, after }: { children?: ReactNode; after?: () => Promise<void> }) {
  const { dirty, discard, save } = useSaveDocument(after)
  return (
    <div className="toolbar-actions">
      <DirtyStatus />
      <Button disabled={!dirty} onClick={discard}>Discard</Button>
      {children}
      <Button variant="primary" disabled={!dirty || !isTauri()} onClick={() => void save()}>Save & reload</Button>
    </div>
  )
}

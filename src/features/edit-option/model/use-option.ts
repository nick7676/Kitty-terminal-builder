import { useWorkspace, valuesOf } from '@/entities/workspace'

export function useOption(key: string, fallback: string) {
  const document = useWorkspace((state) => state.document)
  const raw = valuesOf(document, key).at(-1) ?? ''
  return { raw, effective: raw.trim() ? raw : fallback }
}

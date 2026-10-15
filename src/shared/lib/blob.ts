export function swapBlob(current: string, file: File) {
  if (current.startsWith('blob:')) URL.revokeObjectURL(current)
  return URL.createObjectURL(file)
}

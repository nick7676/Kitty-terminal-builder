import { TerminalPreview } from '@/widgets/terminal-preview'
import { useBuilderImages } from '../model/use-images'
import { useLayoutEditor } from '../model/use-layout'
import { BuilderControls, useOpenMainConfig } from './builder-controls'

export function BuilderPage() {
  useOpenMainConfig()
  const layout = useLayoutEditor()
  const images = useBuilderImages()
  return (
    <div className="builder">
      <BuilderControls layout={layout} images={images} />
      <TerminalPreview imageUrl={images.previewUrl} panes={layout.panes} selected={layout.selectedPane} onSelect={layout.setSelectedPane} onResize={layout.onResize} onCommit={layout.onCommit} />
    </div>
  )
}

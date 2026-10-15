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
      <TerminalPreview imageUrl={images.previewUrl} paneUrl={images.paneUrl} paneSize={images.paneSize} onResize={images.resizePane} tree={layout.tree} selected={layout.selectedPane} onSelect={layout.setSelectedPane} onRatio={layout.onRatio} onCommit={layout.onCommit} />
    </div>
  )
}

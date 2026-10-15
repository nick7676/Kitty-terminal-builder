import { useQueryClient } from '@tanstack/react-query'
import { diffLines } from 'diff'
import { fileTemplates } from '@/entities/template'
import { contentOf, useWorkspace } from '@/entities/workspace'
import { confirmDiscard, SaveActions } from '@/features/save-document'
import { useBackups } from '@/shared/api'
import { Button } from '@/shared/ui'

export function FilesPage() {
  const queryClient = useQueryClient()
  const files = useWorkspace((state) => state.files)
  const activeFile = useWorkspace((state) => state.activeFile)
  const document = useWorkspace((state) => state.document)
  const original = useWorkspace((state) => state.original)
  const status = useWorkspace((state) => state.status)
  const filesMode = useWorkspace((state) => state.filesMode)
  const openFile = useWorkspace((state) => state.openFile)
  const replaceSource = useWorkspace((state) => state.replaceSource)
  const createFromTemplate = useWorkspace((state) => state.createFromTemplate)
  const restoreBackup = useWorkspace((state) => state.restoreBackup)
  const setFilesMode = useWorkspace((state) => state.setFilesMode)
  const toast = useWorkspace((state) => state.toast)
  const backups = useBackups(activeFile)
  const source = contentOf(document)
  const listed = files.some((file) => file.relativePath === 'kitty.conf') ? files : [{ relativePath: 'kitty.conf', size: 0 }, ...files]
  const refreshBackups = async () => { await queryClient.invalidateQueries({ queryKey: ['backups', activeFile] }) }

  return (
    <div className="files-layout">
      <aside className="file-panel">
        <div className="panel-title"><div><b>Configuration files</b><div className="option-group">{files.length} discovered</div></div></div>
        <form className="template-row" onSubmit={(event) => {
          event.preventDefault()
          const selected = new FormData(event.currentTarget).get('template')
          const path = prompt('Path inside the kitty config directory:', String(selected))
          if (!path) return
          const includeProfile = path.startsWith('profiles/') && confirm(`Add "include ${path}" to kitty.conf?`)
          void createFromTemplate(path, fileTemplates[String(selected)], includeProfile).catch((error) => toast(String(error)))
        }}>
          <select name="template" className="select">{Object.keys(fileTemplates).map((path) => <option key={path}>{path}</option>)}</select>
          <Button type="submit">+</Button>
        </form>
        {listed.map((file) => (
          <button key={file.relativePath} className={`file-button ${file.relativePath === activeFile ? 'active' : ''}`} type="button" onClick={() => {
            if (!confirmDiscard('Discard unsaved changes and open another file?')) return
            void openFile(file.relativePath)
          }}><span>▤ {file.relativePath}</span><small>{file.size} B</small></button>
        ))}
        <div className="backup-list">
          <p className="eyebrow">Automatic backups</p>
          {backups.data?.length ? backups.data.slice(0, 10).map((backup) => (
            <button key={backup.path} className="backup-button" type="button" onClick={() => {
              if (!confirm(`Restore this backup over ${activeFile}? The current file will also be backed up.`)) return
              void restoreBackup(backup.path).then(refreshBackups).catch((error) => toast(String(error)))
            }}>↺ {new Date(backup.timestamp * 1000).toLocaleString()}</button>
          )) : <p className="option-group">A backup is created before each overwrite.</p>}
        </div>
      </aside>
      <section className="editor-pane">
        <div className="editor-toolbar">
          <div><h1>{activeFile}</h1><p className="option-group">{status?.configDir ?? ''}/{activeFile}</p></div>
          <SaveActions after={refreshBackups}>
            <Button onClick={() => setFilesMode(filesMode === 'source' ? 'diff' : 'source')}>{filesMode === 'source' ? 'Show diff' : 'Edit source'}</Button>
          </SaveActions>
        </div>
        {filesMode === 'source'
          ? <textarea className="textarea source-editor" spellCheck={false} value={source} onChange={(event) => replaceSource(event.target.value)} />
          : <pre className="diff">{diffLines(original, source).map((part, index) => <span key={index} className={part.added ? 'diff-add' : part.removed ? 'diff-remove' : 'diff-same'}>{part.value}</span>)}</pre>}
        <div className="card card-pad" style={{ marginTop: 14 }}>
          <h2>Lossless editor</h2>
          <p className="card-desc">Comments, unknown future directives, includes, ordering and repeated values survive every visual edit. Supported companion files include actions, SSH, diff, sessions, themes, shaders, pipelines, tab bars, notifications and paste hooks.</p>
        </div>
      </section>
    </div>
  )
}

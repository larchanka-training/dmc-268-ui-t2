import { useRepositoryRulesPreview } from '@/entities/repository-settings'
import { Button } from '@/shared/ui/button'

export function RulesPreview({ repositoryId }: { repositoryId: string }) {
  const query = useRepositoryRulesPreview(repositoryId)
  const preview = query.data
  return (
    <section aria-label="Current file criteria" className="space-y-3 rounded-md border border-border p-4">
      <h2 className="text-lg font-semibold">Current file criteria</h2>
      <p className="text-sm text-muted-foreground">
        Preview of the current default branch. Existing reviews keep their saved context.
      </p>
      <Button
        type="button"
        variant="outline"
        disabled={query.isFetching}
        onClick={() => {
          void query.refetch()
        }}
      >
        Refresh file criteria
      </Button>
      {query.isPending && <p role="status">Loading file criteria…</p>}
      {query.isFetching && !query.isPending && <p role="status">Refreshing file criteria…</p>}
      {query.isError && <p role="alert">Could not load file criteria. Check repository access or refresh to retry.</p>}
      {!query.isError && preview && (
        <>
          <dl className="grid gap-2 text-sm">
            <div>
              <dt className="text-muted-foreground">Default branch</dt>
              <dd className="break-all">{preview.default_branch}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Root file</dt>
              <dd>{preview.provenance.path}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Resolved commit SHA</dt>
              <dd className="break-all font-mono">{preview.provenance.revision}</dd>
            </div>
          </dl>
          {preview.provenance.state === 'absent' && <p>Root rules file is absent.</p>}
          {preview.provenance.state === 'empty' && <p>Root rules file is empty.</p>}
          {preview.provenance.state === 'invalid' && <p>Root rules file is invalid. No file criteria are applied.</p>}
          {preview.provenance.diagnostics.length > 0 && (
            <ul aria-label="File diagnostics">
              {preview.provenance.diagnostics.map((code) => (
                <li key={code}>{code}</li>
              ))}
            </ul>
          )}
          <ul className="space-y-2">
            {preview.instructions.map((instruction, index) => (
              <li className="whitespace-pre-wrap break-words rounded-md bg-muted p-3 text-sm" key={index}>
                {instruction}
              </li>
            ))}
          </ul>
          <details className="text-sm">
            <summary>Source provenance</summary>
            <dl className="mt-2 grid gap-2 break-all">
              <div>
                <dt>Blob SHA</dt>
                <dd>{preview.provenance.blob_sha ?? 'Unavailable'}</dd>
              </div>
              <div>
                <dt>Content digest</dt>
                <dd>{preview.provenance.content_digest ?? 'Unavailable'}</dd>
              </div>
              <div>
                <dt>Parser</dt>
                <dd>{preview.provenance.parser_version}</dd>
              </div>
            </dl>
          </details>
        </>
      )}
    </section>
  )
}

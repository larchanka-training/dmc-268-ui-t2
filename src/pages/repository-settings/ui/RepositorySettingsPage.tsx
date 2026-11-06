import { Link, useParams } from 'react-router-dom'
import { SettingsHttpError, useRepositorySettings } from '@/entities/repository-settings'
import { useMeQuery } from '@/entities/session'
import { SettingsEditor } from './SettingsEditor'
import { RulesPreview } from './RulesPreview'
import { Button } from '@/shared/ui/button'

export function RepositorySettingsPage() {
  const { repositoryId = '' } = useParams()
  const query = useRepositorySettings(repositoryId)
  const userId = useMeQuery().data?.user.id
  const legacy = query.error instanceof SettingsHttpError && query.error.code === 'LEGACY_SETTINGS_UNSUPPORTED'
  const unsupportedLanguage = query.data && query.data.settings.output_language !== 'ru'
  const refused = query.error instanceof SettingsHttpError && [401, 403, 404, 409].includes(query.error.status)
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Rules &amp; settings</h1>
      <div className="flex flex-wrap gap-4 text-primary underline">
        <Link to="/repos">Repositories</Link>
        <Link to={`/audit?repository=${encodeURIComponent(repositoryId)}`}>Review history</Link>
      </div>
      <RulesPreview repositoryId={repositoryId} />
      {query.isPending && <p role="status">Loading repository settings…</p>}
      {query.isError && (
        <p role="alert">
          {query.error instanceof SettingsHttpError && query.error.status === 403
            ? 'Administrator access is required to edit preferences. File preview and review history remain available when you have read access.'
            : legacy
              ? 'Unsupported legacy settings. An administrator must create a supported canonical settings version, then refresh. Existing reviews remain unchanged.'
              : 'Could not load repository settings.'}
        </p>
      )}
      {!query.isError && unsupportedLanguage && (
        <p role="alert">
          This historical output language cannot be preserved by the current settings form. An administrator must create
          a supported canonical settings version, then refresh. No values have been changed.
        </p>
      )}
      {(query.isError || unsupportedLanguage) && (
        <Button
          type="button"
          variant="outline"
          disabled={query.isFetching}
          onClick={() => {
            void query.refetch()
          }}
        >
          Refresh settings
        </Button>
      )}
      {!refused && !unsupportedLanguage && query.data && (
        <SettingsEditor
          key={`${userId}:${repositoryId}`}
          repositoryId={repositoryId}
          initial={query.data}
          reload={async () => {
            const result = await query.refetch({ throwOnError: true })
            if (!result.data) throw new Error('Settings are unavailable')
            return result.data
          }}
        />
      )}
    </div>
  )
}

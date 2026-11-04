import { useEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  replaceRepositorySettings,
  repositorySettingsKey,
  SettingsHttpError,
  type SettingsSnapshot,
  type Severity,
} from '@/entities/repository-settings'
import { meQueryKey, useMeQuery, type Me } from '@/entities/session'
import { Button } from '@/shared/ui/button'

export function SettingsEditor({
  repositoryId,
  initial,
  reload,
}: {
  repositoryId: string
  initial: SettingsSnapshot
  reload: () => Promise<SettingsSnapshot>
}) {
  const me = useMeQuery().data
  const client = useQueryClient()
  const key = repositorySettingsKey(me?.user.id, repositoryId)
  const observedQuery = useRef(client.getQueryCache().find({ queryKey: key, exact: true })).current
  const live = useRef(false)
  useEffect(() => {
    live.current = true
    return () => {
      live.current = false
    }
  }, [])
  const currentScope = () =>
    live.current &&
    client.getQueryData<Me>(meQueryKey)?.user.id === me?.user.id &&
    client.getQueryCache().find({ queryKey: key, exact: true }) === observedQuery &&
    (observedQuery?.getObserversCount() ?? 0) > 0
  const [baseline, setBaseline] = useState(initial)
  const [automatic, setAutomatic] = useState(initial.settings.auto_review_enabled)
  const [branches, setBranches] = useState(initial.settings.base_branches.join('\n'))
  const [severity, setSeverity] = useState(initial.settings.minimum_severity)
  const dirty =
    automatic !== baseline.settings.auto_review_enabled ||
    severity !== baseline.settings.minimum_severity ||
    branches
      .split('\n')
      .filter((branch) => branch !== '')
      .join('\n') !== baseline.settings.base_branches.join('\n')
  const mutation = useMutation({
    retry: false,
    mutationFn: () =>
      replaceRepositorySettings(
        repositoryId,
        baseline,
        {
          auto_review_enabled: automatic,
          base_branches: branches.split('\n').filter((branch) => branch !== ''),
          minimum_severity: severity,
        },
        me!.csrfToken,
      ),
    onSuccess: async (saved) => {
      const denied = () =>
        client
          .getQueryCache()
          .findAll({ queryKey: ['repository-settings', me?.user.id, repositoryId] })
          .some(
            (entry) =>
              entry.state.error instanceof SettingsHttpError && [401, 403, 404].includes(entry.state.error.status),
          )
      if (!currentScope() || denied()) return
      await client.cancelQueries({ queryKey: key, exact: true })
      if (!currentScope() || denied()) return
      client.setQueryData(key, saved)
      setBaseline(saved)
    },
    onError: async (error) => {
      if (error instanceof SettingsHttpError && error.status === 401 && currentScope())
        await client.resetQueries({ queryKey: meQueryKey })
      if (error instanceof SettingsHttpError && error.status === 403) {
        if (!currentScope()) return
        const scope = { queryKey: key, exact: true }
        await client.cancelQueries(scope, { revert: false })
        if (!currentScope()) return
        client.getQueryCache().find(scope)?.setState({
          data: undefined,
          dataUpdatedAt: 0,
          error,
          errorUpdatedAt: Date.now(),
          status: 'error',
          fetchStatus: 'idle',
        })
      }
    },
  })
  const reloading = useMutation({
    mutationFn: reload,
    retry: false,
    onSuccess: (saved) => {
      setBaseline(saved)
      setAutomatic(saved.settings.auto_review_enabled)
      setBranches(saved.settings.base_branches.join('\n'))
      setSeverity(saved.settings.minimum_severity)
      mutation.reset()
    },
  })
  return (
    <form
      className="grid max-w-xl gap-4"
      onSubmit={(event) => {
        event.preventDefault()
        if (!mutation.isPending) mutation.mutate()
      }}
    >
      <h2 className="text-lg font-semibold">Review preferences</h2>
      <fieldset className="grid gap-4" disabled={mutation.isPending || reloading.isPending}>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            aria-describedby="automatic-review-help"
            checked={automatic}
            onChange={(event) => setAutomatic(event.target.checked)}
          />
          Automatic reviews
        </label>
        <p id="automatic-review-help" className="text-sm text-muted-foreground">
          Applies to new pull requests and updates. Manual reviews remain available.
        </p>
        <label className="grid gap-1">
          Base branches
          <textarea
            className="rounded-md border border-border bg-background p-2"
            rows={4}
            aria-describedby="base-branches-help"
            value={branches}
            onChange={(event) => setBranches(event.target.value)}
          />
        </label>
        <p id="base-branches-help" className="text-sm text-muted-foreground">
          One exact branch name per line. Empty allows all base branches; no patterns. Up to 128 names, 1024 UTF-8 bytes
          per name.
        </p>
        <label className="grid gap-1">
          Publication minimum severity
          <select
            className="rounded-md border border-border bg-background p-2"
            aria-describedby="publication-severity-help"
            value={severity}
            onChange={(event) => setSeverity(event.target.value as Severity)}
          >
            <option value="low">All findings</option>
            <option value="medium">Medium and above</option>
            <option value="high">High and above</option>
            <option value="critical">Critical only</option>
          </select>
        </label>
        <p id="publication-severity-help" className="text-sm text-muted-foreground">
          Controls published comments. All saved findings remain in review history.
        </p>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? 'Saving preferences…' : 'Save preferences'}
        </Button>
      </fieldset>
      {mutation.isPending && <p role="status">Saving preferences…</p>}
      {dirty && !mutation.isPending && <p role="status">Unsaved changes</p>}
      {mutation.isSuccess && !dirty && (
        <p role="status" aria-label="Settings saved">
          Settings saved: {baseline.settings.version}
        </p>
      )}
      {mutation.isError && (
        <p role="alert">
          {mutation.error instanceof SettingsHttpError && mutation.error.code === 'SETTINGS_VERSION_CONFLICT'
            ? 'Settings changed on the server. Your edits are preserved. Reload current settings before retrying.'
            : mutation.error instanceof SettingsHttpError && mutation.error.status === 422
              ? 'Use exact Git branch names: up to 128 names and 1024 UTF-8 bytes per name, without patterns. Check preference values and save again. Your edits are preserved.'
              : 'Could not save preferences. Your edits are preserved.'}
        </p>
      )}
      <Button
        type="button"
        variant="outline"
        className="h-auto min-h-9 whitespace-normal py-2"
        disabled={mutation.isPending || reloading.isPending}
        onClick={() => reloading.mutate()}
      >
        Reload current settings and discard edits
      </Button>
      {reloading.isPending && <p role="status">Reloading current settings…</p>}
      {reloading.isError && <p role="alert">Could not reload settings. Your edits are preserved.</p>}
    </form>
  )
}

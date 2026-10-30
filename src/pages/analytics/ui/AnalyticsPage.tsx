import { useState } from 'react'
import { Link } from 'react-router-dom'
import { QuotaPanel } from './QuotaPanel'
import { useAnalytics, type Analytics } from '@/entities/repository-insights'
import { InsightsFilters, useInsightsSelection } from '@/widgets/insights-filters'

const categories = [
  { key: 'security', label: 'Security', color: '#dc2626' },
  { key: 'correctness', label: 'Bug (correctness)', color: '#2563eb' },
  { key: 'performance', label: 'Performance', color: '#7c3aed' },
  { key: 'maintainability', label: 'Maintainability', color: '#0f766e' },
] as const

function AnalyticsResults({ data }: { data: Analytics }) {
  const [hidden, setHidden] = useState<string[]>([])
  const maximum = Math.max(1, ...data.findings_by_day.flatMap((day) => categories.map(({ key }) => day[key])))
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-border p-4">
          <p className="text-sm text-muted-foreground">Review runs</p>
          <p className="text-3xl font-semibold">{data.totals.reviews}</p>
        </div>
        <div className="rounded-lg border border-border p-4">
          <p className="text-sm text-muted-foreground">Findings</p>
          <p className="text-3xl font-semibold">{data.totals.findings}</p>
        </div>
        <div className="rounded-lg border border-border p-4">
          <p className="text-sm text-muted-foreground">Average analysis duration</p>
          <p className="text-3xl font-semibold">
            {data.average_duration_ms === null ? 'Not available' : `${(data.average_duration_ms / 1000).toFixed(1)} s`}
          </p>
          <p className="text-xs text-muted-foreground">
            {data.duration_sample_count} completed or partial reviews; queue time excluded.
          </p>
        </div>
      </div>
      <section className="space-y-4 rounded-lg border border-border p-4">
        {data.totals.reviews === 0 && <p>No reviews in this period.</p>}
        <h2 className="font-semibold">Findings over time</h2>
        <p className="text-sm text-muted-foreground">
          {data.period.date_from} – {data.period.date_to} · UTC · Findings counted per review run.
        </p>
        <svg viewBox="0 0 700 235" className="max-h-64 w-full" role="img" aria-label="Daily findings by category">
          <text x="0" y="20" fontSize="12" fill="currentColor">
            {maximum}
          </text>
          <text x="0" y="200" fontSize="12" fill="currentColor">
            0
          </text>
          <line x1="30" y1="200" x2="680" y2="200" stroke="currentColor" opacity="0.3" />
          {categories
            .filter(({ key }) => !hidden.includes(key))
            .map(({ key, color, label }) => (
              <g key={key} aria-label={`${label} trend`}>
                <polyline
                  fill="none"
                  stroke={color}
                  strokeWidth="3"
                  points={data.findings_by_day
                    .map(
                      (day, index) =>
                        `${30 + (index * 650) / Math.max(1, data.findings_by_day.length - 1)},${200 - (day[key] * 180) / maximum}`,
                    )
                    .join(' ')}
                />
                {data.findings_by_day.map((day, index) => (
                  <circle
                    key={day.date}
                    cx={30 + (index * 650) / Math.max(1, data.findings_by_day.length - 1)}
                    cy={200 - (day[key] * 180) / maximum}
                    r={3}
                    fill={color}
                  >
                    <title>
                      {day.date}: {label} {day[key]}
                    </title>
                  </circle>
                ))}
              </g>
            ))}
          <text x="30" y="225" fontSize="11" fill="currentColor">
            {data.period.date_from}
          </text>
          <text x="680" y="225" textAnchor="end" fontSize="11" fill="currentColor">
            {data.period.date_to}
          </text>
        </svg>
        <ul className="flex flex-wrap gap-4 text-sm">
          {categories.map(({ key, label, color }) => (
            <li key={key}>
              <button
                type="button"
                className="rounded border border-border px-2 py-1 focus-visible:outline focus-visible:outline-2"
                aria-pressed={!hidden.includes(key)}
                onClick={() =>
                  setHidden((current) =>
                    current.includes(key) ? current.filter((value) => value !== key) : [...current, key],
                  )
                }
              >
                <span
                  aria-hidden="true"
                  style={{ backgroundColor: color }}
                  className="mr-2 inline-block h-2 w-2 rounded-full"
                />
                {label}
              </button>
            </li>
          ))}
        </ul>
        <div className="max-h-72 overflow-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Daily findings, UTC</caption>
            <thead>
              <tr>
                <th className="p-2">Date</th>
                {categories.map(({ key, label }) => (
                  <th className="p-2" key={key}>
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.findings_by_day.map((day) => (
                <tr className="border-t border-border" key={day.date}>
                  <th className="p-2 font-normal">{day.date}</th>
                  {categories.map(({ key }) => (
                    <td className="p-2" key={key}>
                      {day[key]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}

export function AnalyticsPage() {
  const { repositoryId, days } = useInsightsSelection()
  const query = useAnalytics(repositoryId, days)
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Repository analytics</h1>
      <InsightsFilters />
      {!repositoryId && <p className="text-sm text-muted-foreground">Select a repository to view analytics.</p>}
      {repositoryId && (
        <Link
          className="inline-block text-sm text-primary underline"
          to={`/audit?${new URLSearchParams({ repository: repositoryId, days: String(days) })}`}
        >
          View audit log
        </Link>
      )}
      {repositoryId && <QuotaPanel repositoryId={repositoryId} />}
      {repositoryId && query.isPending && <p role="status">Loading analytics…</p>}
      {query.isError ? (
        <p role="alert" className="text-destructive">
          {query.error.message}
        </p>
      ) : (
        query.data && <AnalyticsResults data={query.data} />
      )}
    </div>
  )
}

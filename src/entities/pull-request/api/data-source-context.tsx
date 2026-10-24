import { createContext, useContext, type PropsWithChildren } from 'react'
import type { PullRequestDataSource } from '@/entities/pull-request/api/data-source'

const DataSourceContext = createContext<PullRequestDataSource | null>(null)

export interface DataSourceProviderProps extends PropsWithChildren {
  dataSource: PullRequestDataSource
}

export function DataSourceProvider({ dataSource, children }: DataSourceProviderProps) {
  return <DataSourceContext.Provider value={dataSource}>{children}</DataSourceContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useDataSource(): PullRequestDataSource {
  const dataSource = useContext(DataSourceContext)
  if (!dataSource) throw new Error('useDataSource must be used inside <DataSourceProvider>')
  return dataSource
}

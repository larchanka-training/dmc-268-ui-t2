import { RouterProvider } from 'react-router/dom'
import { createDataSource } from '@/app/providers/create-data-source'
import { QueryProvider } from '@/app/providers/QueryProvider'
import { SessionLifecycle } from '@/app/providers/SessionLifecycle'
import { router } from '@/app/router'
import { DataSourceProvider } from '@/entities/pull-request'

const dataSource = createDataSource()

export function App() {
  return (
    <QueryProvider>
      <SessionLifecycle>
        <DataSourceProvider dataSource={dataSource}>
          <RouterProvider router={router} />
        </DataSourceProvider>
      </SessionLifecycle>
    </QueryProvider>
  )
}

export default App

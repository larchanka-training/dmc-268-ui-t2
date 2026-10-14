import { RouterProvider } from 'react-router/dom'
import { createDataSource } from '@/app/providers/create-data-source'
import { QueryProvider } from '@/app/providers/QueryProvider'
import { router } from '@/app/router'
import { DataSourceProvider } from '@/entities/pull-request'

const dataSource = createDataSource()

export function App() {
  return (
    <QueryProvider>
      <DataSourceProvider dataSource={dataSource}>
        <RouterProvider router={router} />
      </DataSourceProvider>
    </QueryProvider>
  )
}

export default App

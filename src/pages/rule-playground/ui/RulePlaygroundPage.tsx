import { useParams } from 'react-router-dom'
import { useMeQuery } from '@/entities/session'
import { RulePlayground } from '@/features/simulate-rules'

export function RulePlaygroundPage() {
  const { repositoryId = '' } = useParams()
  const userId = useMeQuery().data?.user.id
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Rule Playground</h1>
      <RulePlayground key={`${userId}:${repositoryId}`} repositoryId={repositoryId} />
    </div>
  )
}

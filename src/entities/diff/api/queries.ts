import { useQuery } from '@tanstack/react-query'
import { fetchMockContext, fetchMockDiff } from '@/entities/diff/api/mock-data'

export function useDiffQuery(mrId: string) {
  return useQuery({
    queryKey: ['merge-request', mrId, 'diff'],
    queryFn: () => fetchMockDiff(mrId),
  })
}

export function useDiffContextQuery(
  filePath: string,
  hunkId: string,
  direction: 'before' | 'after',
  startLine: number,
  lineCount: number,
  enabled: boolean,
) {
  return useQuery({
    queryKey: ['merge-request', 'diff', filePath, hunkId, 'context', direction, startLine, lineCount],
    queryFn: () => fetchMockContext(startLine, lineCount),
    enabled,
  })
}

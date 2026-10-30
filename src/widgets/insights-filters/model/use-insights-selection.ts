import { useSearchParams } from 'react-router-dom'

export function useInsightsSelection() {
  const [params, setParams] = useSearchParams()
  const days = ['7', '30', '90'].includes(params.get('days') ?? '') ? Number(params.get('days')) : 30
  const repositoryId = params.get('repository') ?? ''
  function select(key: string, value: string) {
    const next = new URLSearchParams(params)
    next.set(key, value)
    next.delete('cursor')
    setParams(next)
  }
  return { repositoryId, days, select }
}

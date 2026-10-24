export function fetchMockContext(startLine: number, lineCount: number): Promise<DiffLineStub[]> {
  const lines: DiffLineStub[] = Array.from({ length: lineCount }, (_, index) => ({
    id: `ctx-${startLine + index}`,
    type: 'context',
    oldLineNumber: startLine + index,
    newLineNumber: startLine + index,
    content: `  // context line ${startLine + index}`,
  }))
  return new Promise((resolve) => setTimeout(() => resolve(lines), 200))
}

type DiffLineStub = {
  id: string
  type: 'context'
  oldLineNumber: number
  newLineNumber: number
  content: string
}

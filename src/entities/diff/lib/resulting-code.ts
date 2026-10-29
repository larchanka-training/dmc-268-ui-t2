import type { DiffFile } from '@/entities/diff/model/types'

/** Код «после» применения diff: context + add строки без маркеров. */
export function resultingCode(files: readonly DiffFile[]): string {
  return files
    .flatMap((file) => file.hunks)
    .flatMap((hunk) => hunk.lines)
    .filter((line) => line.type !== 'del')
    .map((line) => line.content)
    .join('\n')
}

export interface GapRowProps {
  rows: number
  colSpan: number
  onOpen: () => void
}

export function GapRow({ rows, colSpan, onOpen }: GapRowProps) {
  return (
    <tr>
      <td colSpan={colSpan} className="border-y border-border bg-muted/40 px-3 py-1">
        <button
          type="button"
          onClick={onOpen}
          className="text-xs text-muted-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {rows} строк без замечаний
        </button>
      </td>
    </tr>
  )
}

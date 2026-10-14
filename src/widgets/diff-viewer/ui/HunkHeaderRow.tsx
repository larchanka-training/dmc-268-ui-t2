export function HunkHeaderRow({ header, colSpan }: { header: string; colSpan: number }) {
  return (
    <tr data-testid="hunk-header">
      <td colSpan={colSpan} className="bg-muted px-2 py-0.5 text-xs text-muted-foreground">
        {header}
      </td>
    </tr>
  )
}

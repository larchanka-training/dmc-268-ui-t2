import { Info, OctagonAlert, TriangleAlert, type LucideIcon } from 'lucide-react'
import type { Severity } from '@/entities/review-comment/model/types'

export const SEVERITY_ICON: Record<Severity, LucideIcon> = {
  critical: OctagonAlert,
  warning: TriangleAlert,
  info: Info,
}

/** Цвет — только усиление: смысл всегда несут иконка и текстовая метка. */
export const SEVERITY_TONE: Record<Severity, string> = {
  critical: 'border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200',
  warning: 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200',
  info: 'border-sky-300 bg-sky-50 text-sky-900 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-200',
}

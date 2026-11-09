import type { PublicationStatus, ReviewStatus } from '@/entities/pull-request'

export const STATUS_LABEL: Record<ReviewStatus, string> = {
  QUEUED: 'В очереди',
  FETCHING_DIFF: 'Загрузка диффа',
  PARSING_CONTEXT: 'Сбор контекста',
  LLM_PROCESSING: 'Анализ моделью',
  COMPLETED: 'Ревью завершено',
  PARTIAL: 'Ревью частичное',
  FAILED: 'Ревью не удалось',
  SKIPPED: 'Ревью пропущено',
}

export const PUBLICATION_LABEL: Record<PublicationStatus, string> = {
  NOT_READY: 'Не опубликовано',
  PENDING: 'Публикуется',
  PUBLISHED: 'Опубликовано',
  PARTIAL: 'Опубликовано частично',
  FAILED: 'Публикация не удалась',
  UNKNOWN: 'Публикация: статус неизвестен',
  SKIPPED: 'Публикация пропущена',
}

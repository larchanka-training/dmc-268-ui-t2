/** Ошибка, повтор запроса после которой бессмыслен (404 и т.п.). */
export class NonRetryableError extends Error {}

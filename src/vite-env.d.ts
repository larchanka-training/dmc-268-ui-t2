/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** `mock` (по умолчанию) или `api` */
  readonly VITE_DATA_SOURCE?: 'mock' | 'api'
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

export type { MeUser, VcsProvider } from '@/entities/session/model/types'
export {
  API_V1,
  AUTH_GITHUB_START_PATH,
  AUTH_GITHUB_CALLBACK_PATH,
  AUTH_LOGOUT_PATH,
  ME_PATH,
} from '@/entities/session/model/paths'
export {
  fetchMe,
  logoutSession,
  startGithubOAuth,
  rememberReturnUrl,
  consumeReturnUrl,
  SessionHttpError,
} from '@/entities/session/api/session-client'
export { meQueryKey, useMeQuery } from '@/entities/session/api/queries'

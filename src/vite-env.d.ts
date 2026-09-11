/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_USE_DOCKER_BACKEND: string
  readonly VITE_DEV_MODE: string
  readonly VITE_REMOTE_API_BASE_URL: string
  readonly VITE_ENTITLEMENT_PUBLIC_KEY: string
  // more env variables...
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

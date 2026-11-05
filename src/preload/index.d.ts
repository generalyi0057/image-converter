import type { ImageConverterApi } from '../shared/types'

declare global {
  interface Window {
    api: ImageConverterApi
  }
}

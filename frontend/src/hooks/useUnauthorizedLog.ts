import { useEffect, useRef } from 'react'
import api from '../lib/api'

export function useUnauthorizedLog(isAllowed: boolean, url: string) {
  const logged = useRef(false)

  useEffect(() => {
    if (!isAllowed && !logged.current) {
      logged.current = true
      api.post('/audit-logs/unauthorized/', { url }).catch(() => undefined)
    }
  }, [isAllowed, url])
}

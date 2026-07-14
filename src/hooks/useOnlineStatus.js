import { useState, useEffect } from 'react'

// Tracks the browser's connectivity. Seeds from navigator.onLine and updates on
// the window online/offline events. Used mid-workout to warn the lifter when a
// save can't reach the server and to retry pending saves once we reconnect.
export function useOnlineStatus() {
  const [online, setOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine
  )

  useEffect(() => {
    const goOnline = () => setOnline(true)
    const goOffline = () => setOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  return online
}

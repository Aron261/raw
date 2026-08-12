import { useState, useRef, useEffect, useCallback } from 'react'

// Undoable delete with a grace window. The item is hidden optimistically and
// the real delete (`commit`) only runs once the window elapses, so "Deshacer"
// is a pure local cancel — no DB round-trip. Shared by any surface that deletes
// a list item (dashboard goals, nutrition entries, …) so the pattern stays
// identical everywhere.
//
//   const del = useUndoableDelete(item => deleteThing(item.id))
//   list.filter(x => x.id !== del.pending?.id)         // hide the pending one
//   del.request(item, { deletedMsg, restoredMsg })     // start the window
//   <LiveRegion>{del.liveMsg}</LiveRegion>
//   <UndoSnackbar show={!!del.pending} ... onUndo={del.undo} />
export function useUndoableDelete(commit, { delay = 5000, onError } = {}) {
  const [pending, setPending] = useState(null) // the whole item awaiting delete
  const [liveMsg, setLiveMsg] = useState('')   // screen-reader announcement
  const timer = useRef(null)
  const restoreRef = useRef('')
  const pendingRef = useRef(null)               // mirror for unmount cleanup
  const commitRef = useRef(commit)
  commitRef.current = commit

  const clearTimer = () => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null }
  }

  const setPendingBoth = (item) => { pendingRef.current = item; setPending(item) }

  const onErrorRef = useRef(onError)
  onErrorRef.current = onError

  const commitNow = useCallback((item) => {
    clearTimer()
    setPendingBoth(null)
    // Un commit fallido resucita el elemento en el siguiente refetch: sin
    // onError, esa resurrección parece un bug de datos en vez de un borrado
    // que no llegó al servidor.
    Promise.resolve(commitRef.current(item)).catch((err) => { onErrorRef.current?.(err, item) })
  }, [])

  const request = useCallback((item, { deletedMsg = '', restoredMsg = '' } = {}) => {
    if (pendingRef.current) commitNow(pendingRef.current) // flush a prior pending
    setPendingBoth(item)
    restoreRef.current = restoredMsg
    if (deletedMsg) setLiveMsg(deletedMsg)
    clearTimer()
    timer.current = setTimeout(() => commitNow(item), delay)
  }, [commitNow, delay])

  const undo = useCallback(() => {
    clearTimer()
    setPendingBoth(null)
    if (restoreRef.current) setLiveMsg(restoreRef.current)
  }, [])

  // On unmount, honor the delete the user already requested (commit, don't
  // cancel) so navigating away mid-window doesn't silently keep the item.
  useEffect(() => () => {
    clearTimer()
    if (pendingRef.current) {
      Promise.resolve(commitRef.current(pendingRef.current)).catch(() => {})
      pendingRef.current = null
    }
  }, [])

  return { pending, liveMsg, setLiveMsg, request, undo }
}

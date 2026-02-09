import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

interface RealtimeState {
  isConnected: boolean
  lastEventAt: number | null
  error: string | null
  reconnectAttempts: number
  setConnected: (connected: boolean) => void
  setLastEventAt: (timestamp: number | null) => void
  setError: (error: string | null) => void
  setReconnectAttempts: (attempts: number) => void
}

export const useRealtimeStore = create<RealtimeState>()(
  devtools(
    (set) => ({
      isConnected: false,
      lastEventAt: null,
      error: null,
      reconnectAttempts: 0,
      setConnected: (connected) => set({ isConnected: connected }, false, 'setConnected'),
      setLastEventAt: (timestamp) =>
        set({ lastEventAt: timestamp }, false, 'setLastEventAt'),
      setError: (error) => set({ error }, false, 'setError'),
      setReconnectAttempts: (attempts) =>
        set({ reconnectAttempts: attempts }, false, 'setReconnectAttempts'),
    }),
    { name: 'RealtimeStore' }
  )
)

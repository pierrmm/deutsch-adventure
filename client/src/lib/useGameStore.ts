import { create } from 'zustand'
import type { QuizQuestion } from '../data/germanQuizBank'

export type GameRole = 'host' | 'player'
export type PlayerScreen = 1 | 2 | 3 | 4 | 5
export interface GamePlayer { id: string; name: string; character: string; score: number; coins: number; lives: number }
export interface GameToast { id: string; message: string; type: 'success' | 'error' | 'info'; createdAt: number }
interface GameStore {
  role: GameRole | null
  playerScreen: PlayerScreen
  players: GamePlayer[]
  activeQuestion: QuizQuestion | null
  roomId: string
  gameStatus: 'lobby' | 'playing' | 'paused' | 'ended'
  remainingSeconds: number
  category: string
  setRoomId: (roomId: string) => void
  setGameStatus: (gameStatus: GameStore['gameStatus']) => void
  setRemainingSeconds: (remainingSeconds: number) => void
  setCategory: (category: string) => void
  toasts: GameToast[]
  setRole: (role: GameRole | null) => void
  setPlayerScreen: (screen: PlayerScreen) => void
  setPlayers: (players: GamePlayer[]) => void
  upsertPlayer: (player: GamePlayer) => void
  removePlayer: (id: string) => void
  setActiveQuestion: (question: QuizQuestion | null) => void
  addToast: (toast: Omit<GameToast, 'id' | 'createdAt'>) => void
  removeToast: (id: string) => void
  reset: () => void
}
const initialState: Pick<GameStore, 'role' | 'playerScreen' | 'players' | 'activeQuestion' | 'roomId' | 'gameStatus' | 'remainingSeconds' | 'category' | 'toasts'> = { role: null, playerScreen: 1, players: [], activeQuestion: null, roomId: '', gameStatus: 'lobby', remainingSeconds: 600, category: 'Alle Kategorien', toasts: [] }

export const useGameStore = create<GameStore>((set) => ({
  ...initialState,
  setRole: (role) => set({ role }),
  setRoomId: (roomId) => set({ roomId }),
  setGameStatus: (gameStatus) => set({ gameStatus }),
  setRemainingSeconds: (remainingSeconds) => set({ remainingSeconds }),
  setCategory: (category) => set({ category }),
  setPlayerScreen: (playerScreen) => set({ playerScreen }),
  setPlayers: (players) => set({ players }),
  upsertPlayer: (player) => set((state) => ({ players: state.players.some(({ id }) => id === player.id) ? state.players.map((item) => item.id === player.id ? player : item) : [...state.players, player] })),
  removePlayer: (id) => set((state) => ({ players: state.players.filter((player) => player.id !== id) })),
  setActiveQuestion: (activeQuestion) => set({ activeQuestion }),
  addToast: (toast) => set((state) => ({ toasts: [...state.toasts, { ...toast, id: crypto.randomUUID(), createdAt: Date.now() }] })),
  removeToast: (id) => set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),
  reset: () => set(initialState),
}))

export const selectLeaderboard = (state: GameStore) => [...state.players].sort((a, b) => b.score - a.score)
  .slice(0, 5)
export type { GameStore }

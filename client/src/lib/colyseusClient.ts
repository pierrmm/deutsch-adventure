import { Client, type Room } from '@colyseus/sdk'
import { allQuizQuestions, type QuizCategory } from '../data/germanQuizBank'
import { useGameStore, type GamePlayer } from './useGameStore'

export interface SyncedPlayer extends GamePlayer { x: number; y: number; direction: number; animation: string }
export const defaultColyseusEndpoint = () => `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.hostname}:${location.port || (location.protocol === 'https:' ? 443 : 80)}`
export const publicColyseusEndpoint = (host = location.hostname, port = location.port === '5173' ? '5173' : '2567') => `${location.protocol === 'https:' ? 'wss' : 'ws'}://${host}:${port}`
type WirePlayer = Omit<SyncedPlayer, 'id'>
interface RoomState { players?: Map<string, WirePlayer> | Record<string, WirePlayer> | null; status?: string; remainingSeconds?: number; category?: string; roomCode?: string }
const entries = <T>(value?: Map<string, T> | Record<string, T> | null): [string, T][] => {
  if (!value || typeof value !== 'object') return []
  const mapEntries = (value as { entries?: () => IterableIterator<[string, T]> }).entries
  if (typeof mapEntries === 'function') return [...mapEntries.call(value)]
  return Object.entries(value)
}
export const playersFromState = (state?: RoomState | null): GamePlayer[] => entries(state?.players).map(([id,p]) => ({ id, name:p.name, character:p.character, score:p.score, coins:p.coins, lives:p.lives }))
export type GameRoom = Room<RoomState>
export const connectPlayerRoom = async (endpoint: string, roomCode: string, name: string, character: string): Promise<GameRoom> => {
  let sdk = client ?? (client = new Client(endpoint))
  const normalized = roomCode.trim().toUpperCase()
  if (!/^[A-Z0-9]{4}$/.test(normalized)) throw new Error('Kode room harus 4 karakter.')

  try {
    let targetId = normalized
    try {
      const response = await sdk.http.get<{ roomId: string }>(`/api/rooms/${encodeURIComponent(normalized)}`)
      if (response?.data?.roomId) targetId = response.data.roomId
    } catch {
      /* Fallback to direct roomCode */
    }
    const room: GameRoom = await sdk.joinById<RoomState>(targetId, { name, character, role: 'player' })
    attachRoomSync(room)
    room.send('player:select', { name, character })
    return room
  } catch (err) {
    const fallbackEndpoint = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.hostname}:2567`
    if (endpoint !== fallbackEndpoint) {
      sdk = client = new Client(fallbackEndpoint)
      const fallbackRoom: GameRoom = await sdk.joinById<RoomState>(normalized, { name, character, role: 'player' })
      attachRoomSync(fallbackRoom)
      fallbackRoom.send('player:select', { name, character })
      return fallbackRoom
    }
    throw err
  }
}

export const startHostedRoom = async (endpoint: string): Promise<GameRoom> => {
  const sdk = client ?? (client = new Client(endpoint))
  try {
    const room: GameRoom = await sdk.create<RoomState>('game', { role: 'host' })
    useGameStore.getState().setRoomId(room.roomId)
    attachRoomSync(room)
    return room
  } catch (err) {
    const fallbackEndpoint = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.hostname}:2567`
    if (endpoint !== fallbackEndpoint) {
      client = new Client(fallbackEndpoint)
      const fallbackRoom: GameRoom = await client.create<RoomState>('game', { role: 'host' })
      useGameStore.getState().setRoomId(fallbackRoom.roomId)
      attachRoomSync(fallbackRoom)
      return fallbackRoom
    }
    throw err
  }
}
function attachRoomSync(room: GameRoom) {
  const syncPlayers = () => {
    if (room.state) {
      useGameStore.getState().setPlayers(playersFromState(room.state))
    }
  }
  room.onStateChange(() => {
    syncPlayers()
    const state = room.state
    if (!state) return
    if (state.status) useGameStore.getState().setGameStatus(state.status as 'lobby' | 'playing' | 'paused' | 'ended')
    if (state.remainingSeconds !== undefined) useGameStore.getState().setRemainingSeconds(state.remainingSeconds)
    if (state.category) useGameStore.getState().setCategory(state.category)
    if (state.roomCode) useGameStore.getState().setRoomId(state.roomCode)
  })
  room.onMessage('quiz:opened', (data: { playerId: string; quizId: string; blockId?: string; question?: string; translation?: string; options?: [string, string, string, string]; difficulty?: string; category?: string; points?: number }) => {
    let question = allQuizQuestions.find((item) => item.id === data.quizId)
    if (!question && data.question && data.options) {
      question = {
        id: data.quizId,
        category: (data.category as QuizCategory) || 'Wortschatz (A1)',
        difficulty: (data.difficulty as 'A1' | 'A2' | 'B1') || 'A1',
        question: data.question,
        translation: data.translation || '',
        options: data.options,
        correctAnswer: 0,
        explanation: '',
        points: data.points || 100,
      }
    }
    if (question && data.playerId === room.sessionId) {
      useGameStore.getState().setActiveQuestion(question)
      useGameStore.getState().setPlayerScreen(4)
    }
    useGameStore.getState().addToast({
      message: `Question Block! [${data.category || 'German Quiz'}]`,
      type: 'info',
    })
  })
  room.onMessage('quiz:result', (data: { playerId: string; correct: boolean; points: number; explanation?: string; translation?: string }) => {
    useGameStore.getState().addToast({
      message: data.correct ? `Richtige Antwort! +${data.points} Punkte ✅` : 'Falsche Antwort! ❌',
      type: data.correct ? 'success' : 'error',
    })
    if (data.playerId === room.sessionId) {
      useGameStore.getState().setPlayerScreen(3)
    }
  })
  room.onLeave(() => useGameStore.getState().setPlayers([]))
  syncPlayers()
}

let client: Client | undefined
export const sendMovement = (room: GameRoom, moveX: -1 | 0 | 1, moveY: -1 | 0 | 1) => {
  const input = room.input<{ moveX: -1 | 0 | 1; moveY: -1 | 0 | 1 }>({ mode: 'reliable' })
  input.data.moveX = moveX
  input.data.moveY = moveY
  input.send()
}

export const sendQuizAnswer = (room: GameRoom, quizId: string, answer: number, blockId = '') => room.send('quiz:answer', { quizId, answer, blockId })
export const hitQuestionBlock = (room: GameRoom, quizId: string, blockId = '', blockType = 'standard') => room.send('block:hit', { quizId, blockId, blockType })
export const setRoomCategory = (room: GameRoom, category: string) => room.send('host:category', { category })
export const setRoomStatus = (room: GameRoom, status: 'start' | 'pause' | 'end', paused = false) => room.send(`host:${status}`, status === 'pause' ? { paused } : {})
export const submitRoomAnswer = (room: GameRoom, quizId: string, answer: number, blockId = '') => room.send('quiz:answer', { quizId, answer, blockId })
/* subscribed state changes keep Phaser and React on the same room snapshot */
export const syncRoomToStore = (room: GameRoom) => {
  const sync = () => useGameStore.getState().setPlayers(playersFromState(room.state))
  room.onStateChange(sync)
  room.onMessage('quiz:opened', (data) => useGameStore.getState().addToast({ message: `Question Block! ${data.quizId}`, type: 'info' }))
  room.onMessage('quiz:result', (data) => useGameStore.getState().addToast({ message: data.correct ? `Richtige Antwort! +${data.points} Punkte` : 'Falsche Antwort!', type: data.correct ? 'success' : 'error' }))
  room.onMessage('quiz:opened', (data) => { if (data.playerId === room.sessionId) useGameStore.getState().setPlayerScreen(4) })
  room.onMessage('quiz:result', (data) => { if (data.playerId === room.sessionId) useGameStore.getState().setPlayerScreen(3) })
  room.onStateChange((state) => { if (state.status === 'ended') useGameStore.getState().setPlayerScreen(5) })
  room.onLeave(() => useGameStore.getState().setPlayers([]))
  sync()
}

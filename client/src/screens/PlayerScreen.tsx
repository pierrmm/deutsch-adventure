import { useEffect, useState } from 'react'
import { allQuizQuestions, germanQuizBank } from '../data/germanQuizBank'
import { soundManager } from '../lib/soundManager'
import { connectPlayerRoom, publicColyseusEndpoint, hitQuestionBlock, sendMovement, submitRoomAnswer, type GameRoom } from '../lib/colyseusClient'
import { selectLeaderboard, useGameStore } from '../lib/useGameStore'
import { GermanFlag } from '../utils/GermanFlag'

interface CharacterOption {
  id: string
  name: string
  colorName: string
  emoji: string
  bg: string
  border: string
}

const characters: CharacterOption[] = [
  { id: 'red', name: 'Max', colorName: 'Rot (Merah)', emoji: '🧑🏻‍🚒', bg: '#ef4444', border: '#991b1b' },
  { id: 'green', name: 'Lena', colorName: 'Grün (Hijau)', emoji: '🧝🏻', bg: '#22c55e', border: '#166534' },
  { id: 'pink', name: 'Anna', colorName: 'Rosa (Pink)', emoji: '👩🏻', bg: '#ec4899', border: '#9d174d' },
  { id: 'blue', name: 'Tom', colorName: 'Blau (Biru)', emoji: '🧑🏻', bg: '#3b82f6', border: '#1e40af' },
]

export default function PlayerScreen() {
  const [room, setRoom] = useState<GameRoom>()
  const [name, setName] = useState('')
  const [roomCode, setRoomCode] = useState(() => {
    const param = new URLSearchParams(window.location.search).get('room')
    return param ? param.toUpperCase().trim() : ''
  })
  const [characterIndex, setCharacterIndex] = useState(0)
  const [answer, setAnswer] = useState<number>()
  const [quizSeconds, setQuizSeconds] = useState(15)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const screen = useGameStore((s) => s.playerScreen)
  const setScreen = useGameStore((s) => s.setPlayerScreen)
  const players = useGameStore((s) => s.players)
  const question = useGameStore((s) => s.activeQuestion)
  const status = useGameStore((s) => s.gameStatus)
  const category = useGameStore((s) => s.category)

  const me = players.find((p) => p.id === room?.sessionId)
  const selectedChar = characters[characterIndex]

  const questionPool = category === 'Alle Kategorien'
    ? allQuizQuestions
    : (germanQuizBank[category as keyof typeof germanQuizBank] ?? allQuizQuestions)
  const nextQuestion = questionPool.find((q) => q.id !== question?.id) ?? questionPool[0]

  useEffect(() => {
    if (status === 'playing' && screen === 2) setScreen(3)
    if (status === 'ended') setScreen(5)
  }, [status, screen, setScreen])

  // Countdown timer for quiz screen
  useEffect(() => {
    if (screen !== 4) return
    const timer = window.setInterval(() => {
      setQuizSeconds((n) => {
        if (n <= 1) {
          window.clearInterval(timer)
          if (room && question) {
            soundManager.play('incorrect')
            submitRoomAnswer(room, question.id, -1)
          }
          setScreen(3)
          return 0
        }
        return n - 1
      })
    }, 1000)
    return () => window.clearInterval(timer)
  }, [screen, question, room, setScreen])

  useEffect(() => () => { void room?.leave() }, [room])

  const joinGame = async () => {
    if (!name.trim() || !roomCode.trim()) return
    setError('')
    setLoading(true)
    try {
      const port = location.port === '5173' ? '5173' : '2567'
      const endpoint = import.meta.env.VITE_COLYSEUS_URL ?? publicColyseusEndpoint(location.hostname, port)
      const r = await connectPlayerRoom(endpoint, roomCode.trim().toUpperCase(), name.trim(), selectedChar.id)
      setRoom(r)
      useGameStore.getState().setRole('player')
      setScreen(2)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal bergabung ke game room.')
    } finally {
      setLoading(false)
    }
  }

  const confirmCharacter = () => {
    if (room) {
      room.send('player:select', { name: name.trim(), character: selectedChar.id })
    }
    // If game has already started on host, go straight to controller
    if (status === 'playing') {
      setScreen(3)
    }
  }

  const answerQuestion = (index: number) => {
    if (!room || !question || answer !== undefined) return
    setAnswer(index)
    const isCorrect = index === question.correctAnswer
    soundManager.play(isCorrect ? 'correct' : 'incorrect')
    submitRoomAnswer(room, question.id, index)

    window.setTimeout(() => {
      setAnswer(undefined)
      setScreen(3)
    }, 1500)
  }

  return (
    <main className="pixel-bg min-h-screen flex flex-col justify-between p-4 max-w-md mx-auto text-white select-none">
      {/* Top Header Badge */}
      <header className="text-center pt-2 pb-1">
        <div className="inline-flex items-center gap-2 bg-slate-950/80 backdrop-blur-md px-4 py-1.5 rounded-full border border-amber-400/60 shadow-md">
          <GermanFlag className="w-6 h-4 rounded-sm shadow-sm" />
          <span className="adventure-title text-lg font-black tracking-wide">Deutsch Adventure</span>
        </div>
      </header>

      {/* Screen 1: Join Game */}
      {screen === 1 && (
        <section className="sky-card p-6 md:p-8 my-auto shadow-2xl">
          <div className="text-center mb-6">
            <span className="text-5xl block mb-2 filter drop-shadow">🏰</span>
            <h2 className="text-2xl font-black text-amber-300">Gabung Game</h2>
            <p className="text-xs text-slate-300 mt-1">Masukkan nama dan kode room dari layar TV Host</p>
          </div>

          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-xs uppercase tracking-wider font-bold text-amber-300 mb-1">
                Masukkan Nama Anda
              </label>
              <input
                className="w-full rounded-xl border-2 border-slate-700 bg-slate-950/90 px-4 py-3 text-white font-bold placeholder-slate-500 focus:border-amber-400 focus:outline-none transition"
                placeholder="Contoh: Max"
                maxLength={20}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wider font-bold text-amber-300 mb-1">
                Kode Room (4 Karakter)
              </label>
              <input
                className="w-full rounded-xl border-2 border-slate-700 bg-slate-950/90 px-4 py-3 text-amber-300 font-mono font-black text-2xl tracking-[0.25em] uppercase text-center placeholder-slate-600 focus:border-amber-400 focus:outline-none transition"
                placeholder="A4B2"
                maxLength={4}
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              />
            </div>
          </div>

          {error && (
            <div role="alert" className="bg-red-950/90 border border-red-500 text-red-200 text-xs rounded-xl p-3 mb-4 text-center font-medium">
              ⚠️ {error}
            </div>
          )}

          <button
            disabled={!name.trim() || roomCode.trim().length !== 4 || loading}
            className="game-primary w-full text-lg py-3.5 shadow-[0_6px_0_#78350f]"
            onClick={joinGame}
          >
            {loading ? 'Menghubungkan…' : '🎮 GABUNG GAME'}
          </button>
        </section>
      )}

      {/* Screen 2: Choose Character */}
      {screen === 2 && (
        <section className="sky-card p-6 my-auto text-center shadow-2xl">
          <div className="inline-block bg-gradient-to-r from-amber-400 to-yellow-500 text-amber-950 px-6 py-1.5 rounded-full font-black text-lg border border-amber-800 shadow mb-6">
            PILIH KARAKTER
          </div>

          {/* Carousel */}
          <div className="flex items-center justify-between my-6 px-2">
            <button
              aria-label="Karakter sebelumnya"
              onClick={() => setCharacterIndex((i) => (i + characters.length - 1) % characters.length)}
              className="w-12 h-12 rounded-full bg-slate-800 hover:bg-slate-700 text-2xl font-bold flex items-center justify-center border-2 border-amber-400/60 shadow active:translate-y-0.5"
            >
              ◀
            </button>

            {/* Character Preview */}
            <div className="flex flex-col items-center">
              <div
                className="w-28 h-28 rounded-3xl flex items-center justify-center text-6xl shadow-inner border-4 mb-2 transition-transform transform scale-105"
                style={{ backgroundColor: selectedChar.bg, borderColor: selectedChar.border }}
              >
                {selectedChar.emoji}
              </div>
              <h3 className="text-2xl font-black text-white">{selectedChar.name}</h3>
              <p className="text-xs text-amber-300 font-semibold">{selectedChar.colorName}</p>
            </div>

            <button
              aria-label="Karakter berikutnya"
              onClick={() => setCharacterIndex((i) => (i + 1) % characters.length)}
              className="w-12 h-12 rounded-full bg-slate-800 hover:bg-slate-700 text-2xl font-bold flex items-center justify-center border-2 border-amber-400/60 shadow active:translate-y-0.5"
            >
              ▶
            </button>
          </div>

          {/* Character Row Badges */}
          <div className="flex justify-center gap-3 mb-6">
            {characters.map((c, idx) => (
              <button
                key={c.id}
                onClick={() => setCharacterIndex(idx)}
                className={`w-10 h-10 rounded-2xl flex items-center justify-center text-xl border-2 transition ${
                  idx === characterIndex ? 'border-amber-300 scale-110 shadow-lg' : 'border-slate-700 opacity-60'
                }`}
                style={{ backgroundColor: c.bg }}
              >
                {c.emoji}
              </button>
            ))}
          </div>

          <button className="game-primary w-full text-lg py-3.5 shadow-[0_6px_0_#78350f]" onClick={confirmCharacter}>
            ✨ KONFIRMASI
          </button>
          <p className="text-xs text-slate-400 mt-3 font-medium">Menunggu Host memulai game…</p>
        </section>
      )}

      {/* Screen 3: Game Controller */}
      {screen === 3 && (
        <section className="flex flex-col justify-between flex-1 gap-4 my-2">
          {/* Top HUD */}
          <div className="bg-slate-950/85 backdrop-blur-md px-4 py-2.5 rounded-2xl border-2 border-amber-400/60 flex items-center justify-between shadow-lg">
            <div className="flex items-center gap-2">
              <span className="text-2xl">{selectedChar.emoji}</span>
              <div className="flex gap-1 text-base">❤️❤️❤️</div>
            </div>
            <div className="flex items-center gap-2 bg-slate-900 px-3 py-1 rounded-xl border border-slate-700">
              <span className="text-lg">🪙</span>
              <span className="font-mono font-black text-amber-300">{me?.coins ?? 0}</span>
            </div>
          </div>

          {/* Center Mini-viewport */}
          <div className="sky-card p-4 flex-1 flex flex-col items-center justify-center text-center shadow-inner relative overflow-hidden">
            <div className="text-6xl animate-bounce mb-2">{selectedChar.emoji}</div>
            <p className="text-xs uppercase font-bold tracking-wider text-amber-300">Menjelajahi German Village</p>
            <p className="text-[11px] text-slate-400 mt-1">Gerakkan karakter di layar TV Host!</p>
            <p className="text-[10px] text-amber-200/70 mt-3 bg-slate-950/60 px-3 py-1 rounded-full">
              Kuis Aktif: {category}
            </p>
          </div>

          {/* Wooden Game Controller Console */}
          <div className="wood-panel p-4 flex items-center justify-between shadow-2xl">
            {/* D-Pad Left / Right */}
            <div className="flex items-center gap-3">
              <button
                className="control w-16 h-16 flex items-center justify-center text-3xl font-bold"
                onClick={() => room && sendMovement(room, -1, 0)}
                aria-label="Kiri"
              >
                ⬅️
              </button>
              <button
                className="control w-16 h-16 flex items-center justify-center text-3xl font-bold"
                onClick={() => room && sendMovement(room, 1, 0)}
                aria-label="Kanan"
              >
                ➡️
              </button>
            </div>

            {/* Jump & Action */}
            <div className="flex items-center gap-3">
              <button
                className="control w-16 h-16 flex items-center justify-center text-3xl font-bold"
                onClick={() => room && sendMovement(room, 0, -1)}
                aria-label="Lompat"
              >
                ⬆️
              </button>
              <button
                className="w-16 h-16 rounded-full bg-gradient-to-b from-yellow-300 to-amber-500 border-2 border-amber-800 text-3xl flex items-center justify-center shadow-[0_4px_0_#78350f] active:translate-y-1 transition"
                onClick={() => room && nextQuestion && hitQuestionBlock(room, nextQuestion.id)}
                aria-label="Question Block"
                title="Tanya Soal"
              >
                ⭐
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Screen 4: German Quiz Challenge */}
      {screen === 4 && question && (
        <section className="bg-white text-slate-900 rounded-3xl p-6 my-auto shadow-[0_20px_50px_rgba(0,0,0,0.6)] border-4 border-amber-400">
          {/* Quiz Header */}
          <div className="flex items-center justify-between border-b-2 border-slate-100 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <GermanFlag className="w-6 h-4 rounded-sm shadow-sm" />
              <span className="font-black text-slate-800 tracking-wide">German Quiz</span>
            </div>
            {/* 15s Countdown Circle */}
            <div
              className={`w-11 h-11 rounded-full flex items-center justify-center font-mono font-black text-lg border-3 transition-colors ${
                quizSeconds <= 5
                  ? 'border-red-500 text-red-600 bg-red-50 animate-pulse'
                  : 'border-amber-400 text-amber-600 bg-amber-50'
              }`}
            >
              {quizSeconds}
            </div>
          </div>

          {/* Question Text */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 mb-5 text-center">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              {question.category}
            </span>
            <p className="text-xl md:text-2xl font-black text-slate-900 leading-snug">
              {question.question}
            </p>
            {question.translation && (
              <p className="text-xs text-slate-500 italic mt-1.5">{question.translation}</p>
            )}
          </div>

          {/* Multiple Choice Options A-D */}
          <div className="space-y-2.5 mb-4">
            {question.options.map((option, index) => {
              const letter = String.fromCharCode(65 + index)
              const isSelected = answer === index
              const isCorrect = index === question.correctAnswer
              let btnClass = 'border-2 border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-800'

              if (answer !== undefined) {
                if (isCorrect) {
                  btnClass = 'border-2 border-green-500 bg-green-500 text-white font-bold'
                } else if (isSelected) {
                  btnClass = 'border-2 border-red-500 bg-red-500 text-white font-bold'
                } else {
                  btnClass = 'border-2 border-slate-200 bg-slate-100 text-slate-400 opacity-60'
                }
              }

              return (
                <button
                  key={option}
                  disabled={answer !== undefined}
                  onClick={() => answerQuestion(index)}
                  className={`w-full text-left px-4 py-3 rounded-xl font-bold flex items-center justify-between transition active:scale-[0.98] ${btnClass}`}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-7 h-7 rounded-lg bg-black/10 flex items-center justify-center font-mono text-sm">
                      {letter}
                    </span>
                    <span className="text-base">{option}</span>
                  </div>
                  {answer !== undefined && isCorrect && <span>✅</span>}
                  {answer !== undefined && isSelected && !isCorrect && <span>❌</span>}
                </button>
              )
            })}
          </div>

          {/* Answer Banner */}
          {answer !== undefined && (
            <div
              className={`p-3 rounded-2xl text-center font-black text-white text-base shadow-lg animate-fade-in ${
                answer === question.correctAnswer ? 'bg-green-600' : 'bg-red-600'
              }`}
            >
              <p className="font-black text-base">
                {answer === question.correctAnswer ? `🎉 Richtig! +${question.points || 100} Punkte` : '❌ Leider falsch!'}
              </p>
              {question.explanation && (
                <p className="text-xs text-white/95 mt-1 font-medium">{question.explanation}</p>
              )}
            </div>
          )}
        </section>
      )}

      {/* Screen 5: Results & Leaderboard Podium */}
      {screen === 5 && (
        <section className="sky-card p-6 my-auto text-center shadow-2xl">
          <div className="text-6xl mb-1">🏆</div>
          <div className="inline-block bg-gradient-to-r from-amber-400 to-yellow-500 text-amber-950 px-6 py-1.5 rounded-full font-black text-xl border border-amber-800 shadow mb-6">
            SPIELERGEBNISSE
          </div>

          {/* Podium (Juara 2, 1, 3) */}
          <div className="flex items-end justify-center gap-2 mb-8 h-48 pt-4">
            {/* Rank 2 (Silver) */}
            <div className="flex flex-col items-center flex-1">
              <span className="text-3xl mb-1">🥈</span>
              <div className="text-xs font-bold text-slate-200 truncate max-w-[80px]">
                {selectLeaderboard(useGameStore.getState())[1]?.name || 'Max'}
              </div>
              <div className="font-mono text-xs font-black text-amber-300">
                {selectLeaderboard(useGameStore.getState())[1]?.score || 1180}
              </div>
              <div className="w-full bg-slate-700 border-2 border-slate-500 rounded-t-xl h-24 flex items-center justify-center text-xl font-black text-slate-300 shadow">
                2
              </div>
            </div>

            {/* Rank 1 (Gold) */}
            <div className="flex flex-col items-center flex-1">
              <span className="text-4xl mb-1 filter drop-shadow">👑</span>
              <div className="text-xs font-black text-amber-300 truncate max-w-[90px]">
                {selectLeaderboard(useGameStore.getState())[0]?.name || 'Lena'}
              </div>
              <div className="font-mono text-sm font-black text-yellow-300">
                {selectLeaderboard(useGameStore.getState())[0]?.score || 1250}
              </div>
              <div className="w-full bg-amber-500 border-2 border-amber-300 rounded-t-2xl h-32 flex items-center justify-center text-2xl font-black text-amber-950 shadow-lg">
                1
              </div>
            </div>

            {/* Rank 3 (Bronze) */}
            <div className="flex flex-col items-center flex-1">
              <span className="text-3xl mb-1">🥉</span>
              <div className="text-xs font-bold text-slate-200 truncate max-w-[80px]">
                {selectLeaderboard(useGameStore.getState())[2]?.name || 'Anna'}
              </div>
              <div className="font-mono text-xs font-black text-amber-300">
                {selectLeaderboard(useGameStore.getState())[2]?.score || 1120}
              </div>
              <div className="w-full bg-amber-800 border-2 border-amber-600 rounded-t-xl h-18 flex items-center justify-center text-xl font-black text-amber-200 shadow">
                3
              </div>
            </div>
          </div>

          <a href="/play" className="game-secondary w-full text-lg py-3.5 shadow-[0_6px_0_#0f172a] block no-underline">
            🔄 PLAY AGAIN
          </a>
        </section>
      )}

      {/* Footer Branding */}
      <footer className="text-center pb-2">
        <p className="text-[10px] text-slate-900/80 font-bold uppercase tracking-widest">
          Deutsch Adventure · Mobile Controller
        </p>
      </footer>
    </main>
  )
}

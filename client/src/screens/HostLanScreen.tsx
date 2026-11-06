import { useEffect, useMemo, useState } from 'react'
import { PhaserGame } from '../game/PhaserGame'
import { type BlockHitEvent } from '../game/GermanVillageScene'
import { QrCode } from '../utils/QrCode'
import { quizCategories } from '../data/germanQuizBank'
import {
  publicColyseusEndpoint,
  setRoomCategory,
  setRoomStatus,
  startHostedRoom,
  hitQuestionBlock,
  submitRoomAnswer,
  type GameRoom,
} from '../lib/colyseusClient'
import { useGameStore } from '../lib/useGameStore'
import { soundManager } from '../lib/soundManager'
import { GermanFlag } from '../utils/GermanFlag'

export default function HostLanScreen() {
  const players = useGameStore((s) => s.players)
  const status = useGameStore((s) => s.gameStatus)
  const seconds = useGameStore((s) => s.remainingSeconds)
  const roomId = useGameStore((s) => s.roomId)
  const category = useGameStore((s) => s.category)
  const toasts = useGameStore((s) => s.toasts)
  const activeQuestion = useGameStore((s) => s.activeQuestion)

  const top = useMemo(() => [...players].sort((a, b) => b.score - a.score).slice(0, 5), [players])
  const totalCoins = useMemo(() => players.reduce((n, p) => n + (p.coins || 0), 0), [players])
  const totalScore = useMemo(() => players.reduce((n, p) => n + (p.score || 0), 0), [players])

  const [room, setRoom] = useState<GameRoom>()
  const [error, setError] = useState('')
  const [ip, setIp] = useState(location.hostname === 'localhost' || location.hostname === '127.0.0.1' ? '' : location.hostname)
  const [manual, setManual] = useState(false)
  const [showLobby, setShowLobby] = useState(true)
  const [copied, setCopied] = useState(false)
  const [lang, setLang] = useState<'id' | 'de'>('id')
  const [hostAnswer, setHostAnswer] = useState<number>()

  const t = lang === 'id' ? {
    lobby: 'Lobi Host',
    lobbySub: 'Bagikan kode atau scan QR dari HP pemain untuk bergabung.',
    category: 'Kategori Kuis',
    allCat: 'Semua Kategori',
    players: 'Pemain Bergabung',
    start: 'Mulai Game',
    close: 'Tutup',
    openLobby: 'Buka Lobi & QR',
    hostIp: 'IP Host (LAN)',
    code: 'Kode Room',
    copy: 'Salin Kode',
    copied: 'Tersalin!',
    waiting: 'Menunggu pemain dari smartphone…',
    pause: 'Jeda',
    resume: 'Lanjutkan',
    end: 'Akhiri Game',
    ranking: 'Peringkat',
    noIp: 'Mendeteksi IP LAN…',
    scanHint: 'Scan QR menggunakan kamera smartphone untuk langsung bergabung',
  } : {
    lobby: 'Host-Lobby',
    lobbySub: 'Teile den Code oder scanne den QR-Code mit dem Smartphone.',
    category: 'Quiz-Kategorie',
    allCat: 'Alle Kategorien',
    players: 'Beigetretene Spieler',
    start: 'Spiel starten',
    close: 'Schließen',
    openLobby: 'Lobby & QR öffnen',
    hostIp: 'Host-IP (LAN)',
    code: 'Raumcode',
    copy: 'Code kopieren',
    copied: 'Kopiert!',
    waiting: 'Warte auf Spieler via Smartphone…',
    pause: 'Pause',
    resume: 'Weiter',
    end: 'Spiel beenden',
    ranking: 'Bestenliste',
    noIp: 'Suche LAN-IP…',
    scanHint: 'QR-Code mit Smartphone scannen, um direkt beizutreten',
  }

  useEffect(() => {
    let alive = true
    const port = location.port === '5173' ? '5173' : '2567'
    const endpoint = import.meta.env.VITE_COLYSEUS_URL ?? publicColyseusEndpoint(location.hostname, port)
    startHostedRoom(endpoint)
      .then((r) => {
        if (alive) setRoom(r)
        else void r.leave()
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Koneksi server gagal'))
    return () => { alive = false }
  }, [])

  useEffect(() => () => { void room?.leave() }, [room])

  useEffect(() => {
    if (manual) return
    fetch('/api/lan')
      .then((r) => r.json() as Promise<{ preferred: string }>)
      .then((d) => {
        if (d.preferred) setIp(d.preferred)
      })
      .catch(() => undefined)
  }, [manual])

  const displayIp = ip || location.hostname
  const url = roomId ? `${location.protocol}//${displayIp}:5173/play?room=${encodeURIComponent(roomId)}` : ''
  const clock = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`

  const copyRoomCode = () => {
    if (!roomId) return
    navigator.clipboard.writeText(roomId).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => undefined)
  }

  const handleBlockHit = (data: BlockHitEvent) => {
    if (room && status === 'playing') {
      hitQuestionBlock(room, 'quiz', data.blockId, data.blockType)
    }
  }

  const handleAnswerSubmit = (index: number) => {
    if (!room || !activeQuestion || hostAnswer !== undefined) return
    setHostAnswer(index)
    const isCorrect = index === activeQuestion.correctAnswer
    soundManager.play(isCorrect ? 'correct' : 'incorrect')
    submitRoomAnswer(room, activeQuestion.id, index)

    setTimeout(() => {
      setHostAnswer(undefined)
      useGameStore.getState().setActiveQuestion(null)
    }, 1500)
  }

  return (
    <main className="relative h-screen w-screen select-none overflow-hidden bg-sky-300 text-white" style={{ isolation: 'isolate' }}>
      <PhaserGame
        players={players}
        onBlockHit={handleBlockHit}
        isFrozen={Boolean(activeQuestion) || status !== 'playing'}
      />

      {/* React HUD Layer */}
      <div className="pointer-events-none absolute inset-0 z-20 flex flex-col justify-between p-4">
        {/* Top Header */}
        <header className="pointer-events-auto flex items-start justify-between gap-3">
          {/* Left Brand */}
          <div className="flex items-center gap-3">
            <GermanFlag className="w-10 h-7 rounded shadow-md" />
            <div>
              <h1 className="adventure-title text-2xl md:text-3xl leading-none">Deutsch Adventure</h1>
              <span className="font-pixel text-[10px] text-amber-300 tracking-wider block mt-1">LEVEL 1 · GERMAN VILLAGE</span>
            </div>
          </div>

          {/* Center Timer & Level Badge */}
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-2 bg-slate-950/90 backdrop-blur-md px-6 py-1.5 rounded-2xl border-2 border-amber-400/80 shadow-[0_4px_14px_rgba(0,0,0,0.6)]">
              <span className="text-xl">⏱️</span>
              <span className="font-mono text-2xl md:text-3xl font-black text-amber-300 tracking-widest">{clock}</span>
            </div>
            <div className="bg-gradient-to-r from-amber-400 to-yellow-500 text-amber-950 font-black text-xs px-4 py-0.5 rounded-full border border-amber-800 shadow -mt-1 uppercase tracking-wider">
              Level 1 - German Village
            </div>
          </div>

          {/* Right Counters & Language Switcher */}
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-2 bg-slate-950/85 backdrop-blur-md px-3.5 py-1.5 rounded-2xl border-2 border-amber-400/60 shadow-lg">
              <span className="text-xl">🪙</span>
              <span className="text-lg font-black text-amber-300">{totalCoins}</span>
            </div>
            <div className="flex items-center gap-2 bg-slate-950/85 backdrop-blur-md px-3.5 py-1.5 rounded-2xl border-2 border-amber-400/60 shadow-lg">
              <span className="text-xl">⭐</span>
              <span className="text-lg font-black text-yellow-300">{totalScore}</span>
            </div>
            <select
              aria-label="Bahasa / Sprache"
              value={lang}
              onChange={(e) => setLang(e.target.value as 'id' | 'de')}
              className="bg-slate-950/90 text-white border-2 border-amber-400/70 rounded-xl px-2.5 py-1.5 text-xs font-bold shadow-lg cursor-pointer focus:outline-none"
            >
              <option value="id">🇮🇩 ID</option>
              <option value="de">🇩🇪 DE</option>
            </select>
          </div>
        </header>

        {/* Minimized Lobby Toggle Button */}
        {status === 'lobby' && !showLobby && (
          <button
            onClick={() => setShowLobby(true)}
            className="pointer-events-auto game-primary absolute left-5 top-24 z-20 text-sm py-2 px-4 shadow-[0_4px_0_#78350f]"
          >
            🏷️ {t.openLobby} ({roomId || '....'})
          </button>
        )}

        {/* Live Leaderboard (Right sidebar) */}
        {status !== 'lobby' && (
          <aside className="pointer-events-auto absolute right-4 top-24 z-20 w-64 rounded-2xl border-2 border-amber-400/50 bg-slate-950/85 backdrop-blur-md p-4 text-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-amber-400/30 pb-2 mb-3">
              <h2 className="font-black text-amber-300 text-lg flex items-center gap-1.5">
                <span>🏆</span> {t.ranking}
              </h2>
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">TOP 5</span>
            </div>
            <div className="space-y-1.5">
              {top.map((p, i) => (
                <div key={p.id} className="flex items-center justify-between bg-slate-900/60 px-3 py-1.5 rounded-xl border border-slate-800 text-sm">
                  <div className="flex items-center gap-2 truncate">
                    <span className="w-5 text-center font-bold text-amber-300">{i === 0 ? '👑' : `${i + 1}.`}</span>
                    <span className="truncate font-semibold">{p.name}</span>
                  </div>
                  <span className="font-mono font-bold text-amber-300 ml-2">{p.score}</span>
                </div>
              ))}
              {top.length === 0 && (
                <p className="text-xs text-slate-400 italic py-2 text-center">{t.waiting}</p>
              )}
            </div>
          </aside>
        )}

        {/* Bottom Bar: Wooden Sign, Toast, Admin Controls */}
        <footer className="pointer-events-none flex items-end justify-between gap-3">
          {/* Wooden sign */}
          <div className="pointer-events-auto wood-panel p-3 text-center font-black text-xs md:text-sm tracking-wide shadow-2xl">
            Lerne Deutsch<br/><span className="text-amber-200">und spiele!</span>
          </div>

          {/* Toast Notification */}
          <div className="pointer-events-auto flex items-center gap-2.5 bg-slate-950/92 backdrop-blur-md border-2 border-amber-400 px-6 py-2.5 rounded-full shadow-[0_8px_20px_rgba(0,0,0,0.6)] text-white font-bold text-sm md:text-base">
            <GermanFlag className="w-6 h-4 rounded-sm shadow-sm" />
            <span>{toasts.length > 0 ? toasts[toasts.length - 1].message : 'Richtige Antwort! +100 Punkte'}</span>
            <span className="text-green-400 text-lg">✅</span>
          </div>

          {/* Admin Controls */}
          {status !== 'ended' && (
            <nav className="pointer-events-auto flex items-center gap-2">
              <button
                className="game-primary text-xs md:text-sm py-2 px-4 shadow-[0_4px_0_#78350f]"
                disabled={!room || status === 'lobby'}
                onClick={() => room && setRoomStatus(room, 'pause', status !== 'paused')}
              >
                {status === 'paused' ? `▶️ ${t.resume}` : `⏸️ ${t.pause}`}
              </button>
              <button
                className="game-danger text-xs md:text-sm py-2 px-4 shadow-[0_4px_0_#450a0a]"
                disabled={!room || status === 'lobby'}
                onClick={() => room && setRoomStatus(room, 'end')}
              >
                ⏹️ {t.end}
              </button>
            </nav>
          )}
        </footer>
      </div>

      {/* In-Game Live Quiz Overlay on Host TV */}
      {activeQuestion && status === 'playing' && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-sm pointer-events-auto">
          <div className="bg-white text-slate-900 border-4 border-amber-400 rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between border-b pb-3 mb-3">
              <div className="flex items-center gap-2">
                <GermanFlag className="w-7 h-5 rounded shadow-sm" />
                <span className="font-black text-slate-900 text-lg">German Quiz Challenge</span>
              </div>
              <span className="bg-amber-100 text-amber-800 text-xs font-bold px-3 py-1 rounded-full border border-amber-300">
                {activeQuestion.difficulty} · +{activeQuestion.points} Pkt
              </span>
            </div>

            <p className="text-xs uppercase font-bold text-slate-400 tracking-wider mb-1">
              {activeQuestion.category}
            </p>
            <h3 className="text-xl md:text-2xl font-black text-slate-900 leading-snug mb-1">
              {activeQuestion.question}
            </h3>
            <p className="text-xs text-slate-500 italic mb-5">
              {activeQuestion.translation}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-4">
              {activeQuestion.options.map((option, idx) => {
                const isCorrect = idx === activeQuestion.correctAnswer
                const isSelected = hostAnswer === idx
                let btnStyle = 'border-2 border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-800'

                if (hostAnswer !== undefined) {
                  if (isCorrect) btnStyle = 'border-2 border-green-500 bg-green-500 text-white font-bold'
                  else if (isSelected) btnStyle = 'border-2 border-red-500 bg-red-500 text-white font-bold'
                  else btnStyle = 'border-2 border-slate-200 bg-slate-100 text-slate-400 opacity-60'
                }

                return (
                  <button
                    key={option}
                    disabled={hostAnswer !== undefined}
                    onClick={() => handleAnswerSubmit(idx)}
                    className={`p-3 text-left font-bold rounded-xl transition flex items-center justify-between ${btnStyle}`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="w-6 h-6 rounded bg-black/10 flex items-center justify-center font-mono text-xs">
                        {String.fromCharCode(65 + idx)}
                      </span>
                      <span className="text-sm">{option}</span>
                    </div>
                    {hostAnswer !== undefined && isCorrect && <span>✅</span>}
                  </button>
                )
              })}
            </div>

            {hostAnswer !== undefined && (
              <div
                className={`p-3 rounded-2xl text-center font-bold text-white text-sm shadow ${
                  hostAnswer === activeQuestion.correctAnswer ? 'bg-green-600' : 'bg-red-600'
                }`}
              >
                {hostAnswer === activeQuestion.correctAnswer
                  ? `🎉 Richtig! +${activeQuestion.points} Punkte`
                  : '❌ Leider falsch!'}
                {activeQuestion.explanation && (
                  <p className="text-xs font-normal text-white/90 mt-1">{activeQuestion.explanation}</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Centered Host Lobby Modal */}
      {status === 'lobby' && showLobby && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md">
          <div className="bg-slate-950/95 border-3 border-amber-400/90 rounded-3xl p-6 md:p-8 max-w-3xl w-full shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8)] text-white relative">
            {/* Close Button */}
            <button
              onClick={() => setShowLobby(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700 w-9 h-9 rounded-full flex items-center justify-center font-bold text-lg border border-slate-600 transition cursor-pointer"
              aria-label={t.close}
            >
              ✕
            </button>

            {/* Modal Header */}
            <div className="flex items-center gap-3 mb-5 border-b border-amber-400/30 pb-4">
              <GermanFlag className="w-10 h-7 rounded shadow-md" />
              <div>
                <h2 className="text-2xl md:text-3xl font-black text-white">{t.lobby}</h2>
                <p className="text-xs text-amber-300/80 font-medium">{t.lobbySub}</p>
              </div>
            </div>

            {/* Quiz Category Dropdown */}
            <div className="mb-5">
              <label className="block text-xs uppercase tracking-wider font-bold text-amber-300 mb-1.5">
                {t.category}
              </label>
              <select
                className="w-full rounded-xl border-2 border-slate-700 bg-slate-900/90 p-3 text-white font-medium focus:border-amber-400 focus:outline-none transition cursor-pointer"
                value={category}
                onChange={(e) => room && setRoomCategory(room, e.target.value)}
              >
                <option value="Alle Kategorien">🌟 {t.allCat}</option>
                {quizCategories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* Two Columns: Left QR Code, Right Room Info & Players */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start mb-6">
              {/* Left Column: QR Code */}
              <div className="flex flex-col items-center bg-slate-900/80 border border-slate-800 rounded-2xl p-4">
                {url ? (
                  <div className="bg-white p-3 rounded-2xl shadow-inner border border-amber-200">
                    <QrCode value={url} />
                  </div>
                ) : (
                  <div className="w-48 h-48 rounded-2xl border-2 border-dashed border-slate-700 flex items-center justify-center text-center p-4 text-xs text-slate-400">
                    {t.noIp}
                  </div>
                )}
                <p className="text-[11px] text-amber-200/90 mt-2 text-center font-semibold">{t.scanHint}</p>

                {/* Host IP input with edit */}
                <div className="w-full mt-3">
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">{t.hostIp}</label>
                  <input
                    value={ip}
                    placeholder="192.168.x.x"
                    onChange={(e) => {
                      setManual(true)
                      setIp(e.target.value.trim())
                    }}
                    className="w-full text-xs font-mono rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-white focus:border-amber-400 focus:outline-none"
                  />
                </div>
              </div>

              {/* Right Column: Room Code & Player List */}
              <div className="flex flex-col justify-between h-full bg-slate-900/80 border border-slate-800 rounded-2xl p-5">
                <div>
                  <span className="text-xs uppercase tracking-wider font-bold text-slate-400 block mb-1">
                    {t.code}
                  </span>
                  <div className="flex items-center gap-3 mb-3">
                    <span className="font-mono text-4xl md:text-5xl font-black text-amber-300 tracking-[0.25em] bg-slate-950 px-4 py-2 rounded-xl border border-amber-400/40 shadow-inner">
                      {roomId || '....'}
                    </span>
                    <button
                      onClick={copyRoomCode}
                      className="text-xs bg-slate-800 hover:bg-slate-700 text-amber-200 font-bold px-3 py-2 rounded-lg border border-slate-600 transition cursor-pointer"
                      title={t.copy}
                    >
                      📋 {copied ? t.copied : t.copy}
                    </button>
                  </div>
                  {url && (
                    <a
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-sky-400 hover:text-sky-300 underline break-all block mb-3 font-mono"
                    >
                      {url}
                    </a>
                  )}
                </div>

                {/* Player List */}
                <div>
                  <div className="flex items-center justify-between border-t border-slate-800 pt-3 mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                      {t.players} ({players.length})
                    </span>
                    <span className="text-[11px] text-amber-400 font-semibold">{players.length >= 1 ? '✅ Ready' : '⏳ Waiting'}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 max-h-28 overflow-y-auto pr-1">
                    {players.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center gap-2 bg-slate-950 px-3 py-2 rounded-xl border border-slate-700 text-xs font-semibold"
                      >
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{
                            backgroundColor:
                              p.character === 'red' ? '#ef4444' :
                              p.character === 'green' ? '#22c55e' :
                              p.character === 'pink' ? '#ec4899' : '#3b82f6',
                          }}
                        />
                        <span className="truncate">{p.name}</span>
                      </div>
                    ))}
                    {players.length === 0 && (
                      <p className="col-span-2 text-xs text-slate-500 italic py-2 text-center">
                        {t.waiting}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Start Button */}
            <button
              disabled={!room}
              onClick={() => {
                if (room) {
                  setRoomStatus(room, 'start')
                  setShowLobby(false)
                }
              }}
              className="game-primary w-full text-xl py-3.5 shadow-[0_6px_0_#78350f]"
            >
              🚀 {t.start}
            </button>
            {error && <p role="alert" className="mt-2 text-center text-xs text-red-400">{error}</p>}
          </div>
        </div>
      )}
    </main>
  )
}

import HostScreen from './screens/HostScreen'
import PlayerScreen from './screens/PlayerScreen'
import { GermanFlag } from './utils/GermanFlag'

export default function App() {
  if (window.location.pathname === '/host') return <HostScreen />
  if (window.location.pathname === '/play') return <PlayerScreen />

  return (
    <main className="pixel-bg relative min-h-screen flex items-center justify-center p-4 overflow-hidden select-none">
      {/* Background clouds and mountains */}
      <div className="absolute inset-x-0 top-12 flex justify-around text-6xl opacity-60 pointer-events-none" aria-hidden="true">
        <span className="animate-pulse">☁️</span>
        <span>🏰</span>
        <span className="animate-pulse">☁️</span>
      </div>

      {/* Ground strip */}
      <div className="absolute inset-x-0 bottom-0 h-28 border-t-8 border-lime-500 bg-[repeating-linear-gradient(90deg,#78350f_0_32px,#92400e_32px_64px)] shadow-2xl" aria-hidden="true" />

      {/* Main Hero Card */}
      <section className="relative z-10 sky-card max-w-xl w-full p-8 md:p-10 text-center shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8)] border-4 border-amber-400">
        <div className="mb-3 flex justify-center">
          <GermanFlag className="w-16 h-11 rounded-lg shadow-xl" />
        </div>
        <h1 className="adventure-title text-4xl sm:text-6xl md:text-7xl leading-tight">
          Deutsch<br />Adventure
        </h1>
        <p className="font-pixel text-xs text-amber-300 tracking-widest mt-2 mb-1 uppercase">
          Lerne Deutsch und spiele!
        </p>
        <p className="text-xs text-slate-300 font-medium mb-8">
          Multiplayer 2D Platformer & German Educational Quiz
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <a
            href="/host"
            className="game-primary text-base py-4 px-6 no-underline shadow-[0_6px_0_#78350f] hover:no-underline"
          >
            🖥️ Buka Layar TV / Host
          </a>
          <a
            href="/play"
            className="game-secondary text-base py-4 px-6 no-underline shadow-[0_6px_0_#0f172a] hover:no-underline"
          >
            📱 Buka Layar HP Pemain
          </a>
        </div>
      </section>
    </main>
  )
}


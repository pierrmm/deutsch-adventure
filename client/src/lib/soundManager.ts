import { Howl } from 'howler'

export type GameSound = 'bgm' | 'jump' | 'coin' | 'correct' | 'incorrect' | 'win'

const files: Record<GameSound, string> = {
  bgm: '/audio/bgm.mp3',
  jump: '/audio/jump.mp3',
  coin: '/audio/coin.mp3',
  correct: '/audio/correct.mp3',
  incorrect: '/audio/incorrect.mp3',
  win: '/audio/win.mp3',
}

const sounds = Object.fromEntries(
  Object.entries(files).map(([name, src]) => [
    name,
    new Howl({ src: [src], preload: false, volume: name === 'bgm' ? 0.35 : 0.7 }),
  ]),
) as Record<GameSound, Howl>

// High-quality Web Audio API Synthesizer fallback for instant offline retro sound effects
function playSynthSound(sound: GameSound) {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AudioContextClass) return
    const ctx = new AudioContextClass()

    if (sound === 'jump') {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type = 'square'
      osc.frequency.setValueAtTime(160, ctx.currentTime)
      osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.12)
      gain.gain.setValueAtTime(0.2, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12)
      osc.start()
      osc.stop(ctx.currentTime + 0.12)
    } else if (sound === 'coin') {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type = 'sine'
      osc.frequency.setValueAtTime(987, ctx.currentTime) // B5
      osc.frequency.setValueAtTime(1318, ctx.currentTime + 0.07) // E6
      gain.gain.setValueAtTime(0.25, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3)
      osc.start()
      osc.stop(ctx.currentTime + 0.3)
    } else if (sound === 'correct') {
      [523.25, 659.25, 783.99].forEach((freq, idx) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.type = 'triangle'
        osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.08)
        gain.gain.setValueAtTime(0.25, ctx.currentTime + idx * 0.08)
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + idx * 0.08 + 0.25)
        osc.start(ctx.currentTime + idx * 0.08)
        osc.stop(ctx.currentTime + idx * 0.08 + 0.25)
      })
    } else if (sound === 'incorrect') {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type = 'sawtooth'
      osc.frequency.setValueAtTime(180, ctx.currentTime)
      osc.frequency.linearRampToValueAtTime(110, ctx.currentTime + 0.25)
      gain.gain.setValueAtTime(0.3, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25)
      osc.start()
      osc.stop(ctx.currentTime + 0.25)
    } else if (sound === 'win') {
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.type = 'sine'
        osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.12)
        gain.gain.setValueAtTime(0.28, ctx.currentTime + idx * 0.12)
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + idx * 0.12 + 0.35)
        osc.start(ctx.currentTime + idx * 0.12)
        osc.stop(ctx.currentTime + idx * 0.12 + 0.35)
      })
    }
  } catch {
    /* ignore AudioContext error */
  }
}

export const soundManager = {
  play(sound: GameSound) {
    playSynthSound(sound)
    try {
      const howl = sounds[sound]
      if (sound === 'bgm') howl.loop(true)
      howl.play()
    } catch {
      /* ignore howler error */
    }
  },
  stop(sound: GameSound) {
    try {
      sounds[sound].stop()
    } catch {
      /* ignore stop error */
    }
  },
  stopAll() {
    Object.values(sounds).forEach((s) => {
      try {
        s.stop()
      } catch {
        /* ignore stop error */
      }
    })
  },
  setVolume(sound: GameSound, volume: number) {
    try {
      sounds[sound].volume(Math.max(0, Math.min(1, volume)))
    } catch {
      /* ignore volume error */
    }
  },
}


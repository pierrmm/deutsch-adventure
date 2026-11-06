import { useEffect, useRef } from 'react'
import Phaser from 'phaser'
import { GermanVillageScene, type BlockHitEvent } from './GermanVillageScene'
import type { GamePlayer } from '../lib/useGameStore'

export function PhaserGame({
  players,
  localPlayerId,
  onInput,
  onBlockHit,
  isFrozen,
}: {
  players: GamePlayer[]
  localPlayerId?: string
  onInput?: (x: number, y: number) => void
  onBlockHit?: (data: BlockHitEvent) => void
  isFrozen?: boolean
}) {
  const mount = useRef<HTMLDivElement>(null)
  const game = useRef<Phaser.Game | null>(null)
  const onBlockHitRef = useRef(onBlockHit)

  useEffect(() => {
    onBlockHitRef.current = onBlockHit
  }, [onBlockHit])

  useEffect(() => {
    if (!mount.current) return

    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      parent: mount.current,
      width: 1280,
      height: 720,
      backgroundColor: '#7dd3fc',
      transparent: false,
      physics: {
        default: 'arcade',
        arcade: {
          gravity: { x: 0, y: 750 },
          debug: false,
        },
      },
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: 1280,
        height: 720,
      },
      render: { pixelArt: true, antialias: false },
      scene: [GermanVillageScene],
    }

    const instance = new Phaser.Game(config)
    game.current = instance

    const listener = (data: BlockHitEvent) => {
      onBlockHitRef.current?.(data)
    }
    instance.events.on('game:block-hit', listener)

    return () => {
      instance.events.off('game:block-hit', listener)
      instance.destroy(true)
      game.current = null
    }
  }, [])

  useEffect(() => {
    game.current?.scene.getScene('GermanVillage')?.events.emit('player:update', players)
  }, [players])

  useEffect(() => {
    game.current?.scene.getScene('GermanVillage')?.events.emit('player:local', localPlayerId)
  }, [localPlayerId])

  useEffect(() => {
    game.current?.scene.getScene('GermanVillage')?.events.emit('game:freeze', Boolean(isFrozen))
  }, [isFrozen])

  useEffect(() => {
    if (onInput) {
      game.current?.scene.getScene('GermanVillage')?.events.emit('player:input', 0, 0)
    }
  }, [onInput])

  return (
    <div
      ref={mount}
      id="phaser-container"
      className="absolute inset-0 z-0 h-full w-full overflow-hidden flex items-center justify-center bg-[#7dd3fc]"
      aria-label="Deutsch Adventure German Village game"
    />
  )
}


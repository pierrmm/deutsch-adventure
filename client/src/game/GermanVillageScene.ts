import Phaser from 'phaser'
import type { SyncedPlayer } from '../lib/colyseusClient'
import { soundManager } from '../lib/soundManager'

export interface BlockHitEvent {
  blockId: string
  blockType: 'standard' | 'vocab' | 'grammar' | 'challenge' | 'bonus'
  points: number
}

interface QuestionBlockData {
  id: string
  type: 'standard' | 'vocab' | 'grammar' | 'challenge' | 'bonus'
  symbol: string
  color: number
  points: number
  isHit: boolean
}

export class GermanVillageScene extends Phaser.Scene {
  private remotePlayers = new Map<string, Phaser.GameObjects.Container>()
  private demoPlayers: Phaser.GameObjects.Container[] = []
  private clouds: Phaser.GameObjects.Container[] = []

  private localPlayer!: Phaser.Physics.Arcade.Sprite
  private questionBlocks!: Phaser.Physics.Arcade.StaticGroup
  private groundGroup!: Phaser.Physics.Arcade.StaticGroup
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys
  private wasd?: {
    up: Phaser.Input.Keyboard.Key
    left: Phaser.Input.Keyboard.Key
    down: Phaser.Input.Keyboard.Key
    right: Phaser.Input.Keyboard.Key
    space: Phaser.Input.Keyboard.Key
  }

  private isPaused = false

  constructor() { super('GermanVillage') }

  preload() {
    this.load.spritesheet('dude', '/assets/game/dude.png', { frameWidth: 32, frameHeight: 48 })
    this.load.spritesheet('coin-anim', '/assets/game/coin-anim.png', { frameWidth: 16, frameHeight: 16 })
    this.load.image('game-star', '/assets/game/star.png')
    this.load.image('game-block', '/assets/game/block.png')
    this.load.image('game-platform', '/assets/game/platform.png')
    this.load.image('game-mushroom', '/assets/game/mushroom.png')
    this.load.image('game-tree-euro', '/assets/game/tree-european.png')
    this.load.image('game-tree', '/assets/game/tree.png')
  }

  create() {
    const { height } = this.scale
    this.cameras.main.setBounds(0, 0, 2400, height)
    this.physics.world.setBounds(0, 0, 2400, height)
    this.cameras.main.setBackgroundColor('#7dd3fc')

    // 1. Character & Coin Animations
    if (!this.anims.exists('dude-left')) {
      this.anims.create({
        key: 'dude-left',
        frames: this.anims.generateFrameNumbers('dude', { start: 0, end: 3 }),
        frameRate: 10,
        repeat: -1,
      })
      this.anims.create({
        key: 'dude-turn',
        frames: [{ key: 'dude', frame: 4 }],
        frameRate: 20,
      })
      this.anims.create({
        key: 'dude-right',
        frames: this.anims.generateFrameNumbers('dude', { start: 5, end: 8 }),
        frameRate: 10,
        repeat: -1,
      })
      this.anims.create({
        key: 'coin-spin',
        frames: this.anims.generateFrameNumbers('coin-anim', { start: 0, end: 3 }),
        frameRate: 8,
        repeat: -1,
      })
    }

    // 2. Parallax Sky & Alpine Mountains
    const sky = this.add.graphics().setDepth(0)
    sky.fillGradientStyle(0x38bdf8, 0x38bdf8, 0xbae6fd, 0xbae6fd, 1)
    sky.fillRect(0, 0, 2400, height)

    for (let x = 80; x < 2400; x += 440) {
      this.add.triangle(x + 80, height - 200, -180, 160, 0, -250, 180, 160, 0x64748b).setDepth(1)
      this.add.triangle(x + 90, height - 202, -60, 60, 0, -115, 60, 60, 0xf8fafc).setDepth(2)
      this.add.triangle(x + 300, height - 170, -140, 130, 0, -190, 140, 130, 0x475569).setDepth(1)
    }

    // Clouds
    this.clouds = []
    for (let x = 60; x < 2400; x += 360) {
      const cloud = this.add.container(x, 70 + (x % 3) * 20).setDepth(2)
      cloud.add([
        this.add.circle(0, 0, 28, 0xffffff, 0.95),
        this.add.circle(26, -6, 22, 0xffffff, 0.95),
        this.add.circle(-22, 4, 18, 0xffffff, 0.95),
      ])
      this.clouds.push(cloud)
    }

    // Castle & Traditional German Houses & Trees
    for (let x = 180; x < 2400; x += 580) {
      this.drawNeuschwanstein(x + 140, 155)
      this.drawHouse(x + 360, height - 88)
      this.add.image(x + 20, height - 120, 'game-tree-euro').setScale(0.85).setDepth(4)
      this.add.image(x + 480, height - 110, 'game-tree').setScale(0.95).setDepth(4)
    }

    // 3. Ground Arcade Physics Platforms
    this.groundGroup = this.physics.add.staticGroup()
    for (let x = 16; x < 2400; x += 32) {
      const tile = this.groundGroup.create(x, height - 36, 'game-platform') as Phaser.Physics.Arcade.Sprite
      tile.setDisplaySize(32, 32).setDepth(4)
      tile.refreshBody()
      this.add.rectangle(x, height - 12, 32, 28, 0x78350f).setDepth(4)
    }
    this.add.rectangle(1200, height - 54, 2400, 4, 0xa3e635).setDepth(5)

    // Wooden fences
    for (let x = 20; x < 2400; x += 48) {
      this.add.rectangle(x, height - 64, 8, 22, 0xa16207).setDepth(5)
      this.add.rectangle(x + 24, height - 68, 40, 4, 0xca8a04).setDepth(5)
    }

    // 4. Interactive Physical Question Blocks [?] (Variations)
    this.questionBlocks = this.physics.add.staticGroup()
    const blockSpecs: Array<{ x: number; y: number; type: QuestionBlockData['type']; symbol: string; color: number; points: number }> = [
      { x: 260, y: height - 145, type: 'standard', symbol: '?', color: 0xfacc15, points: 100 },
      { x: 480, y: height - 155, type: 'vocab', symbol: 'V', color: 0x38bdf8, points: 100 },
      { x: 720, y: height - 145, type: 'grammar', symbol: 'G', color: 0x4ade80, points: 120 },
      { x: 960, y: height - 165, type: 'challenge', symbol: '★', color: 0xc084fc, points: 150 },
      { x: 1200, y: height - 145, type: 'bonus', symbol: 'B', color: 0xfbbf24, points: 200 },
      { x: 1440, y: height - 155, type: 'vocab', symbol: 'V', color: 0x38bdf8, points: 100 },
      { x: 1680, y: height - 145, type: 'standard', symbol: '?', color: 0xfacc15, points: 100 },
      { x: 1920, y: height - 165, type: 'challenge', symbol: '★', color: 0xc084fc, points: 150 },
      { x: 2160, y: height - 145, type: 'bonus', symbol: 'B', color: 0xfbbf24, points: 200 },
    ]

    blockSpecs.forEach((spec, index) => {
      // Brick blocks flanking the question block
      this.add.image(spec.x - 38, spec.y, 'game-block').setDisplaySize(36, 36).setDepth(5)
      this.add.image(spec.x + 38, spec.y, 'game-block').setDisplaySize(36, 36).setDepth(5)

      // Physical Question Block Sprite
      const qBlock = this.questionBlocks.create(spec.x, spec.y, 'game-block') as Phaser.Physics.Arcade.Sprite
      qBlock.setDisplaySize(36, 36).setDepth(6)
      qBlock.setTint(spec.color)
      qBlock.refreshBody()

      const blockData: QuestionBlockData = {
        id: `block-${index + 1}`,
        type: spec.type,
        symbol: spec.symbol,
        color: spec.color,
        points: spec.points,
        isHit: false,
      }
      qBlock.setData('blockData', blockData)

      // Overlay symbol text [?], [V], [G], [★], [B]
      const symText = this.add.text(spec.x, spec.y - 1, spec.symbol, {
        fontFamily: "'Fredoka', sans-serif",
        fontSize: '22px',
        color: '#451a03',
        fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(7)
      qBlock.setData('symText', symText)

      // Floating spinning coin above
      const coin = this.add.sprite(spec.x, spec.y - 48, 'coin-anim').setScale(1.8).setDepth(6)
      coin.play('coin-spin')
      this.tweens.add({ targets: coin, y: spec.y - 54, duration: 600, yoyo: true, repeat: -1 })
    })

    // Green Pipes with Piranha Plants
    for (let x = 400; x < 2300; x += 680) {
      this.add.rectangle(x, height - 90, 64, 18, 0x22c55e).setStrokeStyle(3, 0x14532d).setDepth(6)
      this.add.rectangle(x, height - 68, 52, 38, 0x16a34a).setStrokeStyle(3, 0x14532d).setDepth(6)
      const plant = this.add.image(x, height - 120, 'game-mushroom').setDisplaySize(38, 38).setDepth(5)
      this.tweens.add({ targets: plant, y: height - 145, duration: 850, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
    }

    // Walking Goombas
    for (let x = 580; x < 2300; x += 640) {
      const goomba = this.add.image(x, height - 66, 'game-mushroom').setDisplaySize(36, 36).setDepth(6)
      this.tweens.add({ targets: goomba, x: x + 85, duration: 1800, yoyo: true, repeat: -1, flipX: true })
    }

    // 5. Local Player (Controllable via Keyboard on Host & Smooth Camera Follow)
    this.localPlayer = this.physics.add.sprite(160, height - 120, 'dude')
    this.localPlayer.setScale(1.2).setDepth(8)
    this.localPlayer.setBounce(0.05)
    this.localPlayer.setCollideWorldBounds(true)
    this.localPlayer.setGravityY(750)
    this.localPlayer.setTint(0xef4444)
    this.localPlayer.play('dude-turn')

    // Player Label
    const playerLabel = this.add.text(160, height - 150, 'Host (Player)', {
      fontFamily: "'Fredoka', sans-serif",
      fontSize: '12px',
      color: '#ffffff',
      backgroundColor: '#0f172add',
      padding: { x: 6, y: 2 },
    }).setOrigin(0.5).setDepth(9)

    this.localPlayer.setData('label', playerLabel)

    // Collide local player with ground
    this.physics.add.collider(this.localPlayer, this.groundGroup)

    // COLLISION: Player hits Question Block from UNDERNEATH!
    this.physics.add.collider(this.localPlayer, this.questionBlocks, (pObj, bObj) => {
      const p = pObj as Phaser.Physics.Arcade.Sprite
      const b = bObj as Phaser.Physics.Arcade.Sprite
      // Checking touching.up on player and touching.down on block
      const pBody = p.body as Phaser.Physics.Arcade.Body | null;
      const bBody = b.body as Phaser.Physics.Arcade.StaticBody | Phaser.Physics.Arcade.Body | null;
      if (pBody && bBody && (pBody.touching.up || pBody.blocked.up) && (bBody.touching.down || bBody.blocked.down)) {
        this.handleBlockHit(b)
      }
    })

    // Camera follow local player
    this.cameras.main.startFollow(this.localPlayer, true, 0.08, 0.08)

    // Keyboard controls
    if (this.input.keyboard) {
      this.cursors = this.input.keyboard.createCursorKeys()
      this.wasd = this.input.keyboard.addKeys({
        up: Phaser.Input.Keyboard.KeyCodes.W,
        left: Phaser.Input.Keyboard.KeyCodes.A,
        down: Phaser.Input.Keyboard.KeyCodes.S,
        right: Phaser.Input.Keyboard.KeyCodes.D,
        space: Phaser.Input.Keyboard.KeyCodes.SPACE,
      }) as { up: Phaser.Input.Keyboard.Key; left: Phaser.Input.Keyboard.Key; down: Phaser.Input.Keyboard.Key; right: Phaser.Input.Keyboard.Key; space: Phaser.Input.Keyboard.Key }
    }

    // 6. Demo Bots (Lena, Max, Anna, Tom, Felix)
    const botDefs = [
      { name: 'Lena', color: 0x22c55e, x: 260 },
      { name: 'Max', color: 0xef4444, x: 420 },
      { name: 'Anna', color: 0xec4899, x: 580 },
      { name: 'Tom', color: 0x3b82f6, x: 740 },
      { name: 'Felix', color: 0xeab308, x: 900 },
    ]
    this.demoPlayers = botDefs.map((b) => this.createPlayerContainer(b.name, b.color, b.x, height - 70))

    // 7. Event Handlers from React / Colyseus
    this.events.on('player:update', (players: SyncedPlayer[]) => {
      const hasReal = players && players.length > 0
      this.demoPlayers.forEach((bot) => bot.setVisible(!hasReal))
      this.updateRemotePlayers(players || [], height)
    })

    this.events.on('player:input', (moveX: number, moveY: number) => {
      if (this.isPaused || !this.localPlayer) return
      if (moveX < 0) {
        this.localPlayer.setVelocityX(-220)
        this.localPlayer.play('dude-left', true)
      } else if (moveX > 0) {
        this.localPlayer.setVelocityX(220)
        this.localPlayer.play('dude-right', true)
      }
      const body = this.localPlayer.body as Phaser.Physics.Arcade.Body | null;
      if (moveY < 0 && body && (body.touching.down || body.blocked.down)) {
        this.localPlayer.setVelocityY(-450)
        soundManager.play('jump')
      }
    })

    this.events.on('game:freeze', (frozen: boolean) => {
      this.isPaused = frozen
      if (this.localPlayer) {
        this.localPlayer.setVelocity(0, 0)
        this.localPlayer.play('dude-turn')
      }
    })

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.remotePlayers.clear()
      this.demoPlayers = []
    })
  }

  update(time: number) {
    // Parallax clouds
    this.clouds.forEach((cloud, i) => {
      cloud.x += 0.25 + (i % 3) * 0.1
      if (cloud.x > 2450) cloud.x = -60
    })

    // Local Player keyboard movement & jump
    if (this.localPlayer && !this.isPaused) {
      const left = this.cursors?.left.isDown || this.wasd?.left.isDown
      const right = this.cursors?.right.isDown || this.wasd?.right.isDown
      const jump = this.cursors?.up.isDown || this.wasd?.up.isDown || this.wasd?.space?.isDown

      if (left) {
        this.localPlayer.setVelocityX(-220)
        this.localPlayer.play('dude-left', true)
      } else if (right) {
        this.localPlayer.setVelocityX(220)
        this.localPlayer.play('dude-right', true)
      } else {
        this.localPlayer.setVelocityX(0)
        this.localPlayer.play('dude-turn')
      }

      const body = this.localPlayer.body as Phaser.Physics.Arcade.Body | null;
      if (jump && body && (body.touching.down || body.blocked.down)) {
        this.localPlayer.setVelocityY(-460)
        soundManager.play('jump')
      }

      // Update local player label position
      const label = this.localPlayer.getData('label') as Phaser.GameObjects.Text
      if (label) {
        label.setPosition(this.localPlayer.x, this.localPlayer.y - 36)
      }
    }

    // Demo players animation when no real players
    if (this.remotePlayers.size === 0) {
      this.demoPlayers.forEach((bot, index) => {
        const sprite = bot.getAt(0) as Phaser.GameObjects.Sprite
        const speed = 1.1
        const walkCycle = (time * 0.08 + index * 120) % 600
        const isRight = walkCycle < 300

        bot.x += isRight ? speed : -speed
        if (sprite && sprite.anims) {
          sprite.anims.play(isRight ? 'dude-right' : 'dude-left', true)
        }
        if (Math.sin(time * 0.004 + index) > 0.85) {
          bot.y = this.scale.height - 95
        } else {
          bot.y = this.scale.height - 70
        }
      })
    }
  }

  // Handle Question Block Hit From Below
  private handleBlockHit(block: Phaser.Physics.Arcade.Sprite) {
    const data = block.getData('blockData') as QuestionBlockData | undefined
    if (!data || data.isHit) return

    // 1. Mark as hit (prevents duplicate rewards)
    data.isHit = true
    block.setData('blockData', data)

    // 2. Play Block Bounce Animation
    const origY = block.y
    this.tweens.add({
      targets: block,
      y: origY - 14,
      duration: 80,
      yoyo: true,
      ease: 'Quad.easeOut',
      onComplete: () => {
        block.y = origY
        // Turn into deactivated empty metal/stone block state [·]
        block.setTint(0x64748b)
        const sym = block.getData('symText') as Phaser.GameObjects.Text | undefined
        if (sym) {
          sym.setText('·').setColor('#94a3b8')
        }
      },
    })

    // 3. Spawn floating reward coin/star popping out
    soundManager.play('coin')
    const reward = this.add.sprite(block.x, block.y - 20, data.type === 'challenge' ? 'game-star' : 'coin-anim')
      .setScale(data.type === 'challenge' ? 1.5 : 2.5)
      .setDepth(10)

    if (data.type !== 'challenge') {
      reward.play('coin-spin')
    }

    this.tweens.add({
      targets: reward,
      y: reward.y - 48,
      alpha: 0,
      duration: 520,
      ease: 'Quad.easeOut',
      onComplete: () => reward.destroy(),
    })

    // 4. Emit event to React integration layer
    const eventPayload: BlockHitEvent = {
      blockId: data.id,
      blockType: data.type,
      points: data.points,
    }
    this.events.emit('game:block-hit', eventPayload)
  }

  private createPlayerContainer(name: string, tintColor: number, x: number, y: number): Phaser.GameObjects.Container {
    const sprite = this.add.sprite(0, 0, 'dude').setScale(1.2)
    sprite.setTint(tintColor)
    sprite.play('dude-right')

    const labelBg = this.add.rectangle(0, -36, Math.max(54, name.length * 9), 20, 0x0f172a, 0.9)
      .setStrokeStyle(1.5, 0xfacc15)
    const labelText = this.add.text(0, -36, name, {
      fontFamily: "'Fredoka', sans-serif",
      fontSize: '12px',
      color: '#f8fafc',
      fontStyle: 'bold',
    }).setOrigin(0.5)

    const container = this.add.container(x, y, [sprite, labelBg, labelText]).setDepth(7)
    return container
  }

  private updateRemotePlayers(players: SyncedPlayer[], height: number) {
    const liveIds = new Set(players.map((p) => p.id))
    for (const [id, container] of this.remotePlayers) {
      if (!liveIds.has(id)) {
        container.destroy()
        this.remotePlayers.delete(id)
      }
    }

    const colorMap: Record<string, number> = {
      red: 0xef4444,
      green: 0x22c55e,
      pink: 0xec4899,
      blue: 0x3b82f6,
      yellow: 0xeab308,
    }

    players.forEach((player, i) => {
      let container = this.remotePlayers.get(player.id)
      if (!container) {
        const tint = colorMap[player.character] ?? 0xef4444
        container = this.createPlayerContainer(player.name || `Player ${i + 1}`, tint, 140 + i * 80, height - 70)
        this.remotePlayers.set(player.id, container)
      }

      const sprite = container.getAt(0) as Phaser.GameObjects.Sprite
      const targetX = player.x !== undefined && player.x > 0 ? player.x : 140 + i * 90
      const targetY = player.y !== undefined && player.y > 0 ? player.y : height - 70

      container.x = Phaser.Math.Linear(container.x, targetX, 0.3)
      container.y = Phaser.Math.Linear(container.y, targetY, 0.3)

      if (sprite && sprite.anims) {
        if (player.direction !== undefined && player.direction < 0) {
          sprite.anims.play('dude-left', true)
        } else if (player.direction !== undefined && player.direction > 0) {
          sprite.anims.play('dude-right', true)
        } else {
          sprite.anims.play('dude-turn', true)
        }
      }
    })
  }

  private drawNeuschwanstein(x: number, y: number) {
    const g = this.add.graphics().setDepth(2)
    g.fillStyle(0xe2e8f0).fillRect(x - 55, y, 110, 115)
    g.fillStyle(0x334155).fillRect(x - 55, y + 10, 110, 4)
    g.fillStyle(0x1e3a8a).fillTriangle(x - 65, y, x - 35, y - 85, x - 5, y)
    g.fillTriangle(x - 15, y, x + 20, y - 110, x + 55, y)
    g.fillTriangle(x + 35, y + 20, x + 65, y - 60, x + 95, y + 20)
    g.fillStyle(0xcbd5e1).fillRect(x - 65, y - 10, 30, 125).fillRect(x + 35, y + 10, 30, 105)
    g.fillStyle(0x78350f).fillRect(x - 14, y + 75, 28, 40)

    const flag = this.add.container(x + 20, y - 120).setDepth(3)
    const fBlack = this.add.rectangle(12, -7, 24, 5, 0x000000)
    const fRed = this.add.rectangle(12, -2, 24, 5, 0xdd1f31)
    const fGold = this.add.rectangle(12, 3, 24, 5, 0xffd431)
    const pole = this.add.rectangle(0, 0, 3, 24, 0x475569)
    flag.add([pole, fBlack, fRed, fGold])
    this.tweens.add({ targets: [fBlack, fRed, fGold], scaleX: 0.8, duration: 450, yoyo: true, repeat: -1 })
  }

  private drawHouse(x: number, y: number) {
    const g = this.add.graphics().setDepth(3)
    g.fillStyle(0xfef3c7).fillRect(x - 65, y - 40, 130, 80)
    g.fillStyle(0x451a03)
      .fillRect(x - 65, y - 40, 8, 80)
      .fillRect(x + 57, y - 40, 8, 80)
      .fillRect(x - 65, y - 4, 130, 8)
      .fillRect(x - 4, y - 40, 8, 80)
    g.fillStyle(0x991b1b).fillTriangle(x - 80, y - 40, x, y - 95, x + 80, y - 40)
    g.fillStyle(0x38bdf8).fillRect(x - 48, y - 28, 24, 20).fillRect(x + 24, y - 28, 24, 20)
    g.lineStyle(2, 0x451a03).strokeRect(x - 48, y - 28, 24, 20).strokeRect(x + 24, y - 28, 24, 20)
    this.add.rectangle(x, y + 18, 24, 44, 0x78350f).setStrokeStyle(2, 0x451a03).setDepth(4)
  }
}

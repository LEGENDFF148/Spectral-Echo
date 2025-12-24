class SpectralEcho extends Phaser.Scene {
  constructor() {
    super('SpectralEcho')
    this.baseAlpha = 0.05
    this.pulseRadius = 40
    this.pingRadius = 0
    this.pingActive = false
    this.lightColors = [0x00ffff, 0xff00ff, 0xffff00]
    this.currentLightColor = 0
  }

  preload() {}

  create() {
    this.cameras.main.setBackgroundColor('#050505')
    this.cursors = this.input.keyboard.createCursorKeys()
    this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE)
    this.selectKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S)
    this.muteKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.M)
    this.musicKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.N)
    this.enterKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER)
    this.dashKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT)
    this.colorKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.C)
    this.stealthKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.CTRL)
    this.decoyKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Z)
    this.fullVisibility = false
    this.lastWallHitAt = 0
    this.lastDashAt = 0
    this.heartbeatNextAt = 0
    this.slowMoEndTime = 0
    this.slowMoCooldown = 0
    this.decoy = null
    this.decoyCooldown = 0
    this.score = 0
    this.levelStartScore = 0

    this.createTextures()
    this.createWorldLayer()
    this.audio = new SynthAudio()
    this.createBackground()
    this.levels = this.generateLevels(12)
    this.levelIndex = 0
    this.buildLevel(this.levelIndex)
    this.createPlayer()
    this.createUI()
    this.createLevelSelectUI()
    this.createDashUI()
    this.createParticles()
    this.createCollisions()

    this.pingGraphics = this.add.graphics()
    this.noiseGraphics = this.add.graphics().setDepth(12)
    this.createStartScreen()
  }

  createBackground() {
    this.bgGraphics = this.add.graphics().setDepth(-5)
    if (this.lightMask) this.bgGraphics.setMask(this.lightMask)
    this.playerTrail = []
    this.dangerIntensity = 0
  }

  updateBackground() {
    this.bgGraphics.clear()
    this.bgGraphics.lineStyle(1, 0x1a1a2e, 0.15)
    const spacing = 60
    for (let x = 0; x <= 800; x += spacing) {
      this.bgGraphics.moveTo(x, 0); this.bgGraphics.lineTo(x, 600)
    }
    for (let y = 0; y <= 600; y += spacing) {
      this.bgGraphics.moveTo(0, y); this.bgGraphics.lineTo(800, y)
    }
    this.bgGraphics.strokePath()

    for (let i = this.playerTrail.length - 1; i >= 0; i--) {
      const t = this.playerTrail[i]
      t.life -= this.physics.world.timeScale
      this.bgGraphics.fillStyle(this.lightColors[this.currentLightColor], t.life / 20 * 0.4)
      this.bgGraphics.fillCircle(t.x, t.y, 8 * (t.life / 20))
      if (t.life <= 0) this.playerTrail.splice(i, 1)
    }
  }

  generateLevels(count) {
    const levels = []
    for (let i = 0; i < count; i++) {
      const walls = []
      walls.push({ x: 400, y: 90, w: 700, h: 12 })
      walls.push({ x: 400, y: 510, w: 700, h: 12 })
      walls.push({ x: 90, y: 300, w: 12, h: 460 })
      walls.push({ x: 710, y: 300, w: 12, h: 460 })

      const cols = 6
      const rows = 4
      const cellW = 100
      const cellH = 100
      const startX = 100
      const startY = 100

      const visited = Array(rows).fill(0).map(() => Array(cols).fill(false))
      const vWalls = Array(rows).fill(0).map(() => Array(cols - 1).fill(true))
      const hWalls = Array(rows - 1).fill(0).map(() => Array(cols).fill(true))

      const stack = [{ r: 0, c: 0 }]
      visited[0][0] = true

      while (stack.length > 0) {
        const curr = stack[stack.length - 1]
        const neighbors = []
        if (curr.r > 0 && !visited[curr.r - 1][curr.c]) neighbors.push({ r: curr.r - 1, c: curr.c, dir: 'U' })
        if (curr.r < rows - 1 && !visited[curr.r + 1][curr.c]) neighbors.push({ r: curr.r + 1, c: curr.c, dir: 'D' })
        if (curr.c > 0 && !visited[curr.r][curr.c - 1]) neighbors.push({ r: curr.r, c: curr.c - 1, dir: 'L' })
        if (curr.c < cols - 1 && !visited[curr.r][curr.c + 1]) neighbors.push({ r: curr.r, c: curr.c + 1, dir: 'R' })

        if (neighbors.length > 0) {
          const next = neighbors[Phaser.Math.Between(0, neighbors.length - 1)]
          if (next.dir === 'U') hWalls[curr.r - 1][curr.c] = false
          if (next.dir === 'D') hWalls[curr.r][curr.c] = false
          if (next.dir === 'L') vWalls[curr.r][curr.c - 1] = false
          if (next.dir === 'R') vWalls[curr.r][curr.c] = false
          visited[next.r][next.c] = true
          stack.push(next)
        } else {
          stack.pop()
        }
      }

      for (let r = 0; r < rows - 1; r++) {
        for (let c = 0; c < cols - 1; c++) {
          if (Math.random() < 0.15) {
            if (Math.random() > 0.5) hWalls[r][c] = false
            else vWalls[r][c] = false
          }
        }
      }

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols - 1; c++) {
          if (vWalls[r][c]) walls.push({ x: startX + (c + 1) * cellW, y: startY + r * cellH + cellH / 2, w: 12, h: cellH + 12 })
        }
      }
      for (let r = 0; r < rows - 1; r++) {
        for (let c = 0; c < cols; c++) {
          if (hWalls[r][c]) walls.push({ x: startX + c * cellW + cellW / 2, y: startY + (r + 1) * cellH, w: cellW + 12, h: 12 })
        }
      }

      const start = i % 2 === 0 ? { x: 150, y: 450 } : { x: 150, y: 150 }
      const goal = i % 2 === 0 ? { x: 650, y: 150 } : { x: 650, y: 450 }

      const patrols = []
      const patrolCount = i === 0 ? 0 : 1 + Math.floor((i - 1) / 2)
      let attempts = 0
      while (patrols.length < patrolCount && attempts < 50) {
        attempts++
        const r = Phaser.Math.Between(0, rows - 1)
        const c = Phaser.Math.Between(0, cols - 1)
        const cx = startX + c * cellW + cellW / 2
        const cy = startY + r * cellH + cellH / 2
        if (Phaser.Math.Distance.Between(cx, cy, start.x, start.y) > 250) {
          patrols.push({ x: cx, y: cy, minX: cx - 40, maxX: cx + 40, speed: 35 + i * 3 })
        }
      }
      levels.push({ start, goal, walls, patrols })
    }
    return levels
  }

  createTextures() {
    const g = this.make.graphics({ x: 0, y: 0, add: false })

    const playerSize = 96
    g.clear()
    for (let i = 0; i < 6; i++) {
      g.fillStyle(0x00ffff, 0.08 - i * 0.01)
      g.fillCircle(playerSize / 2, playerSize / 2, 24 + i * 12)
    }
    g.fillStyle(0x00ffff, 1)
    g.fillCircle(playerSize / 2, playerSize / 2, 14)
    g.generateTexture('player', playerSize, playerSize)

    const glowSize = 192
    g.clear()
    for (let i = 0; i < 8; i++) {
      g.fillStyle(0x00ffff, 0.06 - i * 0.006)
      g.fillCircle(glowSize / 2, glowSize / 2, 28 + i * 18)
    }
    g.generateTexture('playerGlow', glowSize, glowSize)
    const ringSize = 80
    g.clear()
    g.lineStyle(3, 0x00ffff, 0.8)
    g.strokeCircle(ringSize / 2, ringSize / 2, 30)
    g.generateTexture('ring', ringSize, ringSize)

    g.clear()
    g.fillStyle(0x333333, 1)
    g.fillRect(0, 0, 16, 16)
    g.generateTexture('wall', 16, 16)

    g.clear()
    g.fillStyle(0xffff00, 1)
    g.fillCircle(12, 12, 10)
    g.generateTexture('goalCircle', 24, 24)

    const t = 32
    g.clear()
    g.lineStyle(2, 0xffffff, 1)
    g.beginPath()
    g.moveTo(t / 2, 2)
    g.lineTo(t - 2, t - 2)
    g.lineTo(2, t - 2)
    g.closePath()
    g.strokePath()
    g.beginPath()
    g.moveTo(10, 14); g.lineTo(15, 18)
    g.moveTo(22, 14); g.lineTo(17, 18)
    g.strokePath()
    g.generateTexture('sentinel', t, t)
    const eg = 160
    g.clear()
    for (let i = 0; i < 8; i++) {
      g.fillStyle(0xffffff, 0.05 + i * 0.01)
      g.fillCircle(eg / 2, eg / 2, 14 + i * 10)
    }
    g.generateTexture('enemyGlow', eg, eg)

    const p = 6
    g.clear()
    g.fillStyle(0x00ffff, 1)
    g.fillCircle(p / 2, p / 2, p / 2)
    g.generateTexture('spark', p, p)
    const kSize = 24
    g.clear()
    g.lineStyle(3, 0x00ffff, 1)
    g.strokeRect(4, 6, 12, 12)
    g.fillStyle(0x00ffff, 1)
    g.fillRect(12, 12, 8, 4)
    g.generateTexture('key', kSize, kSize)
  }

  createWorldLayer() {
    this.worldLayer = this.add.container(0, 0)
    this.maskGraphics = this.make.graphics({ x: 0, y: 0, add: false })
    this.lightMask = this.maskGraphics.createGeometryMask()
    this.worldLayer.setMask(this.lightMask)
    this.lightTint = this.add.graphics({ x: 0, y: 0 })
    this.lightTint.setDepth(11)
  }

  createArena() {
    if (!this.walls) this.walls = this.physics.add.staticGroup()
    const segments = this.levels[this.levelIndex].walls
    this.walls.clear(true, true)
    segments.forEach(s => {
      const wall = this.physics.add.staticImage(s.x, s.y, 'wall')
      wall.setDisplaySize(s.w, s.h)
      wall.refreshBody()
      this.walls.add(wall)
      this.worldLayer.add(wall)
    })
  }

  createPlayer() {
    const start = this.levels[this.levelIndex].start
    this.player = this.physics.add.sprite(start.x, start.y, 'player')
    this.player.setDamping(true)
    this.player.setDrag(0.88)
    this.player.setMaxVelocity(260, 260)
    this.player.setCollideWorldBounds(true)
    this.player.setDisplaySize(24, 24)
    this.player.setCircle(9, 39, 39)
    this.playerGlow = this.add.image(this.player.x, this.player.y, 'playerGlow')
    this.playerGlow.setAlpha(0.4)
    this.playerGlow.setDepth(1)
    this.playerGlow.setTint(this.lightColors[this.currentLightColor])
    this.worldLayer.add(this.player)
  }

  createEnemies() {
    if (!this.enemies) this.enemies = this.physics.add.group()
    this.enemies.clear(true, true)
    const patrols = this.levels[this.levelIndex].patrols
    patrols.forEach(p => {
      const e = this.physics.add.sprite(p.x, p.y, 'sentinel')
      e.setDepth(2)
      e.patrol = { minX: p.minX, maxX: p.maxX, speed: p.speed, dir: 1 }
      e.alertUntil = 0
      e.alertSpeed = p.speed * 1.25
      if (Phaser.Math.Between(0, 100) < 50) {
        e.visibleColor = Phaser.Math.Between(0, this.lightColors.length - 1)
      }
      this.enemies.add(e)
      this.worldLayer.add(e)
      const glow = this.add.image(e.x, e.y, 'enemyGlow')
      glow.setDepth(1)
      glow.setAlpha(0.2)
      if (typeof e.visibleColor === 'number') {
        glow.setTint(this.lightColors[e.visibleColor])
      }
      e.glow = glow
      this.worldLayer.add(glow)
    })
  }

  createGoal() {
    const g = this.levels[this.levelIndex].goal
    if (this.goal) this.goal.destroy()
    if (this.goalGlow) this.goalGlow.destroy()
    this.goal = this.physics.add.staticImage(g.x, g.y, 'goalCircle').setTint(0xffff00)
    this.goalGlow = this.add.image(this.goal.x, this.goal.y, 'playerGlow')
    this.goalGlow.setTint(0xffff00)
    this.goalGlow.setAlpha(0.18)
    this.goalGlow.setScale(0.6)
    this.goalGlow.setDepth(0)
    this.worldLayer.add(this.goal)
    this.tweens.add({ targets: this.goalGlow, scale: { from: 0.55, to: 0.7 }, alpha: { from: 0.12, to: 0.22 }, duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
    this.createKeys()
  }

  createKeys() {
    if (!this.keys) this.keys = this.physics.add.staticGroup()
    if (!this.keyGlows) this.keyGlows = this.add.group()
    this.keys.clear(true, true)
    this.keyGlows.clear(true, true)
    this.keysCollected = 0
    const needed = Math.min(3, 1 + Math.floor(this.levelIndex / 2))
    this.keysNeeded = needed
    const area = [{ x: 150, y: 150 }, { x: 650, y: 150 }, { x: 150, y: 450 }, { x: 650, y: 450 }, { x: 350, y: 150 }, { x: 450, y: 450 }]
    Phaser.Utils.Array.Shuffle(area)
    const picks = area.slice(0, needed)
    picks.forEach(pos => {
      const k = this.physics.add.staticImage(pos.x, pos.y, 'key')
      k.setAlpha(0)
      const glow = this.add.image(pos.x, pos.y, 'playerGlow')
      glow.setTint(0x00ffff)
      glow.setAlpha(0)
      glow.setScale(0.5)
      glow.setDepth(0)
      k.glow = glow
      this.keyGlows.add(glow)
      this.worldLayer.add(glow)
      this.keys.add(k)
      this.worldLayer.add(k)
    })
  }

  buildLevel(index) {
    this.levelIndex = index
    this.slowMoEndTime = 0
    this.levelStartTime = this.time.now
    this.levelStartScore = this.score
    this.physics.world.timeScale = 1.0
    this.createArena()
    this.createEnemies()
    this.createGoal()
    this.uiText && this.uiText.setText('REACH THE LIGHT — LEVEL ' + (this.levelIndex + 1) + '/' + this.levels.length)
    if (this.player) {
      const start = this.levels[this.levelIndex].start
      this.player.setPosition(start.x, start.y)
      this.player.setVelocity(0, 0)
      this.pulseRadius = 0
      this.pingRadius = 0
    }
    if (this.decoy) {
      this.decoy.destroy()
      this.decoy = null
    }
  }

  createUI() {
    this.uiText = this.add.text(20, 16, 'REACH THE LIGHT', {
      fontFamily: 'Orbitron, Rajdhani, monospace',
      fontSize: 22,
      color: '#ffffff'
    }).setAlpha(0.85).setDepth(20)

    this.scoreText = this.add.text(780, 16, 'SCORE: 0', {
      fontFamily: 'Orbitron, Rajdhani, monospace',
      fontSize: 22,
      color: '#ffffff'
    }).setOrigin(1, 0).setAlpha(0.85).setDepth(20)

    this.winText = this.add.text(400, 260, 'VOID ESCAPED', {
      fontFamily: 'Orbitron, Rajdhani, monospace',
      fontSize: 48,
      color: '#ffffff'
    }).setOrigin(0.5).setAlpha(0).setDepth(20)
    this.restartText = this.add.text(400, 320, 'Click to Restart', {
      fontFamily: 'Orbitron, Rajdhani, monospace',
      fontSize: 18,
      color: '#ffffff'
    }).setOrigin(0.5).setAlpha(0).setDepth(20)
    this.levelCompleteText = this.add.text(400, 300, 'LEVEL COMPLETE', {
      fontFamily: 'Orbitron, Rajdhani, monospace',
      fontSize: 32,
      color: '#00ffff'
    }).setOrigin(0.5).setAlpha(0).setDepth(20)
  }

  createDashUI() {
    this.dashBar = this.add.graphics()
    this.dashBar.setDepth(21)
  }

  createLevelSelectUI() {
    const bg = this.add.graphics().setDepth(30)
    bg.fillStyle(0x000000, 0.8)
    bg.fillRect(0, 0, 800, 600)
    const title = this.add.text(400, 120, 'SPECTRAL ECHO', {
      fontFamily: 'Orbitron, Rajdhani, monospace',
      fontSize: 40,
      color: '#00ffff'
    }).setOrigin(0.5).setDepth(31)
    const subtitle = this.add.text(400, 170, 'SELECT LEVEL', {
      fontFamily: 'Orbitron, Rajdhani, monospace',
      fontSize: 18,
      color: '#ffffff'
    }).setOrigin(0.5).setDepth(31)
    const items = []
    for (let i = 0; i < this.levels.length; i++) {
      const btn = this.add.text(400, 230 + i * 60, `LEVEL ${i + 1}`, {
        fontFamily: 'Orbitron, Rajdhani, monospace',
        fontSize: 24,
        color: '#ffffff',
        backgroundColor: '#0a0a0a',
        padding: { left: 10, right: 10, top: 6, bottom: 6 }
      }).setOrigin(0.5).setDepth(31).setInteractive({ useHandCursor: true })
      btn.on('pointerover', () => this.tweens.add({ targets: btn, scale: { from: btn.scale, to: 1.08 }, duration: 140, ease: 'Quad.easeOut' }))
      btn.on('pointerout', () => this.tweens.add({ targets: btn, scale: { from: btn.scale, to: 1 }, duration: 140, ease: 'Quad.easeOut' }))
      btn.on('pointerup', () => {
        this.menuContainer.setVisible(false)
        this.physics.world.resume()
        this.buildLevel(i)
        this.createCollisions()
      })
      items.push(btn)
    }
    const hint = this.add.text(400, 230 + this.levels.length * 60, 'Press S to toggle Level Select', {
      fontFamily: 'Orbitron, Rajdhani, monospace',
      fontSize: 16,
      color: '#aaaaaa'
    }).setOrigin(0.5).setDepth(31)
    this.menuContainer = this.add.container(0, 0, [bg, title, subtitle, ...items, hint]).setDepth(30)
    this.menuContainer.setVisible(false)
  }

  createStartScreen() {
    const bg = this.add.graphics().setDepth(40)
    bg.fillStyle(0x000000, 0.55)
    bg.fillRect(0, 0, 800, 600)
    bg.lineStyle(2, 0x00ffff, 0.6)
    bg.strokeRect(10, 10, 780, 580)
    const glow = this.add.image(400, 200, 'playerGlow').setDepth(40)
    glow.setAlpha(0.18)
    glow.setScale(1.2)
    const title = this.add.text(400, 200, 'SPECTRAL ECHO', {
      fontFamily: 'Orbitron, Rajdhani, monospace',
      fontSize: 52,
      color: '#00ffff'
    }).setOrigin(0.5).setDepth(41)
    this.tweens.add({ targets: title, y: { from: 198, to: 202 }, duration: 1000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
    this.tweens.add({ targets: title, alpha: { from: 0.9, to: 1 }, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
    const sub = this.add.text(400, 260, 'Click to Start', {
      fontFamily: 'Orbitron, Rajdhani, monospace',
      fontSize: 22,
      color: '#ffffff'
    }).setOrigin(0.5).setDepth(41)
    const tips = this.add.text(400, 320, 'Arrows move • SPACE ping • SHIFT dash • CTRL stealth • Z decoy', {
      fontFamily: 'Orbitron, Rajdhani, monospace',
      fontSize: 14,
      color: '#aaaaaa',
      wordWrap: { width: 620 }
    }).setOrigin(0.5).setDepth(41)
    this.startContainer = this.add.container(0, 0, [bg, title, sub, tips]).setDepth(40)
    this.startContainer.setVisible(true)
    this.startContainer.setSize(800, 600)
    this.startContainer.setInteractive(new Phaser.Geom.Rectangle(0, 0, 800, 600), Phaser.Geom.Rectangle.Contains)
    this.startContainer.once('pointerup', () => this.beginStart())
    this.input.once('pointerdown', () => { if (this.startContainer.visible) this.beginStart() })
    this.physics.world.pause()
  }

  beginStart() {
    this.audio.ensure()
    this.audio.startMusic()
    this.startContainer.setVisible(false)
    this.levelStartTime = this.time.now
    this.menuContainer.setVisible(true)
    this.physics.world.resume()
  }

  createParticles() {
    this.hitEmitter = this.add.particles(0, 0, 'spark', {
      speed: { min: 60, max: 140 },
      lifespan: { min: 300, max: 700 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.7, end: 0 },
      alpha: { start: 1, end: 0 },
      quantity: 10,
      blendMode: Phaser.BlendModes.ADD,
      on: false
    })
    this.pingEmitter = this.add.particles(0, 0, 'spark', {
      speed: { min: 80, max: 160 },
      lifespan: { min: 350, max: 800 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.8, end: 0 },
      alpha: { start: 0.9, end: 0 },
      quantity: 16,
      blendMode: Phaser.BlendModes.ADD,
      on: false
    })
    this.ambientEmitter = this.add.particles(0, 0, 'spark', {
      x: { min: 0, max: 800 },
      y: { min: 0, max: 600 },
      lifespan: 4000,
      speed: { min: 5, max: 15 },
      scale: { start: 0.4, end: 0 },
      alpha: { start: 0.3, end: 0 },
      frequency: 100,
      blendMode: Phaser.BlendModes.ADD,
      on: false
    })
    this.ambientEmitter.start()
  }

  createCollisions() {
    if (this.playerWallsCollider) this.playerWallsCollider.destroy()
    if (this.playerEnemiesOverlap) this.playerEnemiesOverlap.destroy()
    if (this.playerGoalOverlap) this.playerGoalOverlap.destroy()
    if (this.playerKeysOverlap) this.playerKeysOverlap.destroy()
    if (this.enemyWallsCollider) this.enemyWallsCollider.destroy()
    this.enemyWallsCollider = this.physics.add.collider(this.enemies, this.walls)
    this.playerWallsCollider = this.physics.add.collider(this.player, this.walls, () => {
      this.hitEmitter.explode(10, this.player.x, this.player.y)
      this.pulseRadius = Math.max(this.pulseRadius, 180)
      const now = this.time.now
      const speed = this.player.body.speed
      if (speed > 60 && now - this.lastWallHitAt > 150) {
        const intensity = Phaser.Math.Clamp(speed / 260, 0.1, 1)
        this.audio.playWallHit(intensity)
        this.lastWallHitAt = now
      }
    })
    this.playerEnemiesOverlap = this.physics.add.overlap(this.player, this.enemies, () => {
      this.audio.playFail()
      this.cameras.main.shake(300, 0.02)
      this.score = this.levelStartScore
      this.scoreText.setText('SCORE: ' + this.score)
      this.buildLevel(this.levelIndex)
      this.createCollisions()
    })
    this.playerKeysOverlap = this.physics.add.overlap(this.player, this.keys, (player, key) => {
      if (!key.collected) {
        key.collected = true
        key.setVisible(false)
        if (key.glow) key.glow.setVisible(false)
        this.keysCollected++
        this.score += 100
        this.scoreText.setText('SCORE: ' + this.score)
        this.audio.tone(1200, 0.12, 'square', 0.18)
      }
    })
    this.playerGoalOverlap = this.physics.add.overlap(this.player, this.goal, () => {
      if (this.keysCollected < this.keysNeeded) {
        this.levelCompleteText.setText('COLLECT KEYS FIRST')
        this.levelCompleteText.setAlpha(1)
        this.tweens.add({ targets: this.levelCompleteText, alpha: { from: 1, to: 0 }, duration: 700, ease: 'Quad.easeOut' })
        return
      }
      const timeTaken = (this.time.now - this.levelStartTime) / 1000
      const timeBonus = Math.max(0, Math.floor((60 - timeTaken) * 10))
      this.score += 200 + timeBonus
      this.scoreText.setText('SCORE: ' + this.score)
      if (this.levelIndex + 1 < this.levels.length) {
        this.levelCompleteText.setAlpha(1)
        this.tweens.add({ targets: this.levelCompleteText, alpha: { from: 1, to: 0 }, duration: 800, ease: 'Quad.easeOut' })
        this.buildLevel(this.levelIndex + 1)
        this.createCollisions()
        this.audio.playGoal()
      } else {
        this.physics.pause()
        this.winText.setText('VOID ESCAPED\nSCORE: ' + this.score)
        this.winText.setAlpha(1)
        this.restartText.setAlpha(0.9)
        this.audio.playGoal()
        this.input.once('pointerdown', () => {
          this.physics.resume()
          this.score = 0
          this.scoreText.setText('SCORE: 0')
          this.buildLevel(0)
          this.player.setPosition(this.levels[0].start.x, this.levels[0].start.y)
          this.player.setVelocity(0, 0)
          this.winText.setAlpha(0)
          this.restartText.setAlpha(0)
          this.createCollisions()
        })
      }
    })
  }

  update(time, delta) {
    const isStealth = this.stealthKey.isDown
    const accel = isStealth ? 800 : 2400
    this.player.setMaxVelocity(isStealth ? 120 : 260)
    let ax = 0
    let ay = 0
    if (this.cursors.left.isDown) ax = -accel
    else if (this.cursors.right.isDown) ax = accel
    if (this.cursors.up.isDown) ay = -accel
    else if (this.cursors.down.isDown) ay = accel
    this.player.setAcceleration(ax, ay)
    if (!this.cursors.left.isDown && !this.cursors.right.isDown) this.player.setAccelerationX(0)
    if (!this.cursors.up.isDown && !this.cursors.down.isDown) this.player.setAccelerationY(0)

    let closestDist = Infinity
    this.enemies.children.iterate(e => {
      if (e && e.active) {
        const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, e.x, e.y)
        if (d < closestDist) closestDist = d
      }
    })

    if (closestDist < 140 && time > this.slowMoCooldown && time > this.slowMoEndTime) {
      this.slowMoEndTime = time + 1500
      this.slowMoCooldown = time + 8000
      this.audio.sweep(100, 50, 0.5, 'sawtooth', 0.2)
    }

    const targetTimeScale = (time < this.slowMoEndTime) ? 0.4 : 1.0
    const currentScale = this.physics.world.timeScale
    const step = 4.0 * (delta / 1000)
    if (Math.abs(targetTimeScale - currentScale) <= step) this.physics.world.timeScale = targetTimeScale
    else this.physics.world.timeScale += Math.sign(targetTimeScale - currentScale) * step

    const dt = delta * this.physics.world.timeScale

    if (this.dashBar) {
      this.dashBar.clear()
      const diff = time - this.lastDashAt
      if (diff < 600) {
        this.dashBar.fillStyle(0x00ffff, 0.8)
        this.dashBar.fillRect(this.player.x - 12, this.player.y + 20, 24 * (diff / 600), 3)
      }
    }

    this.updateBackground()
    const speed = this.player.body.velocity.length()
    if (speed > 10) {
      const noise = isStealth ? 40 + speed * 0.2 : 180 + speed * 1.1
      const target = Math.min(520, noise)
      this.pulseRadius = Phaser.Math.Linear(this.pulseRadius, target, 0.2)
      this.playerGlow.setAlpha(0.55)
    } else {
      this.pulseRadius = Phaser.Math.Linear(this.pulseRadius, 20, 0.2)
      this.playerGlow.setAlpha(0.18)
    }
    if (speed > 20) {
      this.playerTrail.push({ x: this.player.x, y: this.player.y, life: 15 })
    }

    this.noiseGraphics.clear()
    if (this.pulseRadius > 30) {
      const color = this.lightColors[this.currentLightColor]
      this.noiseGraphics.lineStyle(1, color, 0.2)
      this.noiseGraphics.strokeCircle(this.player.x, this.player.y, this.pulseRadius)
      const count = 3
      for (let i = 0; i < count; i++) {
        const p = ((time / 600) + i / count) % 1
        const r = p * this.pulseRadius
        const a = 0.3 * (1 - p)
        this.noiseGraphics.lineStyle(1, color, a)
        this.noiseGraphics.strokeCircle(this.player.x, this.player.y, r)
      }
    }

    if (Phaser.Input.Keyboard.JustDown(this.decoyKey)) {
      if (time > this.decoyCooldown && !this.decoy) {
        this.spawnDecoy(time)
      }
    }
    if (this.decoy) {
      if (time > this.decoy.endTime) {
        this.decoy.destroy()
        this.decoy = null
      } else {
        this.decoy.setAlpha(0.4 + 0.2 * Math.sin(time * 0.015))
        if (time > this.decoy.nextPing) {
          this.alertEnemies(time, this.decoy.x, this.decoy.y, this.decoy)
          this.pingEmitter.explode(8, this.decoy.x, this.decoy.y)
          this.decoy.nextPing = time + 800
        }
      }
    }
    if (Phaser.Input.Keyboard.JustDown(this.colorKey)) {
      this.currentLightColor = (this.currentLightColor + 1) % this.lightColors.length
    }

    if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
      this.pingActive = true
      this.pingRadius = 50
      this.audio.playPing()
      this.pingEmitter.explode(14, this.player.x, this.player.y)
      this.alertEnemies(time, this.player.x, this.player.y, this.player)
    }
    if (Phaser.Input.Keyboard.JustDown(this.dashKey)) {
      const now = this.time.now
      if (now - this.lastDashAt > 600) {
        const dir = new Phaser.Math.Vector2(this.player.body.velocity.x, this.player.body.velocity.y)
        if (dir.length() < 1) {
          if (this.cursors.left.isDown) dir.x = -1
          else if (this.cursors.right.isDown) dir.x = 1
          if (this.cursors.up.isDown) dir.y = -1
          else if (this.cursors.down.isDown) dir.y = 1
        }
        dir.normalize().scale(280)
        this.player.setVelocity(this.player.body.velocity.x + dir.x, this.player.body.velocity.y + dir.y)
        this.cameras.main.shake(100, 0.005)
        this.audio.playDash()
        this.pulseRadius = Math.max(this.pulseRadius, 360)
        this.pingEmitter.explode(18, this.player.x, this.player.y)
        this.alertEnemies(time, this.player.x, this.player.y, this.player)
        this.lastDashAt = now
      }
    }
    if (this.pingActive) {
      this.pingRadius += 560 * (dt / 1000)
      const fade = Phaser.Math.Clamp(1 - this.pingRadius / 1200, 0, 1)
      this.pingGraphics.clear()
      this.pingGraphics.lineStyle(3, 0x00ffff, fade)
      this.pingGraphics.strokeCircle(this.player.x, this.player.y, this.pingRadius)
      if (fade <= 0) {
        this.pingActive = false
        this.pingGraphics.clear()
        this.pingRadius = 0
      }
    }

    this.playerGlow.setPosition(this.player.x, this.player.y)
    const glowScale = Phaser.Math.Clamp(this.pulseRadius / 160, 0.2, 1.4)
    this.playerGlow.setScale(glowScale)

    const r = Math.max(this.pulseRadius, this.pingRadius)
    this.drawLightMask(r)
    this.updateHeartbeat(time)
    this.goalGlow.setAlpha(0.12 + 0.25 * Phaser.Math.Clamp(1 - Phaser.Math.Distance.Between(this.player.x, this.player.y, this.goal.x, this.goal.y) / Math.max(r,1), 0, 1))

    let chasing = false
    this.enemies.children.iterate(e => {
      if (!e) return
      if (e.glow) e.glow.setPosition(e.x, e.y)
      
      const dist = Phaser.Math.Distance.Between(e.x, e.y, this.player.x, this.player.y)
      const detectionRange = isStealth ? 70 : 170
      if (dist < detectionRange) {
        if (this.checkLineOfSight(e)) {
          e.alertUntil = time + 1000
          e.alertTarget = this.player
        }
      }

      if (e.alertUntil > time) {
        chasing = true
        const target = (e.alertTarget && e.alertTarget.active) ? e.alertTarget : this.player
        this.physics.moveTo(e, target.x, target.y, e.alertSpeed)
        e.setTint(0xff0000)
        if (e.glow) e.glow.setTint(0xff0000)
      } else {
        e.clearTint()
        if (e.body.blocked.right) e.patrol.dir = -1
        else if (e.body.blocked.left) e.patrol.dir = 1
        if (e.x >= e.patrol.maxX && e.patrol.dir === 1) e.patrol.dir = -1
        else if (e.x <= e.patrol.minX && e.patrol.dir === -1) e.patrol.dir = 1
        e.setVelocityX(e.patrol.speed * e.patrol.dir)
        e.setVelocityY(0)
      }
    })

    this.dangerIntensity = Phaser.Math.Linear(this.dangerIntensity, chasing ? 1 : 0, 0.1)

    if (Phaser.Input.Keyboard.JustDown(this.selectKey)) {
      const vis = !this.menuContainer.visible
      this.menuContainer.setVisible(vis)
      if (vis) this.physics.world.pause()
      else this.physics.world.resume()
    }
    if (Phaser.Input.Keyboard.JustDown(this.enterKey) && this.startContainer?.visible) {
      this.beginStart()
    }
    if (Phaser.Input.Keyboard.JustDown(this.muteKey)) {
      this.audio.setMute(!this.audio.muted)
    }
    if (Phaser.Input.Keyboard.JustDown(this.musicKey)) {
      if (this.audio.musicPlaying) this.audio.stopMusic()
      else { this.audio.ensure(); this.audio.startMusic() }
    }
  }

  checkLineOfSight(e) {
    const line = new Phaser.Geom.Line(e.x, e.y, this.player.x, this.player.y)
    let blocked = false
    this.walls.children.iterate(w => {
      if (blocked || !w) return
      if (Phaser.Geom.Intersects.LineToRectangle(line, w.getBounds())) {
        blocked = true
      }
    })
    return !blocked
  }

  drawLightMask(radius) {
    this.maskGraphics.clear()
    this.lightTint.clear()

    if (this.startContainer && this.startContainer.visible) {
      this.maskGraphics.fillStyle(0xffffff)
      this.maskGraphics.fillRect(0, 0, 800, 600)
      this.walls.children.iterate(w => { if (w) w.setAlpha(1) })
      this.enemies.children.iterate(e => { if (e) e.setAlpha(1) })
      if (this.keys) this.keys.children.iterate(k => {
        if (k && !k.collected) {
          k.setAlpha(1)
          if (k.glow) k.glow.setAlpha(0.4)
        }
      })
      return
    }
    if (this.fullVisibility) {
      this.maskGraphics.fillStyle(0xffffff)
      this.maskGraphics.fillRect(0, 0, 800, 600)
      this.walls.children.iterate(w => { if (w) w.setAlpha(1) })
      this.enemies.children.iterate(e => { if (e) e.setAlpha(1) })
      if (this.keys) this.keys.children.iterate(k => {
        if (k && !k.collected) {
          k.setAlpha(1)
          if (k.glow) k.glow.setAlpha(0.4)
        }
      })
      return
    }

    this.maskGraphics.fillStyle(0xffffff)
    this.maskGraphics.fillCircle(this.player.x, this.player.y, radius)

    const baseColor = this.lightColors[this.currentLightColor]
    const dangerColor = Phaser.Display.Color.Interpolate.ColorWithColor(
      Phaser.Display.Color.IntegerToColor(baseColor),
      Phaser.Display.Color.IntegerToColor(0xff0000),
      100, this.dangerIntensity * 80
    )
    const finalColor = Phaser.Display.Color.GetColor(dangerColor.r, dangerColor.g, dangerColor.b)
    this.playerGlow.setTint(finalColor)

    for (let i = 0; i < 4; i++) {
      const a = 0.14 - i * 0.03
      const r = radius * (1 - i * 0.22)
      if (a > 0 && r > 2) {
        this.lightTint.fillStyle(finalColor, a)
        this.lightTint.fillCircle(this.player.x, this.player.y, r)
      }
    }
    
    this.walls.children.iterate(w => { if (w) w.setAlpha(1) })
    this.enemies.children.iterate(e => {
      if (!e) return
      const chasing = e.alertUntil > this.time.now
      const match = typeof e.visibleColor !== 'number' || e.visibleColor === this.currentLightColor || chasing
      e.setAlpha(match ? 1 : 0)
      if (e.glow) {
        e.glow.setAlpha(match ? 0.3 : 0)
        if (typeof e.visibleColor === 'number') e.glow.setTint(this.lightColors[e.visibleColor])
      }
    })
    if (this.keys) this.keys.children.iterate(k => { if (k && !k.collected) k.setAlpha(1) })
  }

  spawnDecoy(time) {
    this.decoy = this.physics.add.image(this.player.x, this.player.y, 'playerGlow')
    this.decoy.setTint(0x00ff00)
    this.decoy.setScale(0.6)
    this.decoy.setDepth(5)
    this.worldLayer.add(this.decoy)
    this.decoy.endTime = time + 4000
    this.decoy.nextPing = 0
    this.decoyCooldown = time + 10000
    this.audio.tone(600, 0.1, 'sine', 0.1)
  }

  alertEnemies(time, x, y, target) {
    this.enemies.children.iterate(e => {
      if (!e) return
      if (Phaser.Math.Distance.Between(x, y, e.x, e.y) < 300) {
        e.alertUntil = time + 2500
        e.alertTarget = target
      }
    })
  }

  updateHeartbeat(time) {
    let minD = Infinity
    this.enemies.children.iterate(e => {
      if (!e) return
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, e.x, e.y)
      minD = Math.min(minD, d)
    })
    if (!isFinite(minD)) return
    const bpm = Phaser.Math.Clamp(60 + (600 - Math.min(600, minD)) * 0.12, 60, 150)
    if (time >= this.heartbeatNextAt) {
      this.audio.playHeartbeat()
      this.heartbeatNextAt = time + (60000 / bpm)
    }
  }
}

class SynthAudio {
  constructor() {
    this.ctx = null
    this.masterGain = null
    this.muted = false
    this.musicPlaying = false
    this.musicTimer = null
  }
  ensure() {
    if (!this.ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext
      this.ctx = new Ctx()
      this.masterGain = this.ctx.createGain()
      this.masterGain.gain.value = 0.6
      this.masterGain.connect(this.ctx.destination)
    }
    if (this.ctx.state === 'suspended') this.ctx.resume()
  }
  setMute(m) {
    this.muted = m
    if (this.masterGain) this.masterGain.gain.value = m ? 0 : 0.6
  }
  tone(freq, dur = 0.2, type = 'sine', vol = 0.2) {
    if (!this.ctx || this.muted) return
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime)
    gain.gain.value = 0
    osc.connect(gain)
    gain.connect(this.masterGain)
    const t = this.ctx.currentTime
    gain.gain.linearRampToValueAtTime(vol, t + 0.05)
    gain.gain.linearRampToValueAtTime(0, t + dur)
    osc.start(t)
    osc.stop(t + dur + 0.05)
  }
  sweep(f1, f2, dur = 0.3, type = 'sawtooth', vol = 0.18) {
    if (!this.ctx || this.muted) return
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(f1, this.ctx.currentTime)
    osc.frequency.linearRampToValueAtTime(f2, this.ctx.currentTime + dur)
    gain.gain.value = 0
    osc.connect(gain)
    gain.connect(this.masterGain)
    const t = this.ctx.currentTime
    gain.gain.linearRampToValueAtTime(vol, t + 0.05)
    gain.gain.linearRampToValueAtTime(0, t + dur)
    osc.start(t)
    osc.stop(t + dur + 0.05)
  }
  startMusic() {
    if (this.musicPlaying) return
    this.ensure()
    this.musicPlaying = true
    let step = 0
    const sequence = [196, 233, 261, 311, 261, 233]
    this.musicTimer = setInterval(() => {
      if (this.muted) return
      if (step % 4 === 0) {
        this.tone(65, 3.0, 'triangle', 0.08)
        this.tone(130, 3.0, 'sine', 0.04)
      }
      const note = sequence[step % sequence.length]
      this.tone(note, 0.8, 'sine', 0.05)
      if (Math.random() > 0.6) this.tone(note * 1.5, 1.0, 'sine', 0.03)
      step++
    }, 800)
  }
  stopMusic() {
    if (this.musicTimer) clearInterval(this.musicTimer)
    this.musicTimer = null
    this.musicPlaying = false
  }
  playPing() { this.ensure(); this.tone(880, 0.15, 'sine', 0.18) }
  playHit() { this.ensure(); this.sweep(600, 300, 0.18, 'square', 0.16) }
  playFail() { this.ensure(); this.sweep(300, 120, 0.35, 'sawtooth', 0.18) }
  playGoal() { this.ensure(); this.tone(660, 0.15, 'sine', 0.2); setTimeout(()=>this.tone(990,0.2,'sine',0.22),120) }
  playWallHit(intensity = 0.5) {
    this.ensure()
    if (this.muted) return
    intensity = Math.max(0.1, Math.min(1, intensity))
    const base = 120 + 220 * intensity
    const dur = 0.06 + 0.14 * intensity
    this.tone(base, dur, 'sine', 0.12 * intensity)
    setTimeout(() => this.tone(base * 2.2, 0.04, 'triangle', 0.06 * intensity), 10)
  }
  playDash() { this.ensure(); this.sweep(220, 440, 0.18, 'triangle', 0.24) }
  playHeartbeat() { this.ensure(); this.tone(80, 0.06, 'sine', 0.1); setTimeout(()=>this.tone(80,0.05,'sine',0.08),120) }
}
const config = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  parent: 'game',
  backgroundColor: '#050505',
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 0 },
      debug: false
    }
  },
  scene: [SpectralEcho]
}

window.addEventListener('load', () => {
  new Phaser.Game(config)
})

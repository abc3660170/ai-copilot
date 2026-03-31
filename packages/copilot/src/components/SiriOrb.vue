<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import type { CopilotStatus } from '../types'

const props = withDefaults(
  defineProps<{
    status?: CopilotStatus
    size?: number
  }>(),
  {
    status: 'idle',
    size: 64,
  },
)

const canvasRef = ref<HTMLCanvasElement | null>(null)
let animationId = 0
let startTime = 0
let currentSpeed = 1.0
let currentErrorMix = 0.0

// ---- 状态参数 ----
function getSpeedTarget(status: CopilotStatus): number {
  switch (status) {
    case 'thinking': return 2.2
    case 'streaming': return 3.5
    case 'error': return 1.5
    default: return 1.0
  }
}

function getBreathe(status: CopilotStatus, t: number): number {
  switch (status) {
    case 'thinking': return 1 + 0.04 * Math.sin(t * 2.5)
    case 'streaming': return 1 + 0.02 * Math.sin(t * 1.2)
    case 'error': return 1 + 0.06 * Math.sin(t * 5)
    default: return 1 + 0.025 * Math.sin(t * 0.8)
  }
}

function getGlowIntensity(status: CopilotStatus): number {
  switch (status) {
    case 'thinking': return 1.3
    case 'streaming': return 1.6
    case 'error': return 1.1
    default: return 1.0
  }
}

// ---- 波形配置 ----
interface WaveConfig {
  amplitude: number
  frequency: number
  phaseSpeed: number
  phaseOffset: number
  colorR: number; colorG: number; colorB: number
  glowR: number; glowG: number; glowB: number
  errR: number; errG: number; errB: number
  width: number
  opacity: number
}

const waveConfigs: WaveConfig[] = [
  {
    // 波 1：品红/粉紫 —— 主波
    amplitude: 0.6, frequency: 0.9, phaseSpeed: 0.8, phaseOffset: 0,
    colorR: 220, colorG: 50, colorB: 220,
    glowR: 255, glowG: 100, glowB: 255,
    errR: 220, errG: 60, errB: 50,
    width: 0.6, opacity: 0.92,
  },
  {
    // 波 2：青蓝 —— 不对称偏移，非均分
    amplitude: 0.55, frequency: 1.05, phaseSpeed: 0.7, phaseOffset: Math.PI * 0.65,
    colorR: 50, colorG: 190, colorB: 255,
    glowR: 100, glowG: 220, glowB: 255,
    errR: 255, errG: 120, errB: 50,
    width: 0.5, opacity: 0.85,
  },
  {
    // 波 3：淡紫白 —— 辅助
    amplitude: 0.42, frequency: 1.15, phaseSpeed: 0.9, phaseOffset: Math.PI * 1.35,
    colorR: 170, colorG: 130, colorB: 255,
    glowR: 200, glowG: 170, glowB: 255,
    errR: 255, errG: 80, errB: 80,
    width: 0.35, opacity: 0.55,
  },
]

// ---- 绘制 ----
function draw(ctx: CanvasRenderingContext2D, w: number, h: number, time: number) {
  const speed = currentSpeed
  const t = time * speed
  const cx = w / 2
  const cy = h / 2
  const r = props.size / 2
  const breathe = getBreathe(props.status, t)
  const br = r * breathe
  const glowInt = getGlowIntensity(props.status)
  const errMix = currentErrorMix

  ctx.clearRect(0, 0, w, h)

  // ==== 1. 球体底部辉光 ====
  {
    const grad = ctx.createRadialGradient(cx, cy + br * 0.35, br * 0.05, cx, cy + br * 0.35, br * 1.2)
    const aBase = 0.12 * glowInt
    if (errMix > 0.5) {
      grad.addColorStop(0, `rgba(255, 70, 40, ${aBase})`)
    } else {
      grad.addColorStop(0, `rgba(200, 40, 200, ${aBase})`)
    }
    grad.addColorStop(0.5, 'rgba(60, 20, 100, 0.03)')
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, w, h)
  }

  // ==== 2. 球形裁剪 + 深色底 ====
  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, br, 0, Math.PI * 2)
  ctx.clip()

  {
    const grad = ctx.createRadialGradient(cx - br * 0.12, cy - br * 0.15, 0, cx, cy, br)
    grad.addColorStop(0, 'rgba(25, 18, 55, 0.4)')
    grad.addColorStop(0.5, 'rgba(12, 8, 35, 0.65)')
    grad.addColorStop(1, 'rgba(5, 3, 18, 0.85)')
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.arc(cx, cy, br, 0, Math.PI * 2)
    ctx.fill()
  }

  // ==== 3. 绘制波形 ====
  for (const wc of waveConfigs) {
    drawWave(ctx, cx, cy, br, t, wc, glowInt, errMix)
  }

  // ==== 4. 交叉辉光 ====
  drawCrossGlow(ctx, cx, cy, br, t, glowInt, errMix)

  ctx.restore()

  // ==== 5. 玻璃球壳 ====
  drawGlass(ctx, cx, cy, br, t, errMix)
}

function drawWave(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, r: number,
  t: number, wc: WaveConfig,
  glowInt: number, errMix: number,
) {
  const SEGS = 120
  const baseAmp = wc.amplitude * r
  const baseW = wc.width * r
  const phase = t * wc.phaseSpeed + wc.phaseOffset

  // 颜色
  const cR = Math.round(wc.colorR * (1 - errMix) + wc.errR * errMix)
  const cG = Math.round(wc.colorG * (1 - errMix) + wc.errG * errMix)
  const cB = Math.round(wc.colorB * (1 - errMix) + wc.errB * errMix)
  const gR = Math.round(wc.glowR * (1 - errMix) + wc.errR * errMix)
  const gG = Math.round(wc.glowG * (1 - errMix) + wc.errG * errMix)
  const gB = Math.round(wc.glowB * (1 - errMix) + wc.errB * errMix)

  // 收集上/下边沿点
  const topArr: number[] = []
  const botArr: number[] = []
  const xs: number[] = []
  const centerYs: number[] = []

  for (let i = 0; i <= SEGS; i++) {
    const frac = i / SEGS
    const x = cx - r + frac * 2 * r
    const dx = (x - cx) / r // -1..1
    if (Math.abs(dx) > 0.995) continue

    const circleHalf = Math.sqrt(1 - dx * dx) * r

    // ==== 核心改动：振幅沿 x 轴变化，不是固定高度 ====
    // 用多个不同频率的 sin 叠加做振幅调制（包络线）
    const ampEnvelope = 0.5
      + 0.3 * Math.sin(dx * Math.PI * 0.7 + wc.phaseOffset * 0.3 + t * 0.15)
      + 0.2 * Math.sin(dx * Math.PI * 1.4 - wc.phaseOffset * 0.5 + t * 0.1)
    const localAmp = baseAmp * Math.max(0.15, ampEnvelope)

    // 波形：低频大弧度正弦
    const waveY = localAmp * Math.sin(dx * Math.PI * wc.frequency + phase)

    // 宽度也随振幅包络变化 —— 振幅大的地方带子更宽，小的地方窄
    const edgeFade = Math.pow(1 - dx * dx, 0.35) // 球边缘收窄
    const widthEnvelope = 0.6 + 0.4 * Math.max(0, ampEnvelope)
    const localW = baseW * edgeFade * widthEnvelope

    const tY = Math.min(circleHalf, Math.max(-circleHalf, waveY + localW))
    const bY = Math.min(circleHalf, Math.max(-circleHalf, waveY - localW))

    xs.push(x)
    centerYs.push(waveY)
    topArr.push(tY)
    botArr.push(bY)
  }

  if (xs.length < 3) return

  // 画填充形状的闭合路径辅助函数
  function tracePath() {
    ctx.beginPath()
    ctx.moveTo(xs[0], cy - topArr[0])
    for (let i = 1; i < xs.length; i++) ctx.lineTo(xs[i], cy - topArr[i])
    for (let i = xs.length - 1; i >= 0; i--) ctx.lineTo(xs[i], cy - botArr[i])
    ctx.closePath()
  }

  // ---- 辉光层（大模糊阴影） ----
  ctx.save()
  ctx.globalCompositeOperation = 'screen'
  ctx.shadowBlur = r * 0.35 * glowInt
  ctx.shadowColor = `rgba(${gR}, ${gG}, ${gB}, ${wc.opacity * 0.5 * glowInt})`
  ctx.globalAlpha = wc.opacity * 0.45

  tracePath()

  const grad = ctx.createLinearGradient(cx - r, 0, cx + r, 0)
  grad.addColorStop(0, `rgba(${cR}, ${cG}, ${cB}, 0)`)
  grad.addColorStop(0.1, `rgba(${cR}, ${cG}, ${cB}, ${wc.opacity * 0.5})`)
  grad.addColorStop(0.5, `rgba(${cR}, ${cG}, ${cB}, ${wc.opacity})`)
  grad.addColorStop(0.9, `rgba(${cR}, ${cG}, ${cB}, ${wc.opacity * 0.5})`)
  grad.addColorStop(1, `rgba(${cR}, ${cG}, ${cB}, 0)`)
  ctx.fillStyle = grad
  ctx.fill()
  ctx.restore()

  // ---- 实体填充层 ----
  ctx.save()
  ctx.globalCompositeOperation = 'screen'
  ctx.globalAlpha = wc.opacity * 0.55

  tracePath()

  const maxSpan = baseAmp + baseW
  const vGrad = ctx.createLinearGradient(0, cy - maxSpan, 0, cy + maxSpan)
  vGrad.addColorStop(0, `rgba(${cR}, ${cG}, ${cB}, 0.05)`)
  vGrad.addColorStop(0.25, `rgba(${cR}, ${cG}, ${cB}, 0.5)`)
  vGrad.addColorStop(0.5, `rgba(${Math.min(255, cR + 60)}, ${Math.min(255, cG + 60)}, ${Math.min(255, cB + 60)}, 0.85)`)
  vGrad.addColorStop(0.75, `rgba(${cR}, ${cG}, ${cB}, 0.5)`)
  vGrad.addColorStop(1, `rgba(${cR}, ${cG}, ${cB}, 0.05)`)
  ctx.fillStyle = vGrad
  ctx.fill()
  ctx.restore()

  // ---- 中心亮线 ----
  ctx.save()
  ctx.globalCompositeOperation = 'screen'
  ctx.globalAlpha = wc.opacity * 0.7
  ctx.lineWidth = 2.5
  ctx.shadowBlur = r * 0.1 * glowInt
  ctx.shadowColor = `rgba(${gR}, ${gG}, ${gB}, 0.7)`

  const lineGrad = ctx.createLinearGradient(cx - r, 0, cx + r, 0)
  lineGrad.addColorStop(0, 'rgba(255, 255, 255, 0)')
  lineGrad.addColorStop(0.12, 'rgba(255, 255, 255, 0.45)')
  lineGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.8)')
  lineGrad.addColorStop(0.88, 'rgba(255, 255, 255, 0.45)')
  lineGrad.addColorStop(1, 'rgba(255, 255, 255, 0)')
  ctx.strokeStyle = lineGrad

  ctx.beginPath()
  let started = false
  for (let i = 0; i < xs.length; i++) {
    const py = cy - centerYs[i]
    if (!started) { ctx.moveTo(xs[i], py); started = true }
    else ctx.lineTo(xs[i], py)
  }
  ctx.stroke()
  ctx.restore()
}

// 计算某条波在 dx 处的实际 waveY（含变化振幅）
function getWaveY(wc: WaveConfig, r: number, dx: number, t: number): number {
  const baseAmp = wc.amplitude * r
  const phase = t * wc.phaseSpeed + wc.phaseOffset
  const ampEnvelope = 0.5
    + 0.3 * Math.sin(dx * Math.PI * 0.7 + wc.phaseOffset * 0.3 + t * 0.15)
    + 0.2 * Math.sin(dx * Math.PI * 1.4 - wc.phaseOffset * 0.5 + t * 0.1)
  const localAmp = baseAmp * Math.max(0.15, ampEnvelope)
  return localAmp * Math.sin(dx * Math.PI * wc.frequency + phase)
}

function drawCrossGlow(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, r: number,
  t: number, glowInt: number, errMix: number,
) {
  const w1 = waveConfigs[0]
  const w2 = waveConfigs[1]

  for (let i = 0; i <= 50; i++) {
    const dx = -0.92 + (i / 50) * 1.84
    const y1 = getWaveY(w1, r, dx, t)
    const y2 = getWaveY(w2, r, dx, t)
    const diff = Math.abs(y1 - y2)
    const thresh = r * 0.25

    if (diff < thresh) {
      const inten = Math.pow(1 - diff / thresh, 2) * 0.65 * glowInt
      const x = cx + dx * r
      const y = cy - (y1 + y2) / 2
      const glowR = r * 0.2 * (0.5 + inten * 0.5)

      ctx.save()
      ctx.globalCompositeOperation = 'screen'
      const grad = ctx.createRadialGradient(x, y, 0, x, y, glowR)
      const baseCol = errMix > 0.5 ? '255, 160, 100' : '230, 210, 255'
      grad.addColorStop(0, `rgba(${baseCol}, ${inten * 0.9})`)
      grad.addColorStop(0.3, `rgba(${baseCol}, ${inten * 0.4})`)
      grad.addColorStop(0.7, `rgba(${baseCol}, ${inten * 0.1})`)
      grad.addColorStop(1, `rgba(${baseCol}, 0)`)
      ctx.fillStyle = grad
      ctx.fillRect(x - glowR, y - glowR, glowR * 2, glowR * 2)
      ctx.restore()
    }
  }
}

function drawGlass(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, r: number,
  t: number, errMix: number,
) {
  // 菲涅尔边缘光
  const edgeGrad = ctx.createRadialGradient(cx, cy, r * 0.78, cx, cy, r * 1.01)
  edgeGrad.addColorStop(0, 'rgba(80, 110, 200, 0)')
  edgeGrad.addColorStop(0.6, 'rgba(80, 110, 200, 0)')
  edgeGrad.addColorStop(0.85, 'rgba(100, 140, 230, 0.1)')
  edgeGrad.addColorStop(0.95, 'rgba(120, 165, 250, 0.25)')
  edgeGrad.addColorStop(1, 'rgba(140, 185, 255, 0.4)')
  ctx.fillStyle = edgeGrad
  ctx.beginPath()
  ctx.arc(cx, cy, r * 1.01, 0, Math.PI * 2)
  ctx.fill()

  // 球壳描边
  const edgeA = 0.35 + 0.08 * Math.sin(t * 1.5)
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.strokeStyle = `rgba(120, 155, 235, ${edgeA})`
  ctx.lineWidth = 1.5
  ctx.stroke()

  // 外光圈
  ctx.beginPath()
  ctx.arc(cx, cy, r + 2, 0, Math.PI * 2)
  ctx.strokeStyle = `rgba(90, 120, 200, ${edgeA * 0.2})`
  ctx.lineWidth = 2.5
  ctx.stroke()

  // 左上高光
  const hlX = cx - r * 0.3
  const hlY = cy - r * 0.33
  const hlGrad = ctx.createRadialGradient(hlX, hlY, 0, hlX, hlY, r * 0.38)
  hlGrad.addColorStop(0, 'rgba(255, 255, 255, 0.5)')
  hlGrad.addColorStop(0.25, 'rgba(255, 255, 255, 0.18)')
  hlGrad.addColorStop(0.6, 'rgba(255, 255, 255, 0.03)')
  hlGrad.addColorStop(1, 'rgba(255, 255, 255, 0)')
  ctx.fillStyle = hlGrad
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fill()

  // 右下小高光
  const hl2X = cx + r * 0.38
  const hl2Y = cy + r * 0.32
  const hl2Grad = ctx.createRadialGradient(hl2X, hl2Y, 0, hl2X, hl2Y, r * 0.12)
  hl2Grad.addColorStop(0, 'rgba(200, 215, 255, 0.35)')
  hl2Grad.addColorStop(0.5, 'rgba(200, 215, 255, 0.08)')
  hl2Grad.addColorStop(1, 'rgba(200, 215, 255, 0)')
  ctx.fillStyle = hl2Grad
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fill()

  // 底部品红反射
  const btGrad = ctx.createRadialGradient(cx, cy + r * 0.5, 0, cx, cy + r * 0.5, r * 0.45)
  const btC = errMix > 0.5 ? '255, 70, 40' : '190, 40, 170'
  btGrad.addColorStop(0, `rgba(${btC}, 0.18)`)
  btGrad.addColorStop(0.5, `rgba(${btC}, 0.05)`)
  btGrad.addColorStop(1, `rgba(${btC}, 0)`)
  ctx.fillStyle = btGrad
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fill()
}

function animate() {
  const canvas = canvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const elapsed = (performance.now() - startTime) / 1000

  // 平滑过渡
  const targetSpeed = getSpeedTarget(props.status)
  currentSpeed += (targetSpeed - currentSpeed) * 0.03
  const targetError = props.status === 'error' ? 1.0 : 0.0
  currentErrorMix += (targetError - currentErrorMix) * 0.05

  const dpr = window.devicePixelRatio || 1
  const cw = canvas.width / dpr
  const ch = canvas.height / dpr

  ctx.save()
  ctx.scale(dpr, dpr)
  draw(ctx, cw, ch, elapsed)
  ctx.restore()

  animationId = requestAnimationFrame(animate)
}

function setupCanvas() {
  const canvas = canvasRef.value
  if (!canvas) return

  const dpr = window.devicePixelRatio || 1
  const displaySize = props.size * 1.3
  canvas.width = Math.round(displaySize * dpr)
  canvas.height = Math.round(displaySize * dpr)
  canvas.style.width = `${displaySize}px`
  canvas.style.height = `${displaySize}px`
}

onMounted(() => {
  startTime = performance.now()
  setupCanvas()
  animate()
})

onUnmounted(() => {
  cancelAnimationFrame(animationId)
})

watch(
  () => props.size,
  () => setupCanvas(),
)
</script>

<template>
  <div class="siri-orb" :class="status">
    <canvas ref="canvasRef" class="siri-canvas" />
  </div>
</template>

<style scoped>
.siri-orb {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.siri-orb:hover {
  transform: scale(1.12);
}

.siri-orb:active {
  transform: scale(0.95);
}

.siri-canvas {
  display: block;
}
</style>

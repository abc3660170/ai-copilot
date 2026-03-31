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
let lastFrameTime = 0
let accumulatedTime = 0
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
  /** 流向：1 正向，-1 反向，0 表示中途反转 */
  direction: number
  colorR: number; colorG: number; colorB: number
  glowR: number; glowG: number; glowB: number
  errR: number; errG: number; errB: number
  width: number
  opacity: number
}

const waveConfigs: WaveConfig[] = [
  {
    // 波 1：品红/粉紫 —— 主波，正向流动
    amplitude: 0.42, frequency: 0.9, phaseSpeed: 0.8, phaseOffset: 0,
    direction: 1,
    colorR: 220, colorG: 50, colorB: 220,
    glowR: 255, glowG: 100, glowB: 255,
    errR: 220, errG: 60, errB: 50,
    width: 0.6, opacity: 0.92,
  },
  {
    // 波 2：青蓝 —— 反向流动
    amplitude: 0.38, frequency: 1.05, phaseSpeed: 0.7, phaseOffset: Math.PI * 0.65,
    direction: -1,
    colorR: 50, colorG: 190, colorB: 255,
    glowR: 100, glowG: 220, glowB: 255,
    errR: 255, errG: 120, errB: 50,
    width: 0.5, opacity: 0.85,
  },
  {
    // 波 3：群青色 —— 反向流动，慢速
    amplitude: 0.3, frequency: 0.85, phaseSpeed: 0.65, phaseOffset: Math.PI * 1.35,
    direction: -1,
    colorR: 30, colorG: 70, colorB: 200,
    glowR: 60, glowG: 100, glowB: 240,
    errR: 255, errG: 80, errB: 80,
    width: 0.35, opacity: 0.55,
  },
]

// ---- 绘制 ----
function draw(ctx: CanvasRenderingContext2D, w: number, h: number, time: number) {
  const t = time // 已经是累积加速后的时间
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

  // ==== 6. 卫星光点（仅 thinking / streaming 状态） ====
  drawSatellites(ctx, cx, cy, br, t, props.status)
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

    // ==== 边缘归零：丝带入口/出口中心一定在 Y 轴垂直居中 ====
    // smoothstep 让 |dx| 在 0.7~1.0 区间平滑归零
    const edgeClamp = dx * dx // 0 at center, 1 at edge
    const edgeZero = edgeClamp < 0.49 ? 1.0
      : edgeClamp > 0.95 ? 0.0
      : (0.95 - edgeClamp) / (0.95 - 0.49) // linear 0.7~0.975 range in |dx|
    const edgeZeroSmooth = edgeZero * edgeZero * (3 - 2 * edgeZero) // smoothstep

    // 振幅包络（中间变化丰富，两端归零）
    const ampEnvelope = 0.5
      + 0.3 * Math.sin(dx * Math.PI * 0.7 + wc.phaseOffset * 0.3 + t * 0.15)
      + 0.2 * Math.sin(dx * Math.PI * 1.4 - wc.phaseOffset * 0.5 + t * 0.1)
    const localAmp = baseAmp * Math.max(0.15, ampEnvelope) * edgeZeroSmooth

    // ==== 流向计算 ====
    let effectivePhase: number
    if (wc.direction === 0) {
      // 中途反转：左半球正向，右半球反向，中间平滑过渡
      const blend = 0.5 + 0.5 * Math.tanh(dx * 3.5) // -1→0, 0→0.5, 1→1
      const phaseForward = dx * Math.PI * wc.frequency + phase
      const phaseReverse = -dx * Math.PI * wc.frequency + phase * 1.3
      effectivePhase = phaseForward * (1 - blend) + phaseReverse * blend
    } else {
      effectivePhase = dx * Math.PI * wc.frequency * wc.direction + phase
    }

    const waveY = localAmp * Math.sin(effectivePhase)

    // 宽度也随振幅包络变化 + 边缘归零
    const edgeFade = Math.pow(1 - dx * dx, 0.35)
    const widthEnvelope = 0.6 + 0.4 * Math.max(0, ampEnvelope)
    const localW = baseW * edgeFade * widthEnvelope * edgeZeroSmooth

    // ==== 中心对称：上下边沿各自有独立的波形偏移 ====
    // 上边沿向上凸起多一点，下边沿向下凸起多一点
    // 用额外的小幅 sin 做上下边沿的独立起伏
    const edgeWobble = localW * 0.35 * Math.sin(dx * Math.PI * wc.frequency * 1.7 + phase * 0.6 + wc.phaseOffset * 2.0) * edgeZeroSmooth
    const topOffset = waveY + localW + edgeWobble
    const botOffset = waveY - localW + edgeWobble
    // 镜像：上边沿用 +wobble，下边沿用 -wobble → 中心对称
    const tY = Math.min(circleHalf, Math.max(-circleHalf, waveY + localW + edgeWobble))
    const bY = Math.min(circleHalf, Math.max(-circleHalf, waveY - localW - edgeWobble))

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

// 计算某条波在 dx 处的实际 waveY（含变化振幅 + 边缘归零 + 方向）
function getWaveY(wc: WaveConfig, r: number, dx: number, t: number): number {
  const baseAmp = wc.amplitude * r
  const phase = t * wc.phaseSpeed + wc.phaseOffset

  const edgeClamp = dx * dx
  const edgeZero = edgeClamp < 0.49 ? 1.0
    : edgeClamp > 0.95 ? 0.0
    : (0.95 - edgeClamp) / (0.95 - 0.49)
  const edgeZeroSmooth = edgeZero * edgeZero * (3 - 2 * edgeZero)

  const ampEnvelope = 0.5
    + 0.3 * Math.sin(dx * Math.PI * 0.7 + wc.phaseOffset * 0.3 + t * 0.15)
    + 0.2 * Math.sin(dx * Math.PI * 1.4 - wc.phaseOffset * 0.5 + t * 0.1)
  const localAmp = baseAmp * Math.max(0.15, ampEnvelope) * edgeZeroSmooth

  let effectivePhase: number
  if (wc.direction === 0) {
    const blend = 0.5 + 0.5 * Math.tanh(dx * 3.5)
    const phaseForward = dx * Math.PI * wc.frequency + phase
    const phaseReverse = -dx * Math.PI * wc.frequency + phase * 1.3
    effectivePhase = phaseForward * (1 - blend) + phaseReverse * blend
  } else {
    effectivePhase = dx * Math.PI * wc.frequency * wc.direction + phase
  }

  return localAmp * Math.sin(effectivePhase)
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

let _fresnelOffCvs: HTMLCanvasElement | null = null

function drawGlass(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, r: number,
  t: number, errMix: number,
) {
  // 颜色过渡：error 状态变红
  const eR = Math.round(100 + 60 * errMix)   // 100→160
  const eG = Math.round(150 - 80 * errMix)    // 150→70
  const eB = Math.round(240 - 160 * errMix)   // 240→80
  const eR2 = Math.round(180 + 75 * errMix)   // 180→255
  const eG2 = Math.round(215 - 130 * errMix)  // 215→85
  const eB2 = Math.round(255 - 175 * errMix)  // 255→80

  // 光源旋转角度（匀速）
  const rotAngle = t * 0.4
  const cosRot = Math.cos(rotAngle)
  const sinRot = Math.sin(rotAngle)

  // ---- 1. 球体明暗底色（随光源旋转） ----
  {
    const lx = -0.5 * cosRot + 0.5 * sinRot   // 光源方向（左上偏移旋转）
    const ly = -0.5 * sinRot - 0.5 * cosRot
    const lightGrad = ctx.createLinearGradient(
      cx + r * lx, cy + r * ly,
      cx - r * lx * 0.6, cy - r * ly * 0.6,
    )
    lightGrad.addColorStop(0, 'rgba(60, 55, 110, 0.15)')
    lightGrad.addColorStop(0.35, 'rgba(30, 25, 70, 0.08)')
    lightGrad.addColorStop(0.65, 'rgba(12, 10, 40, 0.2)')
    lightGrad.addColorStop(1, 'rgba(5, 3, 20, 0.45)')
    ctx.fillStyle = lightGrad
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.fill()
  }

  // ---- 2. 内部环境反射（偏心径向，随光源旋转） ----
  {
    const envOx = -0.2 * cosRot + 0.15 * sinRot
    const envOy = -0.2 * sinRot - 0.15 * cosRot
    const envGrad = ctx.createRadialGradient(
      cx + r * envOx, cy + r * envOy, r * 0.02,
      cx + r * 0.05 * cosRot, cy + r * 0.05 * sinRot, r,
    )
    envGrad.addColorStop(0, 'rgba(50, 45, 100, 0.06)')
    envGrad.addColorStop(0.3, 'rgba(25, 22, 60, 0.03)')
    envGrad.addColorStop(0.7, 'rgba(12, 10, 35, 0.15)')
    envGrad.addColorStop(1, 'rgba(5, 3, 18, 0.35)')
    ctx.fillStyle = envGrad
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.fill()
  }

  // ---- 3 & 4. 菲涅尔边缘光 + 球壳描边（离屏绘制 + 旋转渐变遮罩，完全连续） ----
  {
    // 离屏 canvas 尺寸只需覆盖球体区域（含外溢）
    const pad = r * 0.15
    const offW = Math.ceil((r + pad) * 2)
    const offH = offW
    const offCx = offW / 2
    const offCy = offH / 2

    // 复用离屏 canvas 避免每帧创建
    if (!_fresnelOffCvs || _fresnelOffCvs.width !== offW) {
      _fresnelOffCvs = document.createElement('canvas')
      _fresnelOffCvs.width = offW
      _fresnelOffCvs.height = offH
    }
    const off = _fresnelOffCvs.getContext('2d')!
    off.clearRect(0, 0, offW, offH)

    // 在离屏上绘制完整一圈菲涅尔边缘光
    for (let layer = 0; layer < 4; layer++) {
      const innerR = r * (0.65 + layer * 0.07)
      const outerR = r * (1.0 + layer * 0.004)
      const alpha = [0.45, 0.3, 0.18, 0.08][layer]
      const edgeGrad = off.createRadialGradient(offCx, offCy, innerR, offCx, offCy, outerR)
      edgeGrad.addColorStop(0, `rgba(${eR}, ${eG}, ${eB}, 0)`)
      edgeGrad.addColorStop(0.4, `rgba(${eR}, ${eG}, ${eB}, ${alpha * 0.08})`)
      edgeGrad.addColorStop(0.7, `rgba(${eR + 30}, ${eG + 30}, ${Math.min(255, eB + 15)}, ${alpha * 0.35})`)
      edgeGrad.addColorStop(0.88, `rgba(${eR2 - 20}, ${eG2}, ${Math.min(255, eB2)}, ${alpha * 0.8})`)
      edgeGrad.addColorStop(0.96, `rgba(${eR2}, ${eG2}, ${Math.min(255, eB2)}, ${alpha})`)
      edgeGrad.addColorStop(1, `rgba(${eR2}, ${Math.min(255, eG2 + 5)}, ${Math.min(255, eB2)}, ${alpha * 0.5})`)
      off.fillStyle = edgeGrad
      off.beginPath()
      off.arc(offCx, offCy, outerR, 0, Math.PI * 2)
      off.fill()
    }

    // 在离屏上绘制球壳描边
    const baseEdgeA = 0.35 + 0.08 * Math.sin(t * 1.5)
    off.beginPath()
    off.arc(offCx, offCy, r, 0, Math.PI * 2)
    off.strokeStyle = `rgba(${eR2 - 30}, ${eG2 - 30}, ${Math.min(255, eB2)}, ${baseEdgeA})`
    off.lineWidth = 1.6
    off.stroke()

    // 外发光描边
    off.shadowBlur = r * 0.12
    off.shadowColor = `rgba(${eR}, ${eG}, ${eB}, ${baseEdgeA * 0.5})`
    off.beginPath()
    off.arc(offCx, offCy, r + 1.5, 0, Math.PI * 2)
    off.strokeStyle = `rgba(${eR}, ${eG}, ${eB}, ${baseEdgeA * 0.2})`
    off.lineWidth = 2.5
    off.stroke()
    off.shadowBlur = 0
    off.shadowColor = 'transparent'

    // 用 destination-in 叠加旋转线性渐变作为 alpha 遮罩
    // 渐变方向：从光源背面（全透明）到光源正面（不透明）
    off.globalCompositeOperation = 'destination-in'
    const maskGrad = off.createLinearGradient(
      offCx + (r + pad) * cosRot, offCy + (r + pad) * sinRot,   // 光源正面方向（不透明端）
      offCx - (r + pad) * cosRot, offCy - (r + pad) * sinRot,   // 光源背面方向（透明端）
    )
    // 正面完全不透明 → 中间过渡 → 背面完全透明
    maskGrad.addColorStop(0, 'rgba(255,255,255,1)')
    maskGrad.addColorStop(0.35, 'rgba(255,255,255,0.8)')
    maskGrad.addColorStop(0.5, 'rgba(255,255,255,0.25)')
    maskGrad.addColorStop(0.65, 'rgba(255,255,255,0.03)')
    maskGrad.addColorStop(0.75, 'rgba(255,255,255,0)')
    off.fillStyle = maskGrad
    off.fillRect(0, 0, offW, offH)
    off.globalCompositeOperation = 'source-over'

    // 将离屏结果绘制到主 canvas
    ctx.drawImage(_fresnelOffCvs!, cx - offCx, cy - offCy)
  }

  // ---- 5. 主高光（随光源旋转） ----
  {
    // 高光位置跟随光源方向（距中心偏移0.38r的方向）
    const hlCx = cx + r * 0.38 * Math.cos(rotAngle + Math.PI + 0.3)
    const hlCy = cy + r * 0.38 * Math.sin(rotAngle + Math.PI + 0.3)
    ctx.save()
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.clip()

    // 大范围柔和光
    ctx.save()
    ctx.translate(hlCx, hlCy)
    ctx.rotate(rotAngle - 0.45)
    ctx.scale(1, 0.55)
    const hlSoftGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 0.5)
    hlSoftGrad.addColorStop(0, 'rgba(255, 255, 255, 0.35)')
    hlSoftGrad.addColorStop(0.3, 'rgba(230, 240, 255, 0.15)')
    hlSoftGrad.addColorStop(0.6, 'rgba(200, 220, 255, 0.04)')
    hlSoftGrad.addColorStop(1, 'rgba(200, 220, 255, 0)')
    ctx.fillStyle = hlSoftGrad
    ctx.fillRect(-r * 0.6, -r * 0.6, r * 1.2, r * 1.2)
    ctx.restore()

    // 锐利核心光斑
    ctx.save()
    ctx.translate(hlCx + r * 0.02 * cosRot, hlCy + r * 0.02 * sinRot)
    ctx.rotate(rotAngle - 0.5)
    ctx.scale(1, 0.45)
    const hlSharpGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 0.18)
    hlSharpGrad.addColorStop(0, 'rgba(255, 255, 255, 0.9)')
    hlSharpGrad.addColorStop(0.2, 'rgba(255, 255, 255, 0.6)')
    hlSharpGrad.addColorStop(0.5, 'rgba(240, 248, 255, 0.2)')
    hlSharpGrad.addColorStop(1, 'rgba(220, 235, 255, 0)')
    ctx.fillStyle = hlSharpGrad
    ctx.fillRect(-r * 0.3, -r * 0.3, r * 0.6, r * 0.6)
    ctx.restore()

    ctx.restore()
  }

  // ---- 6. 副高光（与主高光对侧，随旋转） ----
  {
    // 副高光在光源对侧偏移
    const hl2X = cx + r * 0.36 * Math.cos(rotAngle + 0.5)
    const hl2Y = cy + r * 0.36 * Math.sin(rotAngle + 0.5)
    const hl2Grad = ctx.createRadialGradient(hl2X, hl2Y, 0, hl2X, hl2Y, r * 0.09)
    hl2Grad.addColorStop(0, 'rgba(240, 245, 255, 0.65)')
    hl2Grad.addColorStop(0.3, 'rgba(220, 230, 255, 0.3)')
    hl2Grad.addColorStop(0.7, 'rgba(200, 215, 255, 0.06)')
    hl2Grad.addColorStop(1, 'rgba(200, 215, 255, 0)')
    ctx.fillStyle = hl2Grad
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.fill()
  }

  // ---- 7. 暗影加深（光源背面，随旋转） ----
  {
    // 阴影方向与光源相反
    const shX = Math.cos(rotAngle) * 0.5
    const shY = Math.sin(rotAngle) * 0.5
    const shadowGrad = ctx.createLinearGradient(
      cx - r * shX, cy - r * shY,
      cx + r * shX, cy + r * shY,
    )
    shadowGrad.addColorStop(0, 'rgba(5, 3, 20, 0)')
    shadowGrad.addColorStop(0.3, 'rgba(5, 3, 20, 0.05)')
    shadowGrad.addColorStop(0.7, 'rgba(5, 3, 20, 0.15)')
    shadowGrad.addColorStop(1, 'rgba(3, 2, 12, 0.25)')
    ctx.fillStyle = shadowGrad
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.fill()
  }

  // ---- 8. 对侧反射光（品红，随旋转） ----
  {
    // 反射在光源对面
    const btOx = Math.cos(rotAngle) * 0.45
    const btOy = Math.sin(rotAngle) * 0.45
    const btGrad = ctx.createRadialGradient(
      cx + r * btOx * 0.1, cy + r * btOy, 0,
      cx + r * btOx * 0.05, cy + r * btOy * 0.9, r * 0.5,
    )
    const btC = errMix > 0.5 ? '255, 70, 40' : '180, 50, 180'
    btGrad.addColorStop(0, `rgba(${btC}, 0.15)`)
    btGrad.addColorStop(0.4, `rgba(${btC}, 0.05)`)
    btGrad.addColorStop(1, `rgba(${btC}, 0)`)
    ctx.fillStyle = btGrad
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.fill()
  }

  // ---- 9. 环境光反射（淡青，随旋转） ----
  {
    const envOx2 = Math.cos(rotAngle + Math.PI * 0.7) * 0.35
    const envOy2 = Math.sin(rotAngle + Math.PI * 0.7) * 0.35
    const btGrad2 = ctx.createRadialGradient(
      cx + r * envOx2 - r * 0.1, cy + r * envOy2, 0,
      cx + r * envOx2 * 0.5, cy + r * envOy2 * 0.8, r * 0.35,
    )
    btGrad2.addColorStop(0, 'rgba(60, 140, 220, 0.1)')
    btGrad2.addColorStop(0.5, 'rgba(60, 120, 200, 0.04)')
    btGrad2.addColorStop(1, 'rgba(60, 120, 200, 0)')
    ctx.fillStyle = btGrad2
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.fill()
  }

  // ---- 10. 弧形反光（随旋转） ----
  {
    ctx.save()
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.clip()

    // 主弧：在光源方向附近
    const arcStart = rotAngle + Math.PI - 0.82
    const arcEnd = rotAngle + Math.PI + 0.82
    ctx.globalAlpha = 0.09 + 0.03 * Math.sin(t * 0.8)

    // 使用角度方向的线性渐变
    const ag1x = cx + r * Math.cos(arcStart)
    const ag1y = cy + r * Math.sin(arcStart)
    const ag2x = cx + r * Math.cos(arcEnd)
    const ag2y = cy + r * Math.sin(arcEnd)
    const arcGrad = ctx.createLinearGradient(ag1x, ag1y, ag2x, ag2y)
    arcGrad.addColorStop(0, `rgba(${eR2}, ${eG2}, ${Math.min(255, eB2)}, 0)`)
    arcGrad.addColorStop(0.25, `rgba(${eR2}, ${eG2}, ${Math.min(255, eB2)}, 0.4)`)
    arcGrad.addColorStop(0.5, `rgba(${Math.min(255, eR2 + 40)}, ${Math.min(255, eG2 + 15)}, ${Math.min(255, eB2)}, 0.9)`)
    arcGrad.addColorStop(0.75, `rgba(${eR2}, ${eG2}, ${Math.min(255, eB2)}, 0.4)`)
    arcGrad.addColorStop(1, `rgba(${eR2}, ${eG2}, ${Math.min(255, eB2)}, 0)`)

    ctx.strokeStyle = arcGrad
    ctx.lineWidth = r * 0.05
    ctx.beginPath()
    ctx.arc(cx, cy, r * 0.88, arcStart + 0.14, arcEnd - 0.14)
    ctx.stroke()

    // 第二条弧（更细更淡）
    ctx.globalAlpha = 0.04 + 0.015 * Math.sin(t * 0.6 + 1)
    ctx.lineWidth = r * 0.03
    ctx.beginPath()
    ctx.arc(cx, cy, r * 0.78, arcStart + 0.3, arcEnd - 0.3)
    ctx.stroke()

    ctx.restore()
  }
}

// ---- 卫星光点 ----
const SATELLITES = [
  { orbitRadius: 1.04, speed: 1.1, tilt: 0.35, phase: 0, size: 0.055 },
  { orbitRadius: 1.05, speed: -0.9, tilt: -0.6, phase: Math.PI * 0.7, size: 0.048 },
  { orbitRadius: 1.03, speed: 0.75, tilt: 1.2, phase: Math.PI * 1.4, size: 0.04 },
]

function drawSatellites(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, r: number,
  t: number, status: CopilotStatus,
) {
  // idle 和 error 状态不显示卫星
  if (status === 'idle' || status === 'error') return

  // streaming 比 thinking 稍快
  const speedMul = status === 'streaming' ? 1.35 : 1.0

  for (const sat of SATELLITES) {
    const angle = t * sat.speed * speedMul + sat.phase
    const orbitR = r * sat.orbitRadius

    // 3D 投影：圆形轨道绕一个倾斜轴
    const cosA = Math.cos(angle)
    const sinA = Math.sin(angle)
    const cosT = Math.cos(sat.tilt)
    const sinT = Math.sin(sat.tilt)

    // 旋转后的 3D 坐标
    const x3d = orbitR * cosA
    const y3d = orbitR * sinA * cosT
    const z3d = orbitR * sinA * sinT // z>0 表示在前面

    const sx = cx + x3d
    const sy = cy + y3d

    // 根据 z 调整大小和亮度（远小近大）
    const depthFactor = 0.6 + 0.4 * (z3d / orbitR + 1) / 2 // 0.6~1.0
    const dotR = r * sat.size * depthFactor
    const alpha = 0.5 + 0.5 * depthFactor

    // 在球体背后时变暗
    const behindSphere = z3d < 0 && Math.sqrt(x3d * x3d + y3d * y3d) < r * 0.92
    const finalAlpha = behindSphere ? alpha * 0.15 : alpha

    // 光点辉光
    ctx.save()
    ctx.globalCompositeOperation = 'screen'
    const glowGrad = ctx.createRadialGradient(sx, sy, 0, sx, sy, dotR * 5)
    glowGrad.addColorStop(0, `rgba(220, 230, 255, ${finalAlpha * 0.7})`)
    glowGrad.addColorStop(0.2, `rgba(190, 210, 255, ${finalAlpha * 0.35})`)
    glowGrad.addColorStop(0.5, `rgba(160, 180, 250, ${finalAlpha * 0.1})`)
    glowGrad.addColorStop(1, 'rgba(140, 160, 240, 0)')
    ctx.fillStyle = glowGrad
    ctx.fillRect(sx - dotR * 5, sy - dotR * 5, dotR * 10, dotR * 10)
    ctx.restore()

    // 光点实体
    ctx.save()
    ctx.globalCompositeOperation = 'screen'
    const dotGrad = ctx.createRadialGradient(sx, sy, 0, sx, sy, dotR)
    dotGrad.addColorStop(0, `rgba(255, 255, 255, ${finalAlpha})`)
    dotGrad.addColorStop(0.2, `rgba(245, 250, 255, ${finalAlpha * 0.9})`)
    dotGrad.addColorStop(0.5, `rgba(210, 225, 255, ${finalAlpha * 0.4})`)
    dotGrad.addColorStop(1, 'rgba(170, 195, 250, 0)')
    ctx.fillStyle = dotGrad
    ctx.beginPath()
    ctx.arc(sx, sy, dotR, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }
}

function animate() {
  const canvas = canvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const now = performance.now() / 1000
  const dt = Math.min(now - lastFrameTime, 0.05) // 限制最大帧间隔防跳变
  lastFrameTime = now

  // 平滑过渡（加快收敛速度，用 dt 归一化）
  const targetSpeed = getSpeedTarget(props.status)
  const lerpRate = 1 - Math.pow(0.02, dt) // ~0.15/帧 at 60fps
  currentSpeed += (targetSpeed - currentSpeed) * lerpRate
  const targetError = props.status === 'error' ? 1.0 : 0.0
  currentErrorMix += (targetError - currentErrorMix) * lerpRate

  // 累积时间：速度变化只影响增量，不会让整个时间轴跳变
  accumulatedTime += dt * currentSpeed

  const dpr = window.devicePixelRatio || 1
  const cw = canvas.width / dpr
  const ch = canvas.height / dpr

  ctx.save()
  ctx.scale(dpr, dpr)
  draw(ctx, cw, ch, accumulatedTime)
  ctx.restore()

  animationId = requestAnimationFrame(animate)
}

function setupCanvas() {
  const canvas = canvasRef.value
  if (!canvas) return

  const dpr = window.devicePixelRatio || 1
  const displaySize = props.size * 1.6
  canvas.width = Math.round(displaySize * dpr)
  canvas.height = Math.round(displaySize * dpr)
  canvas.style.width = `${displaySize}px`
  canvas.style.height = `${displaySize}px`
}

onMounted(() => {
  lastFrameTime = performance.now() / 1000
  accumulatedTime = 0
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

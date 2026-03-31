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

// ---- 3D 彩色圆盘参数 ----
interface Disc {
  hue: number          // 主色相
  hueRange: number     // 色相渐变范围
  saturation: number
  lightness: number
  radiusRatio: number  // 圆盘半径相对球体的比例
  tiltX: number        // X 轴初始倾斜（弧度）
  tiltY: number        // Y 轴初始倾斜
  tiltZ: number        // Z 轴初始倾斜
  spinSpeedX: number   // X 轴旋转速度
  spinSpeedY: number   // Y 轴旋转速度
  spinSpeedZ: number   // Z 轴旋转速度
  offsetY: number      // Y 轴偏移（在球内的位置）
  opacity: number
  glowBlur: number
  thickness: number    // 圆盘"厚度"感（描边宽度）
}

const discs: Disc[] = [
  // 蓝紫主盘 - 最大，缓慢旋转
  { hue: 250, hueRange: 40, saturation: 85, lightness: 65, radiusRatio: 0.85, tiltX: 0.3, tiltY: 0, tiltZ: 0, spinSpeedX: 0.2, spinSpeedY: 0.35, spinSpeedZ: 0.1, offsetY: 0, opacity: 0.8, glowBlur: 6, thickness: 2.5 },
  // 粉红盘
  { hue: 320, hueRange: 30, saturation: 80, lightness: 68, radiusRatio: 0.72, tiltX: -0.5, tiltY: 0.8, tiltZ: 0.3, spinSpeedX: -0.25, spinSpeedY: 0.3, spinSpeedZ: -0.15, offsetY: -2, opacity: 0.75, glowBlur: 5, thickness: 2 },
  // 青蓝盘
  { hue: 195, hueRange: 35, saturation: 80, lightness: 62, radiusRatio: 0.78, tiltX: 0.7, tiltY: -0.4, tiltZ: -0.2, spinSpeedX: 0.15, spinSpeedY: -0.28, spinSpeedZ: 0.2, offsetY: 3, opacity: 0.7, glowBlur: 5, thickness: 2 },
  // 橙红暖盘
  { hue: 25, hueRange: 30, saturation: 90, lightness: 63, radiusRatio: 0.65, tiltX: -0.2, tiltY: 0.6, tiltZ: 0.5, spinSpeedX: 0.3, spinSpeedY: 0.2, spinSpeedZ: -0.25, offsetY: -1, opacity: 0.65, glowBlur: 4, thickness: 1.8 },
  // 绿色盘
  { hue: 160, hueRange: 25, saturation: 75, lightness: 60, radiusRatio: 0.6, tiltX: 0.9, tiltY: 0.3, tiltZ: -0.4, spinSpeedX: -0.18, spinSpeedY: -0.35, spinSpeedZ: 0.12, offsetY: 2, opacity: 0.55, glowBlur: 4, thickness: 1.5 },
  // 亮白小盘（高光点缀）
  { hue: 240, hueRange: 60, saturation: 20, lightness: 92, radiusRatio: 0.5, tiltX: 0.4, tiltY: -0.7, tiltZ: 0.6, spinSpeedX: 0.4, spinSpeedY: 0.25, spinSpeedZ: 0.3, offsetY: 0, opacity: 0.5, glowBlur: 3, thickness: 1.2 },
]

function getSpeedMultiplier(status: CopilotStatus): number {
  switch (status) {
    case 'thinking':
      return 2.0   // thinking: 中等加速，蓄力感
    case 'streaming':
      return 4.0   // streaming: 高速旋转，能量释放
    case 'error':
      return 1.5
    default:
      return 1     // idle: 悠闲缓慢
  }
}

// 获取圆盘描边粗度倍率
function getThicknessMultiplier(status: CopilotStatus): number {
  switch (status) {
    case 'thinking':
      return 1.6
    case 'streaming':
      return 2.2
    case 'error':
      return 1.3
    default:
      return 1.2
  }
}

// 获取光晕强度倍率
function getGlowMultiplier(status: CopilotStatus): number {
  switch (status) {
    case 'thinking':
      return 2.0
    case 'streaming':
      return 3.0
    case 'error':
      return 1.5
    default:
      return 1.5
  }
}

// 获取呼吸幅度
function getBreatheAmplitude(status: CopilotStatus): number {
  switch (status) {
    case 'thinking':
      return 0.08   // thinking: 明显的脉冲呼吸
    case 'streaming':
      return 0.03   // streaming: 微弱呼吸，稳定输出
    case 'error':
      return 0.1    // error: 剧烈抖动
    default:
      return 0.04   // idle: 轻柔呼吸
  }
}

// 获取呼吸频率
function getBreatheSpeed(status: CopilotStatus): number {
  switch (status) {
    case 'thinking':
      return 2.5    // thinking: 较快脉冲
    case 'streaming':
      return 1.0    // streaming: 平稳
    case 'error':
      return 6.0    // error: 急促
    default:
      return 0.8    // idle: 缓慢
  }
}

// 简易 3D 投影：将 3D 椭圆投影为 2D 椭圆
// 给定圆盘的 3 个旋转角度，计算投影后的椭圆参数
function project3DDisc(
  rx: number, ry: number, rz: number,
  discRadius: number,
): { a: number; b: number; rotation: number } {
  // 圆盘法向量初始为 (0, 1, 0) — 面朝上的圆盘
  // 绕 X 旋转
  const cosX = Math.cos(rx), sinX = Math.sin(rx)
  const cosY = Math.cos(ry), sinY = Math.sin(ry)
  const cosZ = Math.cos(rz), sinZ = Math.sin(rz)

  // 组合旋转矩阵（Rz * Ry * Rx）作用于法向量 (0,1,0)
  const nx = sinY * cosX * cosZ + sinX * sinZ
  const ny = cosY * cosX
  const nz = -sinY * cosX * sinZ + sinX * cosZ

  // 投影到 XY 平面 —— 椭圆的短轴 = discRadius * |ny|
  // 长轴 = discRadius，旋转角 = atan2(nx, nz)
  const a = discRadius // 长轴始终是圆盘半径
  const b = discRadius * Math.abs(ny) // 短轴 = 倾斜程度
  const rotation = Math.atan2(nx, nz)

  return { a, b: Math.max(b, discRadius * 0.05), rotation }
}

function draw(ctx: CanvasRenderingContext2D, w: number, h: number, time: number) {
  const cx = w / 2
  const cy = h / 2
  const r = props.size / 2  // 球半径 = size / 2
  const speedMul = getSpeedMultiplier(props.status)
  const breatheAmp = getBreatheAmplitude(props.status)
  const breatheSpd = getBreatheSpeed(props.status)
  const breathe = 1 + breatheAmp * Math.sin(time * breatheSpd)

  ctx.clearRect(0, 0, w, h)

  // ---- 整体剪切为圆形（消除方形背景！） ----
  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, r * 1.15, 0, Math.PI * 2) // 稍大一点留光晕空间
  ctx.closePath()
  ctx.clip()

  // ---- 1. 外层光晕（呼吸） ----
  const isThinking = props.status === 'thinking'
  const isStreaming = props.status === 'streaming'
  const isError = props.status === 'error'
  let glowAlpha: number, glowHue: string
  if (isThinking) {
    // thinking: 暖橙色脉冲光晕，明显的呼吸感
    glowAlpha = 0.35 + 0.15 * Math.sin(time * 2.5)
    glowHue = '35, 90%'
  } else if (isStreaming) {
    // streaming: 亮蓝紫色光晕，稳定且强烈
    glowAlpha = 0.5
    glowHue = '240, 85%'
  } else if (isError) {
    glowAlpha = 0.35 + 0.1 * Math.sin(time * 6)
    glowHue = '0, 80%'
  } else {
    glowAlpha = 0.2
    glowHue = '260, 70%'
  }
  const glowR = r * 1.12 * breathe

  const glowGrad = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, glowR)
  glowGrad.addColorStop(0, `hsla(${glowHue}, 70%, ${glowAlpha})`)
  glowGrad.addColorStop(0.6, `hsla(${glowHue}, 60%, ${glowAlpha * 0.4})`)
  glowGrad.addColorStop(1, 'hsla(0, 0%, 0%, 0)')
  ctx.fillStyle = glowGrad
  ctx.beginPath()
  ctx.arc(cx, cy, glowR, 0, Math.PI * 2)
  ctx.fill()

  // ---- 2. 球体内部剪切 ----
  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, r * breathe, 0, Math.PI * 2)
  ctx.closePath()
  ctx.clip()

  // ---- 3. 球体底色（深色半透明，营造立体球感） ----
  // 底层：整体深色
  const baseBg = ctx.createRadialGradient(cx * 0.88, cy * 0.78, r * 0.05, cx, cy, r)
  baseBg.addColorStop(0, 'rgba(80, 60, 140, 0.45)')
  baseBg.addColorStop(0.4, 'rgba(50, 35, 110, 0.5)')
  baseBg.addColorStop(0.75, 'rgba(30, 20, 80, 0.6)')
  baseBg.addColorStop(1, 'rgba(15, 10, 50, 0.75)')
  ctx.fillStyle = baseBg
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fill()

  // 中层：顶部偏亮（模拟光照从上方打下来）
  const lightBg = ctx.createRadialGradient(cx * 0.85, cy * 0.6, 0, cx * 0.9, cy * 0.75, r * 0.8)
  lightBg.addColorStop(0, 'rgba(160, 140, 220, 0.3)')
  lightBg.addColorStop(0.4, 'rgba(120, 100, 200, 0.12)')
  lightBg.addColorStop(1, 'rgba(60, 40, 130, 0)')
  ctx.fillStyle = lightBg
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fill()

  // 底部阴影加深（球的下半部更暗）
  const shadowBg = ctx.createLinearGradient(cx, cy - r, cx, cy + r)
  shadowBg.addColorStop(0, 'rgba(0, 0, 0, 0)')
  shadowBg.addColorStop(0.55, 'rgba(0, 0, 0, 0)')
  shadowBg.addColorStop(0.85, 'rgba(10, 5, 30, 0.25)')
  shadowBg.addColorStop(1, 'rgba(10, 5, 30, 0.4)')
  ctx.fillStyle = shadowBg
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fill()

  // ---- 4. 绘制 3D 彩色圆盘 ----
  for (const disc of discs) {
    drawDisc(ctx, cx, cy, r, time, disc, speedMul, breathe)
  }

  // ---- 5. 球面高光（顶部光斑 + 边缘反射） ----
  // 主高光（左上偏移，模拟环境光）
  const hlX = cx - r * 0.2
  const hlY = cy - r * 0.28
  const hlGrad = ctx.createRadialGradient(hlX, hlY, 0, hlX, hlY, r * 0.55)
  hlGrad.addColorStop(0, 'rgba(255, 255, 255, 0.35)')
  hlGrad.addColorStop(0.25, 'rgba(255, 255, 255, 0.15)')
  hlGrad.addColorStop(0.6, 'rgba(255, 255, 255, 0.04)')
  hlGrad.addColorStop(1, 'rgba(255, 255, 255, 0)')
  ctx.fillStyle = hlGrad
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fill()

  // 边缘菲涅尔反射（球边缘亮环）
  const fresnelGrad = ctx.createRadialGradient(cx, cy, r * 0.7, cx, cy, r)
  fresnelGrad.addColorStop(0, 'rgba(180, 170, 240, 0)')
  fresnelGrad.addColorStop(0.6, 'rgba(180, 170, 240, 0)')
  fresnelGrad.addColorStop(0.85, 'rgba(180, 170, 255, 0.08)')
  fresnelGrad.addColorStop(1, 'rgba(200, 190, 255, 0.2)')
  ctx.fillStyle = fresnelGrad
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fill()

  ctx.restore() // 球体剪切

  // ---- 6. 球体边缘（明显的描边环） ----
  const edgeAlpha = 0.25 + 0.1 * Math.sin(time * 1.2)
  ctx.beginPath()
  ctx.arc(cx, cy, r * breathe, 0, Math.PI * 2)
  ctx.closePath()
  ctx.strokeStyle = `rgba(170, 155, 240, ${edgeAlpha})`
  ctx.lineWidth = 1.5
  ctx.stroke()

  // 外层淡光圈
  ctx.beginPath()
  ctx.arc(cx, cy, r * breathe + 1.5, 0, Math.PI * 2)
  ctx.closePath()
  ctx.strokeStyle = `rgba(140, 120, 220, ${edgeAlpha * 0.3})`
  ctx.lineWidth = 2
  ctx.stroke()

  ctx.restore() // 大圆剪切
}

function drawDisc(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  sphereR: number,
  time: number,
  disc: Disc,
  speedMul: number,
  breathe: number,
) {
  const t = time * speedMul
  const discR = sphereR * disc.radiusRatio * breathe

  // 当前旋转角度
  const rx = disc.tiltX + t * disc.spinSpeedX
  const ry = disc.tiltY + t * disc.spinSpeedY
  const rz = disc.tiltZ + t * disc.spinSpeedZ

  // 3D -> 2D 投影
  const { a, b, rotation } = project3DDisc(rx, ry, rz, discR)

  // 圆盘在球内的 Y 偏移（也随时间微微浮动）
  const yOff = disc.offsetY + Math.sin(t * 0.3 + disc.tiltX) * sphereR * 0.05

  ctx.save()
  ctx.translate(cx, cy + yOff)
  ctx.rotate(rotation)

  // 确定色相
  const isError = props.status === 'error'
  const hue1 = isError ? 0 : disc.hue
  const hue2 = isError ? 15 : disc.hue + disc.hueRange
  const sat = isError ? 80 : disc.saturation
  const lit = disc.lightness

  // ---- 光晕层（宽模糊描边） ----
  ctx.globalAlpha = disc.opacity * (props.status === 'streaming' ? 0.85 : 0.6)
  ctx.shadowColor = `hsla(${(hue1 + hue2) / 2}, ${sat}%, ${lit}%, 0.9)`
  ctx.shadowBlur = disc.glowBlur * getGlowMultiplier(props.status)

  ctx.beginPath()
  ctx.ellipse(0, 0, a, b, 0, 0, Math.PI * 2)

  // 渐变填充（模拟 3D 光照）
  const grad = ctx.createLinearGradient(-a, 0, a, 0)
  grad.addColorStop(0, `hsla(${hue1}, ${sat}%, ${lit}%, 0)`)
  grad.addColorStop(0.15, `hsla(${hue1}, ${sat}%, ${lit}%, 0.6)`)
  grad.addColorStop(0.35, `hsla(${hue1}, ${sat}%, ${lit + 8}%, 0.9)`)
  grad.addColorStop(0.5, `hsla(${(hue1 + hue2) / 2}, ${sat}%, ${lit + 12}%, 1)`)
  grad.addColorStop(0.65, `hsla(${hue2}, ${sat}%, ${lit + 8}%, 0.9)`)
  grad.addColorStop(0.85, `hsla(${hue2}, ${sat}%, ${lit}%, 0.6)`)
  grad.addColorStop(1, `hsla(${hue2}, ${sat}%, ${lit}%, 0)`)

  ctx.strokeStyle = grad
  ctx.lineWidth = disc.thickness * getThicknessMultiplier(props.status)
  ctx.stroke()

  // ---- 填充层（实色半透明圆盘面） ----
  ctx.shadowBlur = 0
  ctx.shadowColor = 'transparent'
  ctx.globalAlpha = disc.opacity * 0.8

  const fillGrad = ctx.createLinearGradient(-a, -b, a, b)
  fillGrad.addColorStop(0, `hsla(${hue1}, ${sat}%, ${lit + 18}%, 0.85)`)
  fillGrad.addColorStop(0.3, `hsla(${hue1}, ${sat}%, ${lit + 10}%, 0.7)`)
  fillGrad.addColorStop(0.5, `hsla(${(hue1 + hue2) / 2}, ${sat}%, ${lit + 5}%, 0.6)`)
  fillGrad.addColorStop(0.7, `hsla(${hue2}, ${sat}%, ${lit + 8}%, 0.65)`)
  fillGrad.addColorStop(1, `hsla(${hue2}, ${sat}%, ${lit + 15}%, 0.8)`)
  ctx.fillStyle = fillGrad
  ctx.beginPath()
  ctx.ellipse(0, 0, a, b, 0, 0, Math.PI * 2)
  ctx.fill()

  // ---- 边缘高光线（模拟 3D 圆盘的亮边） ----
  ctx.globalAlpha = disc.opacity * 0.3
  ctx.beginPath()
  // 只画上半弧（模拟光照方向）
  ctx.ellipse(0, 0, a * 0.98, b * 0.98, 0, Math.PI * 1.1, Math.PI * 1.9)
  ctx.strokeStyle = `hsla(${(hue1 + hue2) / 2}, ${sat - 10}%, ${lit + 25}%, 0.7)`
  ctx.lineWidth = disc.thickness * 0.5
  ctx.stroke()

  ctx.globalAlpha = 1
  ctx.restore()
}

function animate() {
  const canvas = canvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const elapsed = (performance.now() - startTime) / 1000
  const dpr = window.devicePixelRatio || 1
  const w = canvas.width / dpr
  const h = canvas.height / dpr

  ctx.save()
  ctx.scale(dpr, dpr)
  draw(ctx, w, h, elapsed)
  ctx.restore()

  animationId = requestAnimationFrame(animate)
}

function setupCanvas() {
  const canvas = canvasRef.value
  if (!canvas) return

  const dpr = window.devicePixelRatio || 1
  const displaySize = props.size * 1.3 // 留一点光晕空间
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
  () => {
    setupCanvas()
  },
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

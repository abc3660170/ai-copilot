<template>
  <div class="breathEffect" ref="breathEffect">
    <div class="contentWrap"><slot></slot></div>
  </div>
</template>
<script setup lang="ts">
import { ref, watchEffect, onMounted, onBeforeUnmount, nextTick, getCurrentInstance } from 'vue';

const props = defineProps({
  width: {
    type: String,
    default: '100px',
  },
  height: {
    type: String,
    default: '100px',
  },
});

const breathEffect = ref<HTMLElement | null>(null);

// 在 mount 时检测父组件是否显式传入了 width/height
let hasWidthProp = false;
let hasHeightProp = false;

watchEffect(() => {
  if (!breathEffect.value) return;
  if (hasWidthProp) breathEffect.value.style.setProperty('--be-width', props.width);
  if (hasHeightProp) breathEffect.value.style.setProperty('--be-height', props.height);
});

let observer: MutationObserver | null = null;
let onResize: (() => void) | null = null;

function readSlotMetrics() {
  if (!breathEffect.value) return;
  const contentWrap = breathEffect.value.querySelector('.contentWrap') as HTMLElement | null;
  if (!contentWrap) return;

  // 找到 slot 中的第一个元素节点作为目标
  let target: HTMLElement | null = null;
  for (const node of Array.from(contentWrap.childNodes)) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      target = node as HTMLElement;
      break;
    }
  }
  if (!target) return;

  // 读取计算样式（圆角）
  const style = window.getComputedStyle(target);
  const tl = style.borderTopLeftRadius || '0px';
  const tr = style.borderTopRightRadius || '0px';
  const br = style.borderBottomRightRadius || '0px';
  const bl = style.borderBottomLeftRadius || '0px';
  const radiusValue = `${tl} ${tr} ${br} ${bl}`;
  breathEffect.value.style.setProperty('--border-radius', radiusValue);

  // 读取布局尺寸
  const rect = target.getBoundingClientRect();
  const w = `${Math.round(rect.width)}px`;
  const h = `${Math.round(rect.height)}px`;
  if (!hasWidthProp) breathEffect.value.style.setProperty('--be-width', w);
  if (!hasHeightProp) breathEffect.value.style.setProperty('--be-height', h);
}

onMounted(async () => {
  const instance = getCurrentInstance();
  const vnodeProps =
    (instance && instance.vnode && (instance.vnode.props as Record<string, any>)) || {};
  // vnodeProps 里可能包含 kebab-case 或 camelCase，使用 hasOwnProperty 检查
  hasWidthProp =
    Object.prototype.hasOwnProperty.call(vnodeProps, 'width') ||
    Object.prototype.hasOwnProperty.call(vnodeProps, 'width'.toLowerCase());
  hasHeightProp =
    Object.prototype.hasOwnProperty.call(vnodeProps, 'height') ||
    Object.prototype.hasOwnProperty.call(vnodeProps, 'height'.toLowerCase());

  // 等待 Vue 更新 DOM，并等待下一帧以确保浏览器布局完成
  await nextTick();
  await new Promise(requestAnimationFrame);

  readSlotMetrics();

  const contentWrap = breathEffect.value?.querySelector('.contentWrap') as HTMLElement | null;
  if (contentWrap) {
    observer = new MutationObserver(() => {
      // 短延迟以确保子节点样式/尺寸稳定
      setTimeout(() => {
        readSlotMetrics();
      }, 0);
    });
    observer.observe(contentWrap, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class'],
    });
    onResize = () => readSlotMetrics();
    window.addEventListener('resize', onResize);
  }
});

onBeforeUnmount(() => {
  if (observer) observer.disconnect();
  if (onResize) {
    window.removeEventListener('resize', onResize);
    onResize = null;
  }
});
</script>
<style lang="scss" scoped>
.breathEffect {
  --neon-first-color: #ff00aa;
  --neon-second-color: #00fff1;
  --border-radius: 20px;
  --be-width: 100px;
  --be-height: 100px;

  position: relative;
  width: var(--be-width);
  height: var(--be-height);
  &::before,
  &::after {
    position: absolute;
    content: '';
    inset: -2px;
    border-radius: var(--border-radius);
    background: linear-gradient(0deg, var(--neon-first-color), var(--neon-second-color));
    background-size: 100% 200%;
    animation: background-position-spin 3s infinite alternate;
  }
  &::after {
    filter: blur(150px);
  }

  .contentWrap {
    position: relative;
    z-index: 1;
    height: 100%;
  }
}

@keyframes background-position-spin {
  0% {
    background-position: top;
  }
  100% {
    background-position: bottom;
  }
}
</style>

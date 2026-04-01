<script setup lang="ts">
import { ref } from 'vue';
import { useRouter, useRoute } from 'vue-router';

const router = useRouter();
const route = useRoute();
const sidebarOpen = ref(true);

const navItems = [
  { path: '/', name: 'playground', label: '🚀 Playground', desc: 'Copilot 调试' },
  { path: '/materials', name: 'materials', label: '📦 素材收集', desc: '设计开发素材' },
];

function navigateTo(path: string) {
  router.push(path);
}
</script>

<template>
  <div class="app-layout" :class="{ 'sidebar-collapsed': !sidebarOpen }">
    <!-- 左侧侧边栏 -->
    <aside class="sidebar">
      <div class="sidebar-header">
        <div v-if="sidebarOpen" class="sidebar-brand">
          <span class="brand-icon">🤖</span>
          <span class="brand-text">AI Copilot</span>
        </div>
        <button
          class="sidebar-toggle"
          @click="sidebarOpen = !sidebarOpen"
          :title="sidebarOpen ? '收起' : '展开'"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
          >
            <path v-if="sidebarOpen" d="M15 18l-6-6 6-6" />
            <path v-else d="M9 18l6-6-6-6" />
          </svg>
        </button>
      </div>

      <nav class="sidebar-nav">
        <button
          v-for="item in navItems"
          :key="item.path"
          class="nav-item"
          :class="{ active: route.path === item.path }"
          @click="navigateTo(item.path)"
          :title="item.desc"
        >
          <span class="nav-icon">{{ item.label.slice(0, 2) }}</span>
          <div v-if="sidebarOpen" class="nav-text">
            <span class="nav-label">{{ item.label.slice(2).trim() }}</span>
            <span class="nav-desc">{{ item.desc }}</span>
          </div>
        </button>
      </nav>

      <div class="sidebar-footer">
        <div v-if="sidebarOpen" class="sidebar-version">v1.0.0</div>
      </div>
    </aside>

    <!-- 主内容区域 -->
    <main class="main-content">
      <router-view />
    </main>
  </div>
</template>

<style scoped>
.app-layout {
  display: flex;
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

/* ---- 侧边栏 ---- */
.sidebar {
  width: 240px;
  min-width: 240px;
  background: rgba(15, 10, 40, 0.92);
  backdrop-filter: blur(20px);
  display: flex;
  flex-direction: column;
  transition:
    width 0.3s cubic-bezier(0.4, 0, 0.2, 1),
    min-width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  border-right: 1px solid rgba(255, 255, 255, 0.06);
  position: sticky;
  top: 0;
  height: 100vh;
  z-index: 100;
}

.sidebar-collapsed .sidebar {
  width: 60px;
  min-width: 60px;
}

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  min-height: 56px;
}

.sidebar-collapsed .sidebar-header {
  justify-content: center;
  padding: 16px 8px;
}

.sidebar-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  overflow: hidden;
}

.brand-icon {
  font-size: 22px;
  flex-shrink: 0;
}

.brand-text {
  font-size: 16px;
  font-weight: 700;
  color: white;
  white-space: nowrap;
}

.sidebar-toggle {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: none;
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition:
    background 0.2s,
    color 0.2s;
}

.sidebar-toggle:hover {
  background: rgba(255, 255, 255, 0.15);
  color: white;
}

/* 导航 */
.sidebar-nav {
  flex: 1;
  padding: 12px 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 10px;
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.65);
  cursor: pointer;
  text-align: left;
  transition: all 0.2s;
  width: 100%;
}

.sidebar-collapsed .nav-item {
  justify-content: center;
  padding: 10px 8px;
}

.nav-item:hover {
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.9);
}

.nav-item.active {
  background: rgba(139, 92, 246, 0.25);
  color: white;
}

.nav-icon {
  font-size: 18px;
  flex-shrink: 0;
  width: 28px;
  text-align: center;
}

.nav-text {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
}

.nav-label {
  font-size: 14px;
  font-weight: 500;
  white-space: nowrap;
}

.nav-desc {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
  white-space: nowrap;
}

.sidebar-footer {
  padding: 12px 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.sidebar-version {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.3);
  text-align: center;
}

/* ---- 主内容 ---- */
.main-content {
  flex: 1;
  overflow-y: auto;
  min-width: 0;
}
</style>

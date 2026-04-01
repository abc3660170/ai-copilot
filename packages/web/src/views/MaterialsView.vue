<script setup lang="ts">
import BreathEffect from './materials/BreathEffect.vue';
</script>

<template>
  <div class="materials-page">
    <h1>📦 素材收集</h1>
    <section class="breath">
      <h2>背景呼吸灯效果</h2>
      <BreathEffect>
        <template #default>
          <div
            style="
              width: 700px;
              height: 150px;
              background-color: aliceblue;
              border-radius: 20px 10px 0px 5px;
            "
          >
            <div>我是表单1</div>
            <div>我是表单2</div>
          </div>
        </template>
      </BreathEffect>
    </section>
  </div>
</template>

<style scoped>
.materials-page {
  padding: 20px;
  width: 100%;
  height: 100%;
  background-color: rgb(212, 206, 198);
}

.materials-page h1 {
  color: white;
  font-size: 2rem;
  margin: 0 0 24px;
}
</style>

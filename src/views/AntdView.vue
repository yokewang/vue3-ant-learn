<script setup></script>

<template>
  <div style="padding: 24px">
    <a-typography-title :level="3">Ant Design Vue Demo</a-typography-title>
    <a-typography-paragraph>
      如果你能看到下面的按钮样式正常，说明 ant-design-vue 已经全局注册成功。
    </a-typography-paragraph>
    <a-space>
      <a-button type="primary">Primary Button</a-button>
      <a-button>Default Button</a-button>
      <a-button type="dashed">Dashed Button</a-button>
    </a-space>
  </div>
  <div style="padding: 24px">
    <a-typography-paragraph copyable>
      这是一段可复制的文字（a-typography-paragraph）。
    </a-typography-paragraph>
  </div>
  <div style="padding: 24px">
    <a-alert message="Antd 正常工作中" type="success" show-icon />
  </div>
</template>

<style scoped></style>

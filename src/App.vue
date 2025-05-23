// Vue2QueryBuilder.vue
<template>
  <div id="app">
    <ChatRoom />
  </div>
</template>

<script>
import ChatRoom from './components/ChatRoom.vue';

export default {
  name: 'App',
  components: {
    ChatRoom
  }
}
</script>

<style>
html, body {
  margin: 0;
  padding: 0;
  height: 100%;
  font-family: Arial, sans-serif;
}

#app {
  padding: 20px;
  height: 100%;
  box-sizing: border-box;
  background-color: #f9f9f9;
}
</style>
const { defineConfig } = require('@vue/cli-service')
module.exports = defineConfig({
  transpileDependencies: true,
  css: {
    sourceMap: true
  },
  configureWebpack: {
    devtool: 'source-map'
  }
})

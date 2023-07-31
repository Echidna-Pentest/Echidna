module.exports = {
  transpileDependencies: [
    'vuetify'
  ],
  devServer: {
    proxy: {
      "/terminal": {
        target: "http://localhost:8888/",
        changeOrigin: true
      },
      "/logs": {
        target: "http://localhost:8888/",
        changeOrigin: true
      },
      "/targets": {
        target: "http://localhost:8888/",
        changeOrigin: true
      },
      "/commands": {
        target: "http://localhost:8888/",
        changeOrigin: true
      },
      "/chats": {
        target: "http://localhost:8888/",
        changeOrigin: true
      }
    }
  }
}

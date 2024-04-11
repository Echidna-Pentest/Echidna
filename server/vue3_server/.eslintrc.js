module.exports = {
  root: true,
  env: {
    browser: true,
    node: true,
    webextensions: true,
  },
  extends: [
    'plugin:vue/vue3-essential',
    'eslint:recommended',
  ],
  parser: "vue-eslint-parser",
}

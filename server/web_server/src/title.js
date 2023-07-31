export default {
  mounted() {
    let { title } = this.$options
    if (title) {
      title = typeof title === 'function' ? title.call(this) : title
    }
    if (title) {
      document.title = `${title} - Echidna`
    } else {
      document.title = `Echidna`
    }
  }
}

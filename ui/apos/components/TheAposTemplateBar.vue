<template>
  <div
    v-if="aposIsTemplate"
    class="apos-admin-bar__control-set apos-admin-bar__control-set__template-warning"
  >
    <span>{{ $t('aposTemplate:editPageTemplateMessage') }}</span>
  </div>
</template>

<script>
export default {
  name: 'TheAposTemplateBar',
  computed: {
    moduleOptions() {
      return window.apos.adminBar;
    },
    aposIsTemplate() {
      return this.moduleOptions.context?.aposIsTemplate;
    }
  }
};
</script>

<style lang="scss" scoped>
.apos-admin-bar__control-set__template-warning {
  padding: 10px 20px;
  width: auto;
  justify-content: center;
  background-color: rgb(255, 188, 0);
}
</style>

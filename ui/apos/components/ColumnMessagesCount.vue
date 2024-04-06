<script>
export default {
  name: 'ColumnMessagesCount',

  props: {
    item: {
      type: Object,
    },
  },

  data() {
    return {
      messagesCount: 0,
    };
  },

  mounted() {
    this.messagesCount = this.item?.messages?.length;
  },

  async updated() {
    const response = await apos.http.get(apos.modules['apos-live-chat'].action + '/' + this.item._id, {});
    this.messagesCount = response?.messages?.length;
  },
}
</script>

<template>
  <p class="apos-table__cell-field apos-table__cell-field--messages">
    {{ messagesCount }}
  </p>
</template>

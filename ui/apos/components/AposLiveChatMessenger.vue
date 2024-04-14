<template>
  <div class="apos-modal__chat">
    <div class="apos-modal__chat-message" :class="{ 'apos-modal__chat-message--sender': message.sender === 'adminID' }"
      v-for="message in chat?.messages" :key="message._id">
      <div class="apos-modal__chat-text" :class="{ 'apos-modal__chat-text--sender': message.sender === 'adminID' }">
        {{ message.content }}
      </div>
    </div>
    <button @click="reply">Reply</button>
  </div>
</template>

<script>
export default {
  name: 'AposLiveChatMessenger',

  emits: ['chat-updated'],

  props: {
    chat: {
      type: Object,
      required: true,
      default: () => ({
        messages: []
      })
    },
  },

  methods: {
    async reply() {
      this.$emit("chat-updated", {
        type: "private message",
        message: {
          content: 'second private message',
          to: this.chat.from,
          from: 'adminID'
        }
      });
    }
  },
}
</script>

<style lang="scss" scoped>
  .apos-modal__chat {
    width: 50%;
    padding: 40px;
    border-left: 1px solid var(--a-base-9);
    max-height: calc(100vh - 120px);
    overflow: auto;
    display: flex;
    flex-direction: column;
    row-gap: 20px;
  }

  .apos-modal__chat-message {
    display: flex;

    &--sender {
      flex-direction: row-reverse;
    }
  }

  .apos-modal__chat-text {
    border-radius: 8px;
    white-space: pre-wrap;
    display: table;
    position: relative;
    padding: 10px;
    background: #f5f5f5;

    &--sender {
      background-color: var(--a-primary);
      color: var(--a-text-inverted) !important;
    }
  }
</style>

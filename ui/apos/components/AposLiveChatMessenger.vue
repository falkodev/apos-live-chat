<template>
  <div class="apos-modal__chat">
    <div class="apos-modal__chat-messages">
      <div class="apos-modal__chat-message"
        :class="{ 'apos-modal__chat-message--sender': message.sender === 'adminID' }" v-for="message in chat?.messages"
        :key="message._id">
        <div class="apos-modal__chat-text" :class="{ 'apos-modal__chat-text--sender': message.sender === 'adminID' }">
          {{ message.content }}
        </div>
        <span class="apos-modal__chat-date" :class="{ 'apos-modal__chat-date--left': message.sender === 'adminID' }">
          {{ formatDate(message.date) }}
        </span>
      </div>
    </div>
    <div class="apos-modal__chat-reply" v-if="chat?.messages?.length">
      <span class="apos-modal__chat-reply-input" contenteditable="true"></span>
      <button class="apos-modal__chat-reply-button" @click="reply">
        <svg width="20" height="20" viewBox="0 0 512 512" fill="#fff">
          <path d="M16,464,496,256,16,48V208l320,48L16,304Z"></path>
        </svg>
      </button>
    </div>
  </div>
</template>

<script>
import dayjs from 'dayjs';

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
    formatDate(value) {
      return dayjs(value).format('YYYY-MM-DD HH:mm');
    },
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
    display: flex;
    flex-direction: column;
    row-gap: 20px;
    max-height: calc(100vh - 220px);
    overflow: auto;
  }

  .apos-modal__chat-messages {
    overflow: auto;
  }

  .apos-modal__chat-message {
    display: flex;
    gap: 10px;
    padding: 5px;

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
    background: var(--a-base-10);

    &--sender {
      background-color: var(--a-primary);
      color: var(--a-text-inverted) !important;
    }
  }

  .apos-modal__chat-date {
    align-self: center;
    font-size: 11px;
    color: var(--a-base-5);
  }

  .apos-modal__chat-reply {
    display: flex;
    gap: 20px;
    justify-content: space-between;
    align-items: end;
  }

  .apos-modal__chat-reply-input {
    display: block;
    border: 1px solid;
    border-radius: 4px;
    width: 80%;
    min-height: 90px;
    overflow-y: auto;
  }

  .apos-modal__chat-reply-button {
    background-color: #6516dd;
    position: relative;
    border: none;
    border-radius: 7px;
    padding: 12px 24px;
    height: 25px;
    cursor: pointer;
  }
</style>

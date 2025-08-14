<template>
  <div>
    <button class="toggle-button" :class="{ 'new-message': newMessageReceived }"  @click="toggleChat">
      Chat
    </button>
    <div class="chat" v-show="isActive">
      <div class="chat-header">
        <h3>Chat</h3>
        <button @click="toggleChat">x</button>
      </div>
      <div class="chat-body">
        <div class="chat-messages" ref="messages">
          <div v-bind:class="message.author" v-for="(message, index) in messages" :key="index">
            <p>{{ message.data }}</p>
<!--            <span>{{ message.time }}</span> -->
          </div>
        </div>
        <div class="chat-input">
          <textarea v-model="newMessage" @keydown.enter.exact.prevent="newLine" placeholder="Type your message. You can ask chatgpt to analyze the scan result by @AI <Scanresult>"></textarea>
          <button @click="sendMessage">Send</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { EchidnaAPI } from '@echidna/api';
const echidna = new EchidnaAPI(location.hostname);

export default {
  data() {
    return {
      isActive: false,
      newMessage: "",
      newMessageReceived: false,
      messages: [],
    };
  },
  mounted() {
    echidna
      .getallchats()
      .then(({ data: messages }) => {
        this.messages = messages;
      })
      .catch((error) => {
        console.error(error);
      });

    echidna.on('chats', this.updateChats);
  },
  methods: {
    updateChats() {
        echidna
        .chats()
        .then(({ data: messages }) => {
          if (messages.data != undefined){
            this.messages = [...this.messages, messages];
            this.newMessageReceived = true;
          }
          setTimeout(() => {
            this.newMessageReceived = false;
          }, 3000);
        })
        .catch((error) => {
          console.error(error);
        });
      },
    toggleChat() {
      this.isActive = !this.isActive;
    },
    newLine() {
      this.newMessage += "\n";
    },
    sendMessage() {
      if (this.newMessage.trim() !== "") {
        echidna.sendChat({ author: 'user', type: 'text', data: this.newMessage});
        this.newMessage = "";
        this.$nextTick(() => {
          this.$refs.messages.scrollTop = this.$refs.messages.scrollHeight;
        });
      }
    },
  },
};
</script>

<style scoped>
.toggle-button {
  position: fixed;
  bottom: 20px;
  right: 20px;
  background-color: #4caf50;
  color: white;
  border: none;
  padding: 10px;
  border-radius: 5px;
  cursor: pointer;
}

.toggle-button {
  animation: blink 1s infinite;
  animation-play-state: paused;
}

.toggle-button.new-message {
  animation-play-state: running;
}

@keyframes blink {
  0% { opacity: 1; }
  50% { opacity: 0.5; }
  100% { opacity: 1; }
}

.chat {
  position: fixed;
  bottom: 20px;
  right: 20px;
  width: 600px;
  background-color: white;
  border: 1px solid black;
  border-radius: 5px;
  display: flex;
  flex-direction: column;
}

.chat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px;
  background-color: #ddd;
  border-bottom: 1px solid black;
}

.chat-body {
  max-height: 600px;
  overflow-y: auto;
  flex-grow: 1;
}

.chat-messages {
  height: 100%;
  overflow-y: auto;
}

.user {
  padding: 5px;
  margin: 5px;
  background-color: #f2f2f2;
  border-radius: 5px;
}

.chatbot {
  padding: 5px;
  margin: 5px;
  background-color: rgba(255, 255, 128, .5);
  border-radius: 5px;
}

.echidna {
  padding: 5px;
  margin: 5px;
  background-color: rgba(128, 247, 255, 0.5);
  border-radius: 5px;
}

/* provider-colored authors */
.local-llm {
  padding: 5px;
  margin: 5px;
  background-color: rgba(255, 255, 128, .5);
  border-radius: 5px;
}

.openai {
  padding: 5px;
  margin: 5px;
  background-color: rgba(208, 128, 255, 0.35);
  border-radius: 5px;
}

.gemini {
  padding: 5px;
  margin: 5px;
  background-color: rgba(128, 255, 128, 0.45);
  border-radius: 5px;
}


.chat-input {
  display: flex;
  align-items: center;
  padding: 10px;
  height: 80px;
}

.chat-input textarea {
  flex: 1;
  margin-right: 10px;
  padding: 10px;
}

.chat-input button {
  background-color: #4caf50;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 5px;
  cursor: pointer;
}
</style>
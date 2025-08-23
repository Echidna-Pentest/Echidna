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
            <div v-if="message.author && message.author.startsWith('ReactAgent-')" class="agent-message">
              <div class="agent-header">
                <strong>[AI] ReactAgent Analysis</strong>
                <span class="agent-provider">{{ message.author.replace('ReactAgent-', '') }}</span>
              </div>
              <pre class="agent-content">{{ message.data }}</pre>
            </div>
            <div v-else-if="message.author && message.author.startsWith('ValidationAgent-')" class="validation-agent-message">
              <div class="validation-agent-header">
                <strong>[AI] ValidationAgent - Command Validation</strong>
                <span class="validation-agent-provider">{{ message.author.replace('ValidationAgent-', '') }}</span>
              </div>
              <pre class="validation-agent-content">{{ message.data }}</pre>
            </div>
            <p v-else>{{ message.data }}</p>
<!--            <span>{{ message.time }}</span> -->
          </div>
        </div>
        <div class="chat-input">
          <textarea v-model="newMessage" @keydown.enter.exact.prevent="newLine" placeholder="Type your message. Use @AI for all models, @localAI for Local AI, @geminiAI for Gemini, @openAI for OpenAI. Example: @AI <Scanresult>"></textarea>
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

.open-AI {
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

.Gemini-AI {
  padding: 5px;
  margin: 5px;
  background-color: rgba(128, 255, 128, 0.45);
  border-radius: 5px;
}

.Local-AI {
  padding: 5px;
  margin: 5px;
  background-color: rgba(255, 255, 128, .5);
  border-radius: 5px;
}

/* ReactAgent styles */
.ReactAgent-openai {
  padding: 8px;
  margin: 8px;
  background: linear-gradient(135deg, rgba(255, 165, 0, 0.2), rgba(255, 69, 0, 0.15));
  border-left: 4px solid #ff6347;
  border-radius: 8px;
  font-family: 'Courier New', monospace;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.ReactAgent-open-AI {
  padding: 8px;
  margin: 8px;
  background: linear-gradient(135deg, rgba(255, 165, 0, 0.2), rgba(255, 69, 0, 0.15));
  border-left: 4px solid #ff6347;
  border-radius: 8px;
  font-family: 'Courier New', monospace;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.ReactAgent-gemini {
  padding: 8px;
  margin: 8px;
  background: linear-gradient(135deg, rgba(34, 197, 94, 0.2), rgba(16, 185, 129, 0.15));
  border-left: 4px solid #10b981;
  border-radius: 8px;
  font-family: 'Courier New', monospace;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.ReactAgent-Local-AI {
  padding: 8px;
  margin: 8px;
  background: linear-gradient(135deg, rgba(147, 51, 234, 0.2), rgba(139, 92, 246, 0.15));
  border-left: 4px solid #8b5cf6;
  border-radius: 8px;
  font-family: 'Courier New', monospace;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

/* Generic ReactAgent style for unknown providers */
[class*="ReactAgent-"] {
  padding: 8px;
  margin: 8px;
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(37, 99, 235, 0.15));
  border-left: 4px solid #3b82f6;
  border-radius: 8px;
  font-family: 'Courier New', monospace;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  position: relative;
}

/* Add an indicator for ReactAgent messages */
[class*="ReactAgent-"]::before {
  content: "[AI] ";
  font-size: 14px;
  font-weight: bold;
  margin-right: 8px;
  color: #374151;
}

/* Better formatting for ReactAgent messages */
[class*="ReactAgent-"] p {
  margin: 0;
  white-space: pre-line;
  line-height: 1.4;
}

/* Enhanced formatting for ReactAgent content */
[class*="ReactAgent-"] strong {
  color: #1f2937;
  font-weight: 600;
}

[class*="ReactAgent-"] code {
  background-color: rgba(0, 0, 0, 0.1);
  padding: 2px 4px;
  border-radius: 3px;
  font-family: 'Courier New', monospace;
}

/* Special styling for ReactAgent message structure */
.agent-message {
  width: 100%;
}

.agent-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  padding-bottom: 4px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
}

.agent-provider {
  font-size: 12px;
  background-color: rgba(0, 0, 0, 0.1);
  padding: 2px 6px;
  border-radius: 12px;
  font-weight: normal;
}

.agent-content {
  margin: 0;
  white-space: pre-wrap;
  word-wrap: break-word;
  font-family: 'Courier New', monospace;
  font-size: 13px;
  line-height: 1.4;
  background-color: rgba(255, 255, 255, 0.3);
  padding: 8px;
  border-radius: 4px;
  border: 1px solid rgba(0, 0, 0, 0.1);
}

/* ValidationAgent message styling */
.validation-agent-message {
  width: 100%;
  padding: 10px;
  margin: 8px;
  background: linear-gradient(135deg, rgba(34, 139, 34, 0.15), rgba(50, 205, 50, 0.1));
  border-left: 5px solid #32cd32;
  border-radius: 8px;
  box-shadow: 0 3px 6px rgba(0, 0, 0, 0.12);
  position: relative;
}

.validation-agent-message::before {
  content: "🔍 ";
  position: absolute;
  top: 8px;
  left: 8px;
  font-size: 16px;
}

.validation-agent-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
  padding-bottom: 6px;
  border-bottom: 2px solid rgba(50, 205, 50, 0.3);
  padding-left: 30px; /* Space for emoji */
}

.validation-agent-header strong {
  color: #1f4e1f;
  font-weight: 700;
  font-size: 14px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.validation-agent-provider {
  font-size: 11px;
  background: linear-gradient(135deg, #32cd32, #228b22);
  color: white;
  padding: 3px 8px;
  border-radius: 14px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  box-shadow: 0 2px 4px rgba(50, 205, 50, 0.3);
}

.validation-agent-content {
  margin: 0;
  white-space: pre-wrap;
  word-wrap: break-word;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 13px;
  line-height: 1.5;
  background-color: rgba(255, 255, 255, 0.6);
  padding: 12px;
  border-radius: 6px;
  border: 1px solid rgba(50, 205, 50, 0.2);
  color: #2d5016;
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.1);
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
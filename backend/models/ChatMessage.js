import mongoose from 'mongoose';

const chatMessageSchema = new mongoose.Schema({
  sessionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ChatSession',
    required: true,
  },
  role: {
    type: String,
    enum: ['user', 'assistant', 'system'],
    required: true,
  },
  content: { type: String, required: true },
  sources: [{
    file: String,
    type: String,
    title: String,
  }],
}, {
  timestamps: true,
});

chatMessageSchema.index({ sessionId: 1, createdAt: 1 });

const ChatMessage = mongoose.model('ChatMessage', chatMessageSchema);
export default ChatMessage;

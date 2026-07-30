import mongoose from 'mongoose';
import crypto from 'crypto';

const webhookConfigSchema = new mongoose.Schema({
  repositoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Repository',
    required: true,
    unique: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  secret: { type: String, required: true, default: () => crypto.randomBytes(32).toString('hex') },
  active: { type: Boolean, default: true },
  events: {
    type: [String],
    enum: ['push', 'pull_request', 'issues'],
    default: ['push'],
  },
  lastDelivery: { type: Date, default: null },
  lastStatus: { type: String, enum: ['success', 'failure', null], default: null },
}, {
  timestamps: true,
});

webhookConfigSchema.index({ userId: 1 });

export default mongoose.model('WebhookConfig', webhookConfigSchema);

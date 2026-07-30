import mongoose from 'mongoose';

const integrationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  type: {
    type: String,
    enum: ['slack', 'webhook', 'email'],
    required: true,
  },
  name: { type: String, required: true },
  config: {
    url: { type: String, default: '' },
    channel: { type: String, default: '' },
    apiKey: { type: String, default: '' },
  },
  active: { type: Boolean, default: true },
  events: {
    type: [String],
    enum: ['security_alert', 'doc_generated', 'scan_completed', 'import_completed', 'drift_detected'],
    default: ['security_alert'],
  },
  lastTested: { type: Date, default: null },
  lastStatus: { type: String, enum: ['success', 'failure', null], default: null },
}, {
  timestamps: true,
});

integrationSchema.index({ userId: 1 });

export default mongoose.model('Integration', integrationSchema);

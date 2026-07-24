import mongoose from 'mongoose';

const securityIncidentSchema = new mongoose.Schema({
  repositoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Repository',
    required: true,
  },
  type: { type: String, required: true },
  severity: {
    type: String,
    enum: ['info', 'warning', 'high', 'critical'],
    default: 'warning',
  },
  file: { type: String, required: true },
  line: Number,
  maskedValue: String,
  status: {
    type: String,
    enum: ['open', 'resolved', 'dismissed'],
    default: 'open',
  },
  resolvedAt: Date,
  resolvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  confidence: {
    type: String,
    enum: ['high', 'medium', 'low'],
    default: 'high',
  },
  source: {
    type: String,
    enum: ['rule', 'ai'],
    default: 'rule',
  },
  explanation: { type: String },
  detectionLayer: {
    type: String,
    enum: ['regex', 'entropy', 'ai', 'validation'],
    default: 'regex',
  },
}, {
  timestamps: true,
});

securityIncidentSchema.index({ repositoryId: 1, status: 1 });
securityIncidentSchema.index({ severity: 1 });

const SecurityIncident = mongoose.model('SecurityIncident', securityIncidentSchema);
export default SecurityIncident;

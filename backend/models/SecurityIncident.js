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
}, {
  timestamps: true,
});

securityIncidentSchema.index({ repositoryId: 1, status: 1 });
securityIncidentSchema.index({ severity: 1 });

const SecurityIncident = mongoose.model('SecurityIncident', securityIncidentSchema);
export default SecurityIncident;

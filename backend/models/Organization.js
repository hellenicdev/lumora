import mongoose from 'mongoose';

const organizationSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  members: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    role: {
      type: String,
      enum: ['owner', 'admin', 'developer', 'viewer'],
      default: 'developer',
    },
    joinedAt: { type: Date, default: Date.now },
  }],
  plan: {
    type: String,
    enum: ['free', 'pro', 'team', 'enterprise'],
    default: 'free',
  },
}, {
  timestamps: true,
});

organizationSchema.index({ ownerId: 1 });
organizationSchema.index({ 'members.userId': 1 });

const Organization = mongoose.model('Organization', organizationSchema);
export default Organization;

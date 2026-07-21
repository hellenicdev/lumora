import mongoose from 'mongoose';

const settingsSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
  },
  notifications: {
    email: { type: Boolean, default: true },
    inApp: { type: Boolean, default: true },
    securityAlerts: { type: Boolean, default: true },
  },
  privacy: {
    profilePublic: { type: Boolean, default: false },
  },
}, {
  timestamps: true,
});

const Settings = mongoose.model('Settings', settingsSchema);
export default Settings;

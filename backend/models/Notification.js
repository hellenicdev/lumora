import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  type: {
    type: String,
    enum: ['info', 'warning', 'success', 'error', 'critical'],
    default: 'info',
  },
  title: {
    type: String,
    required: true,
  },
  message: String,
  link: String,
  read: {
    type: Boolean,
    default: false,
  },
  metadata: mongoose.Schema.Types.Mixed,
}, {
  timestamps: true,
});

notificationSchema.index({ userId: 1, read: 1 });
notificationSchema.index({ createdAt: -1 });

const Notification = mongoose.model('Notification', notificationSchema);
export default Notification;

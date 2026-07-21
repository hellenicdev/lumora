import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  password: {
    type: String,
    required: true,
    minlength: 8,
  },
  name: {
    type: String,
    trim: true,
    default: '',
  },
  role: {
    type: String,
    enum: ['guest', 'user', 'pro', 'team_admin', 'system_admin'],
    default: 'user',
  },
  isVerified: {
    type: Boolean,
    default: false,
  },
  verificationToken: String,
  verificationTokenExpires: Date,
  resetPasswordToken: String,
  resetPasswordExpires: Date,
  githubId: String,
  githubUsername: String,
  githubAccessToken: String,
  githubConnected: { type: Boolean, default: false },
  avatar: String,
  refreshTokens: [{
    token: String,
    expiresAt: Date,
  }],
  preferences: {
    theme: { type: String, enum: ['dark', 'light'], default: 'dark' },
    notifications: { type: Boolean, default: true },
  },
}, {
  timestamps: true,
});

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.toSafeObject = function () {
  return {
    id: this._id,
    email: this.email,
    name: this.name,
    role: this.role,
    isVerified: this.isVerified,
    avatar: this.avatar,
    githubUsername: this.githubUsername,
    preferences: this.preferences,
    createdAt: this.createdAt,
  };
};

userSchema.index({ role: 1 });

const User = mongoose.model('User', userSchema);
export default User;

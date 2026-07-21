import Organization from '../models/Organization.js';
import User from '../models/User.js';
import { sendEmail } from './emailService.js';
import { logger } from '../utils/logger.js';

export async function createOrganization(name, ownerId) {
  const org = await Organization.create({
    name,
    ownerId,
    members: [{ userId: ownerId, role: 'owner', joinedAt: new Date() }],
  });

  logger.info('Organization created', { organizationId: org._id, ownerId });
  return org;
}

export async function getOrganizations(userId) {
  const orgs = await Organization.find({
    $or: [
      { ownerId: userId },
      { 'members.userId': userId },
    ],
  }).lean();

  return orgs.map((org) => ({
    ...org,
    role: org.ownerId.toString() === userId.toString()
      ? 'owner'
      : org.members.find((m) => m.userId.toString() === userId.toString())?.role || 'viewer',
  }));
}

export async function getOrganization(orgId, userId) {
  const org = await Organization.findOne({
    _id: orgId,
    $or: [{ ownerId: userId }, { 'members.userId': userId }],
  }).lean();

  if (!org) throw new Error('Organization not found');

  const memberIds = org.members.map((m) => m.userId);
  const users = await User.find({ _id: { $in: memberIds } }).lean();
  const userMap = {};
  for (const u of users) userMap[u._id.toString()] = u;

  org.members = org.members.map((m) => ({
    ...m,
    user: userMap[m.userId.toString()] ? {
      id: userMap[m.userId.toString()]._id,
      name: userMap[m.userId.toString()].name,
      email: userMap[m.userId.toString()].email,
      avatar: userMap[m.userId.toString()].avatar,
    } : null,
  }));

  return org;
}

export async function inviteMember(orgId, email, role, inviterId) {
  const org = await Organization.findOne({ _id: orgId, ownerId: inviterId });
  if (!org) throw new Error('Only the organization owner can invite members');

  const validRoles = ['admin', 'developer', 'viewer'];
  if (!validRoles.includes(role)) throw new Error('Invalid role');

  const invitedUser = await User.findOne({ email });
  if (!invitedUser) throw new Error('User not found. They need to register first.');

  const alreadyMember = org.members.some(
    (m) => m.userId.toString() === invitedUser._id.toString(),
  );
  if (alreadyMember) throw new Error('User is already a member');

  org.members.push({
    userId: invitedUser._id,
    role,
    joinedAt: new Date(),
  });
  await org.save();

  try {
    await sendEmail({
      to: email,
      subject: `You've been invited to ${org.name}`,
      html: `<p>You've been invited to join <strong>${org.name}</strong> on Lumora as a ${role}.</p>`,
    });
  } catch (err) {
    logger.warn('Invite email failed', { email, error: err.message });
  }

  logger.info('Member invited', { organizationId: orgId, email, role });
  return org;
}

export async function removeMember(orgId, memberId, requesterId) {
  const org = await Organization.findOne({ _id: orgId, ownerId: requesterId });
  if (!org) throw new Error('Only the organization owner can remove members');

  if (memberId.toString() === requesterId.toString()) {
    throw new Error('Cannot remove yourself as owner');
  }

  org.members = org.members.filter(
    (m) => m.userId.toString() !== memberId.toString(),
  );
  await org.save();

  return org;
}

export async function updateMemberRole(orgId, memberId, newRole, requesterId) {
  const org = await Organization.findOne({ _id: orgId, ownerId: requesterId });
  if (!org) throw new Error('Only the organization owner can change roles');

  const member = org.members.find((m) => m.userId.toString() === memberId.toString());
  if (!member) throw new Error('Member not found');

  member.role = newRole;
  await org.save();

  return org;
}

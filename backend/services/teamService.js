import Organization from '../models/Organization.js';
import User from '../models/User.js';
import config from '../config/index.js';
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

  const alreadyInvited = org.pendingInvitations?.some(
    (inv) => inv.email === email,
  );
  if (alreadyInvited) throw new Error('User already has a pending invitation');

  org.pendingInvitations.push({
    email,
    role,
    invitedBy: inviterId,
    createdAt: new Date(),
  });
  await org.save();

  try {
    await sendEmail({
      to: email,
      subject: `You've been invited to ${org.name}`,
      html: `<p>You've been invited to join <strong>${org.name}</strong> on Lumora as a ${role}.</p>
<p><a href="${config.frontendUrl}/team.html" style="display:inline-block;padding:12px 24px;background:#6366f1;color:#fff;text-decoration:none;border-radius:6px;font-weight:600">View Invitation</a></p>
<p>Or copy this link into your browser:<br><a href="${config.frontendUrl}/team.html">${config.frontendUrl}/team.html</a></p>`,
    });
  } catch (err) {
    logger.warn('Invite email failed', { email, error: err.message });
  }

  logger.info('Member invited', { organizationId: orgId, email, role });
  return org;
}

export async function acceptInvitation(orgId, userId) {
  const user = await User.findById(userId);
  if (!user) throw new Error('User not found');

  const org = await Organization.findById(orgId);
  if (!org) throw new Error('Organization not found');

  const invitationIndex = org.pendingInvitations?.findIndex(
    (inv) => inv.email === user.email,
  );
  if (invitationIndex === -1 || invitationIndex === undefined) {
    throw new Error('No pending invitation found');
  }

  const invitation = org.pendingInvitations[invitationIndex];

  org.members.push({
    userId,
    role: invitation.role,
    joinedAt: new Date(),
  });

  org.pendingInvitations.splice(invitationIndex, 1);
  await org.save();

  logger.info('Invitation accepted', { organizationId: orgId, userId });
  return org;
}

export async function rejectInvitation(orgId, email) {
  const org = await Organization.findById(orgId);
  if (!org) throw new Error('Organization not found');

  const invitationIndex = org.pendingInvitations?.findIndex(
    (inv) => inv.email === email,
  );
  if (invitationIndex === -1 || invitationIndex === undefined) {
    throw new Error('No pending invitation found');
  }

  org.pendingInvitations.splice(invitationIndex, 1);
  await org.save();

  logger.info('Invitation rejected', { organizationId: orgId, email });
  return org;
}

export async function getUserInvitations(userId) {
  const user = await User.findById(userId);
  if (!user) return [];

  const orgs = await Organization.find({
    'pendingInvitations.email': user.email,
  }).lean();

  return orgs.map((org) => {
    const invitation = org.pendingInvitations.find((inv) => inv.email === user.email);
    return {
      organizationId: org._id,
      organizationName: org.name,
      role: invitation.role,
      invitedAt: invitation.createdAt,
    };
  });
}

export async function leaveOrganization(orgId, userId) {
  const org = await Organization.findById(orgId);
  if (!org) throw new Error('Organization not found');

  if (org.ownerId.toString() === userId.toString()) {
    throw new Error('Owner cannot leave. Transfer ownership or delete the organization instead.');
  }

  const memberIndex = org.members.findIndex(
    (m) => m.userId.toString() === userId.toString(),
  );
  if (memberIndex === -1) throw new Error('You are not a member of this organization');

  org.members.splice(memberIndex, 1);
  await org.save();

  logger.info('Member left organization', { organizationId: orgId, userId });
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

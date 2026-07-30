import Integration from '../models/Integration.js';
import { logger } from '../utils/logger.js';

export async function listIntegrations(userId) {
  return Integration.find({ userId }).sort({ createdAt: -1 }).lean();
}

export async function createIntegration(userId, data) {
  const existing = await Integration.countDocuments({ userId });
  if (existing >= 10) throw new Error('Maximum 10 integrations allowed');

  const integration = await Integration.create({
    userId,
    type: data.type,
    name: data.name,
    config: {
      url: data.url || '',
      channel: data.channel || '',
      apiKey: data.apiKey || '',
    },
    events: data.events || ['security_alert'],
  });

  return integration;
}

export async function updateIntegration(userId, integrationId, data) {
  const integration = await Integration.findOneAndUpdate(
    { _id: integrationId, userId },
    {
      $set: {
        name: data.name,
        'config.url': data.url,
        'config.channel': data.channel,
        active: data.active !== undefined ? data.active : true,
        events: data.events,
      },
    },
    { new: true, runValidators: true }
  );
  if (!integration) throw new Error('Integration not found');
  return integration;
}

export async function deleteIntegration(userId, integrationId) {
  const integration = await Integration.findOneAndDelete({ _id: integrationId, userId });
  if (!integration) throw new Error('Integration not found');
  return integration;
}

export async function testIntegration(userId, integrationId) {
  const integration = await Integration.findOne({ _id: integrationId, userId });
  if (!integration) throw new Error('Integration not found');

  const result = await sendNotification(integration, {
    type: 'test',
    title: 'Test notification from Lumora',
    message: 'Your integration is working correctly.',
  });

  integration.lastTested = new Date();
  integration.lastStatus = result.success ? 'success' : 'failure';
  await integration.save();

  return { success: result.success, message: result.message };
}

export async function notifyIntegrations(userId, event, payload) {
  try {
    const integrations = await Integration.find({ userId, active: true, events: event });
    if (integrations.length === 0) return;

    await Promise.allSettled(
      integrations.map((integration) => sendNotification(integration, payload))
    );
  } catch (err) {
    logger.error('Integration notification failed', { userId, event, error: err.message });
  }
}

async function sendNotification(integration, payload) {
  const { type, title, message } = payload;

  try {
    if (integration.type === 'slack' || integration.type === 'webhook') {
      const url = integration.config.url;
      if (!url) return { success: false, message: 'No URL configured' };

      const blocks = [
        { type: 'header', text: { type: 'plain_text', text: title } },
        { type: 'section', text: { type: 'mrkdwn', text: message } },
      ];

      if (payload.link) {
        blocks.push({ type: 'section', text: { type: 'mrkdwn', text: `<${payload.link}|View in Lumora>` } });
      }

      const body = integration.type === 'slack'
        ? { text: title, blocks }
        : { title, message, link: payload.link };

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const text = await response.text();
        return { success: false, message: `HTTP ${response.status}: ${text}` };
      }

      return { success: true, message: 'Notification sent' };
    }

    if (integration.type === 'email') {
      return { success: false, message: 'Email integration not yet supported' };
    }

    return { success: false, message: 'Unknown integration type' };
  } catch (err) {
    return { success: false, message: err.message };
  }
}

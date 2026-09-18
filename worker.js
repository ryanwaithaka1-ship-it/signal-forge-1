import crypto from 'node:crypto';

// Sending Schedule & Rate Limit Rules
const SENDING_CONFIG = {
  windowStartHour: 9,   // 09:00 AM
  windowEndHour: 17,    // 05:00 PM
  allowedDays: [1, 2, 3, 4, 5], // Mon - Fri
  maxPerCycle: 2,
  maxPerHour: 5,
  maxPerDay: 33,
  maxPerMonth: 1000,
};

export function getHealth() {
  return {
    status: 'RUNNING',
    uptime: process.uptime(),
    config: SENDING_CONFIG,
  };
}

// Generates personalized 4-line cold email
export function generateOutreachEmail(lead) {
  const channelName = lead.channel || 'your channel';
  const topic = lead.topic || 'your content';

  const subject = `quick question re: ${channelName}`.toLowerCase();
  const hook = `Loved your recent video on ${topic}—the breakdown was spot on.`;
  const valueProp = `We help creators automate lead distribution and pipeline state sync without breaking deliverability.`;
  const cta = `Open to taking a look at a 2-min breakdown?`;
  const signoff = `Best,\nRyan`;

  return {
    subject,
    text: `${hook}\n\n${valueProp}\n\n${cta}\n\n${signoff}`,
  };
}

// Validates safety and sending schedule gates
export function validateLeadForDispatch(lead) {
  if (lead.verification !== 'ELIGIBLE') {
    return {
      allowed: false,
      reason: `Lead status is ${lead.verification}. Dispatch blocked (requires ELIGIBLE).`,
    };
  }

  const now = new Date();
  const currentDay = now.getDay();
  const currentHour = now.getHours();

  const isBusinessDay = SENDING_CONFIG.allowedDays.includes(currentDay);
  const isBusinessHours = currentHour >= SENDING_CONFIG.windowStartHour && currentHour < SENDING_CONFIG.windowEndHour;

  if (!isBusinessDay || !isBusinessHours) {
    return {
      allowed: false,
      reason: 'Outside sending window (Mon-Fri, 09:00-17:00). Lead held in queue.',
    };
  }

  return { allowed: true };
}

export async function handleTaskadeEvent(event) {
  const lead = event.lead || event;
  const validation = validateLeadForDispatch(lead);

  if (!validation.allowed) {
    return { processed: false, reason: validation.reason };
  }

  const emailContent = generateOutreachEmail(lead);
  return { processed: true, email: emailContent };
}

export async function handleResendEvent(event) {
  return { status: 'recorded', event_type: event.type };
}

export function startEngine() {
  console.log('Engine worker initialized.');
}

export async function stopEngine() {
  console.log('Engine stopped.');
}

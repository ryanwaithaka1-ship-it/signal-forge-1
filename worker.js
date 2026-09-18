import crypto from 'node:crypto';

export function getHealth() {
  return {
    status: 'RUNNING',
    uptime: process.uptime(),
  };
}

export async function handleTaskadeEvent(event) {
  return { processed: true, event: event.type || 'unknown' };
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

import 'dotenv/config';
import express from 'express';
import crypto from 'node:crypto';
import { Resend } from 'resend';
import {
  getHealth,
  handleTaskadeEvent,
  handleResendEvent,
  startEngine,
  stopEngine,
} from './worker.js';

const app = express();
const port = Number(process.env.PORT || 3000);

app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));

app.get('/health', async (_req, res) => {
  try {
    const health = getHealth();
    res.status(200).json({
      ok: true,
      service: 'signalforge-worker',
      timestamp: new Date().toISOString(),
      ...health,
    });
  } catch (error) {
    res.status(503).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Health check failed',
    });
  }
});

function safeCompare(value, expected) {
  if (!value || !expected) return false;
  const received = Buffer.from(value);
  const target = Buffer.from(expected);
  if (received.length !== target.length) return false;
  return crypto.timingSafeEqual(received, target);
}

function verifyResendSignature(req, rawBody) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) return false;
  const signature = req.get('svix-signature') || req.get('x-resend-signature');
  if (!signature) return false;
  const timestamp = req.get('svix-timestamp') || '';
  const signedPayload = `${timestamp}.${rawBody}`;
  const expected = crypto.createHmac('sha256', secret).update(signedPayload).digest('base64');
  return signature
    .split(' ')
    .map((item) => item.replace(/^v\d+,/, ''))
    .some((item) => safeCompare(item, expected));
}

app.post('/api/taskade-hook', async (req, res) => {
  try {
    const result = await handleTaskadeEvent(req.body);
    res.status(202).json({ ok: true, accepted: true, ...result });
  } catch (error) {
    res.status(400).json({ ok: false, error: error instanceof Error ? error.message : 'Invalid Taskade event' });
  }
});

app.post('/api/resend-webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const rawBody = req.body.toString('utf8');
    if (!verifyResendSignature(req, rawBody)) {
      return res.status(401).json({ ok: false, error: 'Invalid Resend webhook signature' });
    }
    const event = JSON.parse(rawBody);
    const result = await handleResendEvent(event);
    return res.status(200).json({ ok: true, ...result });
  } catch (error) {
    return res.status(400).json({ ok: false, error: error instanceof Error ? error.message : 'Invalid Resend event' });
  }
});

const server = app.listen(port, () => {
  console.log(`SignalForge worker listening on port ${port}`);
});

startEngine();

async function shutdown(signal) {
  console.log(`${signal} received. Stopping workers...`);
  await stopEngine();
  server.close(() => process.exit(0));
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

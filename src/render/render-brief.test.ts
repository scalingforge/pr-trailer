import { describe, expect, it } from 'vitest';
import { composeCommentBody } from './render-brief';
import type { Brief } from '../api/jobs-client';

const baseBrief: Brief = {
  summary: 'Adds a login feature with token-based session handling and a new /login route.',
  intent: 'Add a login feature',
  riskLevel: 'high',
  files: [
    { path: 'src/auth/session.ts', risk: 'high', reason: 'Touches token expiry logic' },
    { path: 'README.md', risk: 'low', reason: 'Docs only' },
  ],
  readOrder: ['src/auth/session.ts', 'README.md'],
  openQuestions: ['Is the token TTL configurable?'],
};

const emptyBrief: Brief = {
  summary: 'Fix a typo in the README.',
  intent: 'Fix a typo',
  riskLevel: 'low',
  files: [],
  readOrder: [],
  openQuestions: [],
};

describe('composeCommentBody', () => {
  it('renders the three fixed lines, in order, with audio present', () => {
    const body = composeCommentBody(baseBrief, {
      url: 'https://cdn.example/audio.mp3',
      expiresAt: '2026-08-01T00:00:00.000Z',
      durationSeconds: 42,
    });

    const lines = body.split('\n');
    expect(lines[0]).toBe('**Risk Score:** 🔴 High');
    expect(lines[1]).toBe(
      '**Intent Summary:** Adds a login feature with token-based session handling and a new /login route.',
    );
    expect(lines[2]).toBe(
      '**PR trailer Audio:** 🔊 [Listen to the PR trailer](https://cdn.example/audio.mp3) (~42s)',
    );
  });

  it('renders the fixed fallback audio line when audio is null', () => {
    const body = composeCommentBody(baseBrief, null);

    const lines = body.split('\n');
    expect(lines[2]).toBe('**PR trailer Audio:** 🔇 Not generated for this run');
  });

  it.each([
    ['low', '🟢 Low'],
    ['medium', '🟡 Medium'],
    ['high', '🔴 High'],
  ] as const)('renders the %s risk icon and label', (riskLevel, expected) => {
    const body = composeCommentBody({ ...baseBrief, riskLevel }, null);

    expect(body.split('\n')[0]).toBe(`**Risk Score:** ${expected}`);
  });

  it('renders the same three-line shape regardless of files/readOrder/openQuestions content', () => {
    const fullBody = composeCommentBody(baseBrief, null);
    const emptyBody = composeCommentBody(emptyBrief, null);

    const shapeOf = (body: string) => body.split('\n').map((line) => line.split(':')[0]);
    expect(shapeOf(fullBody)).toEqual(shapeOf(emptyBody));
    expect(fullBody.split('\n')).toHaveLength(3);
    expect(emptyBody.split('\n')).toHaveLength(3);
  });

  it('never includes the old table, heading, or list sections', () => {
    const body = composeCommentBody(baseBrief, {
      url: 'https://cdn.example/audio.mp3',
      expiresAt: '2026-08-01T00:00:00.000Z',
      durationSeconds: 42,
    });

    expect(body).not.toContain('Review Brief');
    expect(body).not.toContain('| File | Risk | Why |');
    expect(body).not.toContain('Suggested reading order');
    expect(body).not.toContain('Open questions');
  });
});

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
  it('renders the four sections, in order (risk, audio, intent brief, intent description), separated by a blank line', () => {
    const body = composeCommentBody(baseBrief, {
      url: 'https://cdn.example/audio.mp3',
      expiresAt: '2026-08-01T00:00:00.000Z',
      durationSeconds: 42,
    });

    const sections = body.split('\n\n');
    expect(sections).toHaveLength(4);
    expect(sections[0]).toBe('**Risk Score:** 🔴 High');
    expect(sections[1]).toBe(
      '**PR trailer Audio:** 🔊 <a href="https://cdn.example/audio.mp3" target="_blank" rel="noopener noreferrer">Listen to the PR trailer</a> (~42s)',
    );
    expect(sections[2]).toBe('**Intent Brief:** Add a login feature');
    expect(sections[3]).toBe(
      '**Intent Description:** Adds a login feature with token-based session handling and a new /login route.',
    );
  });

  it('renders the fixed fallback audio line when audio is null, with no link markup', () => {
    const body = composeCommentBody(baseBrief, null);

    const sections = body.split('\n\n');
    expect(sections[1]).toBe('**PR trailer Audio:** 🔇 Not generated for this run');
    expect(body).not.toContain('target="_blank"');
  });

  it.each([
    ['low', '🟢 Low'],
    ['medium', '🟡 Medium'],
    ['high', '🔴 High'],
  ] as const)('renders the %s risk icon and label', (riskLevel, expected) => {
    const body = composeCommentBody({ ...baseBrief, riskLevel }, null);

    expect(body.split('\n\n')[0]).toBe(`**Risk Score:** ${expected}`);
  });

  it('renders the same four-section shape regardless of files/readOrder/openQuestions content', () => {
    const fullBody = composeCommentBody(baseBrief, null);
    const emptyBody = composeCommentBody(emptyBrief, null);

    const shapeOf = (body: string) => body.split('\n\n').map((section) => section.split(':')[0]);
    expect(shapeOf(fullBody)).toEqual(shapeOf(emptyBody));
    expect(fullBody.split('\n\n')).toHaveLength(4);
    expect(emptyBody.split('\n\n')).toHaveLength(4);
  });

  it('opens the audio link in a new tab via target="_blank" with rel="noopener noreferrer"', () => {
    const body = composeCommentBody(baseBrief, {
      url: 'https://cdn.example/audio.mp3',
      expiresAt: '2026-08-01T00:00:00.000Z',
      durationSeconds: 42,
    });

    expect(body).toContain(
      '<a href="https://cdn.example/audio.mp3" target="_blank" rel="noopener noreferrer">Listen to the PR trailer</a>',
    );
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

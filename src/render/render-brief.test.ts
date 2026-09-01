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
  it('renders the exact fixed layout, with audio present', () => {
    const body = composeCommentBody(baseBrief, {
      url: 'https://cdn.example/audio.mp3',
      expiresAt: '2026-08-01T00:00:00.000Z',
      durationSeconds: 42,
    });

    expect(body).toBe(
      [
        '**Risk Score:** 🔴 High',
        '',
        '**PR trailer Audio:** 🔊 [Listen PR trailer](https://cdn.example/audio.mp3) (open a new tab, ~42s)',
        '',
        '**Intent Brief:** Add a login feature',
        '',
        '<details>',
        '<summary>Intent Description</summary>',
        '',
        'Adds a login feature with token-based session handling and a new /login route.',
        '</details>',
      ].join('\n'),
    );
  });

  it('renders the fixed fallback audio line when audio is null, with no link markup', () => {
    const body = composeCommentBody(baseBrief, null);

    expect(body).toContain('**PR trailer Audio:** 🔇 Not generated for this run');
    expect(body).not.toContain('[Listen PR trailer]');
  });

  it.each([
    ['low', '🟢 Low'],
    ['medium', '🟡 Medium'],
    ['high', '🔴 High'],
  ] as const)('renders the %s risk icon and label', (riskLevel, expected) => {
    const body = composeCommentBody({ ...baseBrief, riskLevel }, null);

    expect(body.startsWith(`**Risk Score:** ${expected}`)).toBe(true);
  });

  it('puts a blank line between <summary> and its content, so GitHub renders "Intent Description" as the disclosure label instead of falling back to a generic one', () => {
    const body = composeCommentBody(baseBrief, null);

    expect(body).toContain('<summary>Intent Description</summary>\n\n');
  });

  it('collapses Intent Description behind a <details> disclosure, default-closed (no "open" attribute)', () => {
    const body = composeCommentBody(baseBrief, null);

    expect(body).toContain('<details>\n<summary>Intent Description</summary>');
    expect(body).not.toContain('<details open>');
    expect(body).toContain('</details>');
    expect(body.trimEnd().endsWith('</details>')).toBe(true);
  });

  it('renders the same fixed labels regardless of files/readOrder/openQuestions content', () => {
    const fullBody = composeCommentBody(baseBrief, null);
    const emptyBody = composeCommentBody(emptyBrief, null);

    for (const body of [fullBody, emptyBody]) {
      expect(body).toMatch(/^\*\*Risk Score:\*\*/);
      expect(body).toContain('**PR trailer Audio:**');
      expect(body).toContain('**Intent Brief:**');
      expect(body).toContain('<summary>Intent Description</summary>');
    }
  });

  it('uses a plain markdown link with a text hint to open in a new tab (GitHub strips target="_blank" from comment HTML)', () => {
    const body = composeCommentBody(baseBrief, {
      url: 'https://cdn.example/audio.mp3',
      expiresAt: '2026-08-01T00:00:00.000Z',
      durationSeconds: 42,
    });

    expect(body).toContain('[Listen PR trailer](https://cdn.example/audio.mp3) (open a new tab, ~42s)');
    expect(body).not.toContain('target="_blank"');
    expect(body).not.toContain('<a ');
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

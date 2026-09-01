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
      '**PR trailer Audio:** 🔊 [Listen PR trailer](https://cdn.example/audio.mp3) (open a new tab, ~42s)',
    );
    expect(sections[2]).toBe('**Intent Brief:** Add a login feature');
    expect(sections[3]).toBe(
      '<details>\n<summary>Intent Description</summary>\nAdds a login feature with token-based session handling and a new /login route.\n</details>',
    );
  });

  it('collapses Intent Description behind a <details> disclosure, default-closed, so the visible comment is 3 short lines', () => {
    const body = composeCommentBody(baseBrief, null);
    const sections = body.split('\n\n');

    // The first 3 sections carry the always-visible, glance-scale content.
    expect(sections[0]).toMatch(/^\*\*Risk Score:\*\*/);
    expect(sections[1]).toMatch(/^\*\*PR trailer Audio:\*\*/);
    expect(sections[2]).toMatch(/^\*\*Intent Brief:\*\*/);

    // The 4th section is the collapsed disclosure — no "open" attribute, so
    // it renders closed by default.
    expect(sections[3]).toContain('<details>');
    expect(sections[3]).not.toContain('<details open>');
    expect(sections[3]).toContain('<summary>Intent Description</summary>');
    expect(sections[3]).toContain('</details>');
    expect(sections[3]).toContain(baseBrief.summary);
  });

  it('renders the fixed fallback audio line when audio is null, with no link markup', () => {
    const body = composeCommentBody(baseBrief, null);

    const sections = body.split('\n\n');
    expect(sections[1]).toBe('**PR trailer Audio:** 🔇 Not generated for this run');
    expect(body).not.toContain('[Listen PR trailer]');
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

    for (const body of [fullBody, emptyBody]) {
      const sections = body.split('\n\n');
      expect(sections).toHaveLength(4);
      expect(sections[0]).toMatch(/^\*\*Risk Score:\*\*/);
      expect(sections[1]).toMatch(/^\*\*PR trailer Audio:\*\*/);
      expect(sections[2]).toMatch(/^\*\*Intent Brief:\*\*/);
      expect(sections[3]).toBe(
        `<details>\n<summary>Intent Description</summary>\n${body === fullBody ? baseBrief.summary : emptyBrief.summary}\n</details>`,
      );
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

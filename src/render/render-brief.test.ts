import { describe, expect, it } from 'vitest';
import { composeCommentBody, renderBrief } from './render-brief';
import type { Brief } from '../api/jobs-client';

const fullBrief: Brief = {
  summary: 'Adds a login feature.',
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
  summary: 'Trivial change.',
  intent: 'Fix a typo',
  riskLevel: 'low',
  files: [],
  readOrder: [],
  openQuestions: [],
};

describe('renderBrief', () => {
  it('includes the summary, intent, and overall risk', () => {
    const markdown = renderBrief(fullBrief);

    expect(markdown).toContain('Adds a login feature.');
    expect(markdown).toContain('Add a login feature');
    expect(markdown).toContain('High');
  });

  it('renders a risk table row per file', () => {
    const markdown = renderBrief(fullBrief);

    expect(markdown).toContain('`src/auth/session.ts`');
    expect(markdown).toContain('Touches token expiry logic');
    expect(markdown).toContain('`README.md`');
  });

  it('renders the suggested reading order as a numbered list', () => {
    const markdown = renderBrief(fullBrief);

    expect(markdown).toContain('1. `src/auth/session.ts`');
    expect(markdown).toContain('2. `README.md`');
  });

  it('renders open questions as a bullet list', () => {
    const markdown = renderBrief(fullBrief);

    expect(markdown).toContain('Is the token TTL configurable?');
  });

  it('omits the risk table, reading order, and open-questions sections when empty', () => {
    const markdown = renderBrief(emptyBrief);

    expect(markdown).not.toContain('| File | Risk | Why |');
    expect(markdown).not.toContain('Suggested reading order');
    expect(markdown).not.toContain('Open questions');
  });
});

describe('composeCommentBody', () => {
  it('prefixes the audio link line, with duration, when audio is present', () => {
    const body = composeCommentBody(fullBrief, {
      url: 'https://cdn.example/audio.mp3',
      expiresAt: '2026-08-01T00:00:00.000Z',
      durationSeconds: 42,
    });

    expect(body.startsWith('🔊 [Listen to the PR trailer](https://cdn.example/audio.mp3) (~42s)')).toBe(true);
    expect(body).toContain(renderBrief(fullBrief));
  });

  it('omits the audio line entirely when audio is null', () => {
    const body = composeCommentBody(fullBrief, null);

    expect(body).not.toContain('Listen to the PR trailer');
    expect(body).toBe(renderBrief(fullBrief));
  });
});

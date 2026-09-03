import type { AudioInfo, Brief, QuotaExceededUsage, RiskLevel, UsageSnapshot } from '../api/jobs-client';

const RISK_EMOJI: Record<RiskLevel, string> = {
  low: '🟢',
  medium: '🟡',
  high: '🔴',
};

export function composeCommentBody(brief: Brief, audio: AudioInfo | null, usage: UsageSnapshot | null): string {
  const riskLine = `**Risk Score:** ${RISK_EMOJI[brief.riskLevel]} ${capitalize(brief.riskLevel)}`;
  const audioLine = `**PR trailer Audio:** ${renderAudio(audio)}`;
  const intentBriefLine = `**Intent Brief:** ${brief.intent}`;
  const intentDescriptionSection = `<details>\n<summary>Intent Description</summary>\n\n${brief.summary}\n</details>`;

  const sections = [riskLine, audioLine, intentBriefLine, intentDescriptionSection];
  const usageLine = renderUsageLine(usage);
  if (usageLine) {
    sections.push(usageLine);
  }

  return sections.join('\n\n');
}

export function composeQuotaExceededCommentBody(usage: QuotaExceededUsage): string {
  return `**PR trailer plan limit reached** (${usage.used}/${usage.cap} runs this month) — resets ${formatResetsAt(usage.resetsAt)}.`;
}

function renderUsageLine(usage: UsageSnapshot | null): string | null {
  if (!usage) {
    return null;
  }
  return `**Usage:** ${usage.used}/${usage.cap} runs this month · resets ${formatResetsAt(usage.resetsAt)}`;
}

function formatResetsAt(resetsAt: string): string {
  return new Date(resetsAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

function renderAudio(audio: AudioInfo | null): string {
  if (!audio) {
    return '🔇 Not generated for this run';
  }
  return `🔊 [Listen PR trailer](${audio.url}) (open a new tab, ~${audio.durationSeconds}s)`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

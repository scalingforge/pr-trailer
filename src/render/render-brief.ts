import type { AudioInfo, Brief, RiskLevel } from '../api/jobs-client';

const RISK_EMOJI: Record<RiskLevel, string> = {
  low: '🟢',
  medium: '🟡',
  high: '🔴',
};

export function composeCommentBody(brief: Brief, audio: AudioInfo | null): string {
  const riskLine = `**Risk Score:** ${RISK_EMOJI[brief.riskLevel]} ${capitalize(brief.riskLevel)}`;
  const audioLine = `**PR trailer Audio:** ${renderAudio(audio)}`;
  const intentBriefLine = `**Intent Brief:** ${brief.intent}`;
  const intentDescriptionLine = `**Intent Description:** ${brief.summary}`;

  return [riskLine, audioLine, intentBriefLine, intentDescriptionLine].join('\n\n');
}

function renderAudio(audio: AudioInfo | null): string {
  if (!audio) {
    return '🔇 Not generated for this run';
  }
  return `🔊 <a href="${audio.url}" target="_blank" rel="noopener noreferrer">Listen to the PR trailer</a> (~${audio.durationSeconds}s)`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

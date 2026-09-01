import type { AudioInfo, Brief, RiskLevel } from '../api/jobs-client';

const RISK_EMOJI: Record<RiskLevel, string> = {
  low: '🟢',
  medium: '🟡',
  high: '🔴',
};

export function composeCommentBody(brief: Brief, audio: AudioInfo | null): string {
  const riskLine = `**Risk Score:** ${RISK_EMOJI[brief.riskLevel]} ${capitalize(brief.riskLevel)}`;
  const intentLine = `**Intent Summary:** ${brief.summary}`;
  const audioLine = `**PR trailer Audio:** ${renderAudio(audio)}`;

  return [riskLine, intentLine, audioLine].join('\n');
}

function renderAudio(audio: AudioInfo | null): string {
  if (!audio) {
    return '🔇 Not generated for this run';
  }
  return `🔊 [Listen to the PR trailer](${audio.url}) (~${audio.durationSeconds}s)`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

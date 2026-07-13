import type { AudioInfo, Brief, RiskLevel } from '../api/jobs-client';

const RISK_EMOJI: Record<RiskLevel, string> = {
  low: '🟢',
  medium: '🟡',
  high: '🔴',
};

export function renderBrief(brief: Brief): string {
  const lines: string[] = [];

  lines.push('## 🚦 Review Brief.  Check it out!');
  lines.push('');
  lines.push(brief.summary);
  lines.push('');
  lines.push(`**Intent:** ${brief.intent}`);
  lines.push(`**Overall risk:** ${RISK_EMOJI[brief.riskLevel]} ${capitalize(brief.riskLevel)}`);

  if (brief.files.length > 0) {
    lines.push('');
    lines.push('| File | Risk | Why |');
    lines.push('|---|---|---|');
    for (const file of brief.files) {
      lines.push(`| \`${file.path}\` | ${RISK_EMOJI[file.risk]} ${capitalize(file.risk)} | ${file.reason} |`);
    }
  }

  if (brief.readOrder.length > 0) {
    lines.push('');
    lines.push('### Suggested reading order');
    brief.readOrder.forEach((path, i) => {
      lines.push(`${i + 1}. \`${path}\``);
    });
  }

  if (brief.openQuestions.length > 0) {
    lines.push('');
    lines.push('### Open questions');
    for (const question of brief.openQuestions) {
      lines.push(`- ${question}`);
    }
  }

  return lines.join('\n');
}

export function composeCommentBody(brief: Brief, audio: AudioInfo | null): string {
  const parts: string[] = [];
  if (audio) {
    parts.push(`🔊 [Listen to the PR trailer](${audio.url}) (~${audio.durationSeconds}s)`);
  }
  parts.push(renderBrief(brief));
  return parts.join('\n\n');
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

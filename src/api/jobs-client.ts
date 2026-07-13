export type RiskLevel = 'low' | 'medium' | 'high';

export interface BriefFile {
  path: string;
  risk: RiskLevel;
  reason: string;
}

export interface Brief {
  summary: string;
  intent: string;
  riskLevel: RiskLevel;
  files: BriefFile[];
  readOrder: string[];
  openQuestions: string[];
}

export interface AudioInfo {
  url: string;
  expiresAt: string;
  durationSeconds: number;
}

export interface JobResponse {
  status: 'queued' | 'processing' | 'done' | 'error';
  brief: Brief | null;
  audio: AudioInfo | null;
  error: string | null;
}

export interface PrInput {
  title: string;
  body: string;
  commitMessages: string[];
}

export type PrFileStatus = 'added' | 'removed' | 'modified' | 'renamed' | 'copied' | 'changed' | 'unchanged';

export interface PrFile {
  path: string;
  patch: string;
  additions: number;
  deletions: number;
  status: PrFileStatus;
}

export class JobSubmissionError extends Error {
  constructor(
    public readonly kind: 'unauthorized' | 'rejected',
    message: string,
  ) {
    super(message);
    this.name = 'JobSubmissionError';
  }
}

export async function submitJob(
  apiUrl: string,
  apiKey: string,
  pr: PrInput,
  files: PrFile[],
  fetchFn: typeof fetch = fetch,
): Promise<string> {
  const response = await fetchFn(`${apiUrl}/v1/jobs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': apiKey,
    },
    body: JSON.stringify({ pr, files }),
  });

  if (response.status === 401) {
    throw new JobSubmissionError('unauthorized', 'pr-trailer-api rejected the request: invalid api-key.');
  }
  if (!response.ok) {
    const bodyText = await response.text().catch(() => '');
    throw new JobSubmissionError(
      'rejected',
      `pr-trailer-api job submission failed with status ${response.status}: ${bodyText.slice(0, 500) || '(empty body)'}`,
    );
  }

  const body = (await response.json()) as { jobId: string };
  return body.jobId;
}

export interface PollDeps {
  fetchFn?: typeof fetch;
  sleepFn?: (ms: number) => Promise<void>;
  now?: () => number;
  onStatus?: (status: JobResponse['status']) => void;
}

export type PollResult =
  | { outcome: 'done'; job: JobResponse & { brief: Brief } }
  | { outcome: 'error' }
  | { outcome: 'timeout' };

const POLL_CEILING_MS = 6 * 60 * 1000;
const POLL_START_DELAY_MS = 2000;
const POLL_MAX_DELAY_MS = 10000;
const POLL_BACKOFF_FACTOR = 1.5;

export async function pollJob(
  apiUrl: string,
  apiKey: string,
  jobId: string,
  deps: PollDeps = {},
): Promise<PollResult> {
  const fetchFn = deps.fetchFn ?? fetch;
  const sleepFn = deps.sleepFn ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const now = deps.now ?? Date.now;

  const startedAt = now();
  let delayMs = POLL_START_DELAY_MS;

  for (;;) {
    const response = await fetchFn(`${apiUrl}/v1/jobs/${jobId}`, {
      headers: { 'X-Api-Key': apiKey },
    });
    if (!response.ok) {
      const bodyText = await response.text().catch(() => '');
      throw new Error(
        `pr-trailer-api job status check for ${jobId} failed with status ${response.status}: ${bodyText.slice(0, 500) || '(empty body)'}`,
      );
    }
    const job = (await response.json()) as JobResponse;
    deps.onStatus?.(job.status);

    if (job.status === 'done') {
      if (!job.brief) {
        throw new Error(`Job ${jobId} reported status "done" without a brief.`);
      }
      return { outcome: 'done', job: job as JobResponse & { brief: Brief } };
    }
    if (job.status === 'error') {
      return { outcome: 'error' };
    }
    if (now() - startedAt >= POLL_CEILING_MS) {
      return { outcome: 'timeout' };
    }

    await sleepFn(delayMs);
    delayMs = Math.min(delayMs * POLL_BACKOFF_FACTOR, POLL_MAX_DELAY_MS);
  }
}

import { describe, expect, it, vi, beforeEach } from 'vitest';

const getInputMock = vi.fn();
const setFailedMock = vi.fn();
const infoMock = vi.fn();
const warningMock = vi.fn();

vi.mock('@actions/core', () => ({
  getInput: (...args: unknown[]) => getInputMock(...args),
  setFailed: (...args: unknown[]) => setFailedMock(...args),
  info: (...args: unknown[]) => infoMock(...args),
  warning: (...args: unknown[]) => warningMock(...args),
}));

let payload: { pull_request?: Record<string, unknown> } = {};

vi.mock('@actions/github', () => ({
  getOctokit: vi.fn(() => ({ fakeOctokit: true })),
  get context() {
    return { payload, repo: { owner: 'acme', repo: 'widgets' } };
  },
}));

const extractPrContextMock = vi.fn();
vi.mock('./github/extract-context', () => ({
  extractPrContext: (...args: unknown[]) => extractPrContextMock(...args),
}));

const submitJobMock = vi.fn();
const pollJobMock = vi.fn();
class FakeJobSubmissionError extends Error {
  constructor(
    public readonly kind: 'unauthorized' | 'rejected' | 'quota_exceeded',
    message: string,
    public readonly usage?: { used: number; cap: number; resetsAt: string },
  ) {
    super(message);
    this.name = 'JobSubmissionError';
  }
}
vi.mock('./api/jobs-client', () => ({
  submitJob: (...args: unknown[]) => submitJobMock(...args),
  pollJob: (...args: unknown[]) => pollJobMock(...args),
  JobSubmissionError: FakeJobSubmissionError,
}));

const upsertPrCommentMock = vi.fn();
vi.mock('./github/upsert-comment', () => ({
  upsertPrComment: (...args: unknown[]) => upsertPrCommentMock(...args),
}));

function setInputs(overrides: Record<string, string> = {}) {
  const defaults: Record<string, string> = {
    'api-key': 'k',
    'api-url': 'https://api.example',
    'github-token': 't',
    'exclude-files': '',
    verbosity: 'info',
  };
  const inputs = { ...defaults, ...overrides };
  getInputMock.mockImplementation((name: string) => inputs[name] ?? '');
}

describe('run() quota_exceeded handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    payload = { pull_request: { number: 7, title: 'Add feature', body: 'body' } };
    setInputs();
    extractPrContextMock.mockResolvedValue({ title: 'Add feature', body: 'body', commitMessages: [], files: [] });
  });

  it('posts a quota-exceeded comment and does not call core.setFailed', async () => {
    submitJobMock.mockRejectedValue(
      new FakeJobSubmissionError('quota_exceeded', 'quota exceeded', {
        used: 50,
        cap: 50,
        resetsAt: '2026-10-01T00:00:00.000Z',
      }),
    );
    const { run } = await import('./index');

    await run();

    expect(upsertPrCommentMock).toHaveBeenCalledTimes(1);
    const commentBody = upsertPrCommentMock.mock.calls[0][2] as string;
    expect(commentBody).toContain('50/50 runs this month');
    expect(setFailedMock).not.toHaveBeenCalled();
  });

  it('still calls core.setFailed for a non-quota JobSubmissionError (e.g. unauthorized)', async () => {
    submitJobMock.mockRejectedValue(new FakeJobSubmissionError('unauthorized', 'bad key'));
    const { run } = await import('./index');

    await run();

    expect(setFailedMock).toHaveBeenCalledWith('bad key');
    expect(upsertPrCommentMock).not.toHaveBeenCalled();
  });
});

describe('run() poll outcome handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    payload = { pull_request: { number: 7, title: 'Add feature', body: 'body' } };
    setInputs();
    extractPrContextMock.mockResolvedValue({ title: 'Add feature', body: 'body', commitMessages: [], files: [] });
    submitJobMock.mockResolvedValue('job-1');
  });

  // Regression: pr-trailer-api reported a job failure (e.g. the 2026-09-09 incident
  // where every brief-generation call failed deterministically) and the workflow step
  // still went green — pollJob correctly returned outcome: 'error', but run() only
  // logged a warning instead of failing the Action.
  it('fails the Action when the API reports a job error, with a customer-facing message', async () => {
    pollJobMock.mockResolvedValue({ outcome: 'error' });
    const { run } = await import('./index');

    await run();

    expect(setFailedMock).toHaveBeenCalledTimes(1);
    const message = setFailedMock.mock.calls[0][0] as string;
    // Public product: other teams run this in their own repos and can't see our
    // internal API/worker logs, so point them at support instead of "check the logs".
    expect(message).toContain('support@scalingforge.com');
    expect(message).toContain('job-1');
    expect(message).not.toMatch(/logs/i);
    expect(upsertPrCommentMock).not.toHaveBeenCalled();
  });

  it('fails the Action when polling hits the timeout ceiling, with a customer-facing message', async () => {
    pollJobMock.mockResolvedValue({ outcome: 'timeout' });
    const { run } = await import('./index');

    await run();

    expect(setFailedMock).toHaveBeenCalledTimes(1);
    const message = setFailedMock.mock.calls[0][0] as string;
    expect(message).toContain('support@scalingforge.com');
    expect(message).toContain('job-1');
    expect(upsertPrCommentMock).not.toHaveBeenCalled();
  });
});

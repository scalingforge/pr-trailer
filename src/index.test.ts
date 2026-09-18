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
    'run-if': 'true',
  };
  const inputs = { ...defaults, ...overrides };
  getInputMock.mockImplementation((name: string, options?: { required?: boolean }) => {
    const value = inputs[name] ?? '';
    if (options?.required && value === '') {
      throw new Error(`Input required and not supplied: ${name}`);
    }
    return value;
  });
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
  it('fails the Action when the API reports a job error', async () => {
    pollJobMock.mockResolvedValue({ outcome: 'error', error: 'boom' });
    const { run } = await import('./index');

    await run();

    expect(setFailedMock).toHaveBeenCalledTimes(1);
    expect(upsertPrCommentMock).not.toHaveBeenCalled();
  });

  // Regression: a 2026-09-18 incident (every job failing on an Anthropic account usage
  // cap) took a full CloudWatch log dig to diagnose because the Action only ever
  // reported "see the API/worker logs for details" — even though the API already
  // returns the real error in the job's `error` field. Surface it instead of hiding it.
  it('includes the job\'s error detail in the failure message', async () => {
    pollJobMock.mockResolvedValue({ outcome: 'error', error: 'You have reached your specified API usage limits.' });
    const { run } = await import('./index');

    await run();

    expect(setFailedMock).toHaveBeenCalledWith(
      expect.stringContaining('You have reached your specified API usage limits.'),
    );
  });

  it('falls back to a generic message when the job has no error detail', async () => {
    pollJobMock.mockResolvedValue({ outcome: 'error', error: null });
    const { run } = await import('./index');

    await run();

    expect(setFailedMock).toHaveBeenCalledWith(expect.stringContaining('see the API/worker logs for details.'));
  });

  it('fails the Action when polling hits the timeout ceiling', async () => {
    pollJobMock.mockResolvedValue({ outcome: 'timeout' });
    const { run } = await import('./index');

    await run();

    expect(setFailedMock).toHaveBeenCalledTimes(1);
    expect(upsertPrCommentMock).not.toHaveBeenCalled();
  });
});

describe('run() run-if gating', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    payload = { pull_request: { number: 7, title: 'Add feature', body: 'body' } };
    extractPrContextMock.mockResolvedValue({ title: 'Add feature', body: 'body', commitMessages: [], files: [] });
    submitJobMock.mockResolvedValue('job-1');
    pollJobMock.mockResolvedValue({ outcome: 'error', error: 'boom' });
  });

  it('skips execution without failing when run-if is false', async () => {
    setInputs({ 'run-if': 'false' });
    const { run } = await import('./index');

    await run();

    expect(extractPrContextMock).not.toHaveBeenCalled();
    expect(submitJobMock).not.toHaveBeenCalled();
    expect(setFailedMock).not.toHaveBeenCalled();
  });

  it('defaults to true and warns on an invalid run-if value', async () => {
    setInputs({ 'run-if': 'maybe' });
    const { run } = await import('./index');

    await run();

    expect(warningMock).toHaveBeenCalledWith(
      'Invalid run-if "maybe"; defaulting to "true". Expected "true" or "false".',
    );
    expect(submitJobMock).toHaveBeenCalled();
  });

  // Regression: run() used to read api-key/api-url/github-token (all `required: true`)
  // before checking run-if, so a repo that set run-if: false without also wiring up
  // API credentials got a hard core.setFailed instead of a clean skip.
  it('skips cleanly when run-if is false even if required credentials are unset', async () => {
    setInputs({ 'run-if': 'false', 'api-key': '', 'api-url': '', 'github-token': '' });
    const { run } = await import('./index');

    await run();

    expect(submitJobMock).not.toHaveBeenCalled();
    expect(setFailedMock).not.toHaveBeenCalled();
  });
});

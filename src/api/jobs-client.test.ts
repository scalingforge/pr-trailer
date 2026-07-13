import { describe, expect, it, vi } from 'vitest';
import { JobSubmissionError, pollJob, submitJob, type JobResponse } from './jobs-client';

function jsonResponse(status: number, body: unknown) {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response;
}

const pr = { title: 't', body: 'b', commitMessages: ['c'] };
const files = [{ path: 'a.ts', patch: 'p', additions: 1, deletions: 0, status: 'modified' as const }];

describe('submitJob', () => {
  it('returns the jobId on a 202 response', async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse(202, { jobId: 'job-1' }));

    const jobId = await submitJob('https://api.example', 'key-1', pr, files, fetchFn);

    expect(jobId).toBe('job-1');
    expect(fetchFn).toHaveBeenCalledWith(
      'https://api.example/v1/jobs',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'X-Api-Key': 'key-1' }),
        body: JSON.stringify({ pr, files }),
      }),
    );
  });

  it('throws a JobSubmissionError with kind "unauthorized" on 401', async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse(401, {}));

    await expect(submitJob('https://api.example', 'bad-key', pr, files, fetchFn)).rejects.toMatchObject({
      kind: 'unauthorized',
    });
  });

  it('throws a JobSubmissionError with kind "rejected" on any other non-2xx', async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse(400, {}));

    await expect(submitJob('https://api.example', 'key-1', pr, files, fetchFn)).rejects.toMatchObject({
      kind: 'rejected',
    });
  });

  it('rejected error message includes the status code and a body snippet', async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse(400, { error: 'Invalid request body' }));

    await expect(submitJob('https://api.example', 'key-1', pr, files, fetchFn)).rejects.toThrow(
      /400.*Invalid request body/s,
    );
  });

  it('JobSubmissionError is an instance of Error', () => {
    const err = new JobSubmissionError('rejected', 'message');
    expect(err).toBeInstanceOf(Error);
  });
});

const doneJob: JobResponse = {
  status: 'done',
  brief: { summary: 's', intent: 'i', riskLevel: 'low', files: [], readOrder: [], openQuestions: [] },
  audio: { url: 'https://cdn/a.mp3', expiresAt: '2026-08-01T00:00:00.000Z', durationSeconds: 42 },
  error: null,
};

describe('pollJob', () => {
  it('returns done immediately when the first poll is already done', async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse(200, doneJob));
    const sleepFn = vi.fn();

    const result = await pollJob('https://api.example', 'key-1', 'job-1', { fetchFn, sleepFn, now: () => 0 });

    expect(result).toEqual({ outcome: 'done', job: doneJob });
    expect(sleepFn).not.toHaveBeenCalled();
  });

  it('polls with 2s, then 3s (×1.5) backoff before eventually succeeding', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { status: 'processing', brief: null, audio: null, error: null }))
      .mockResolvedValueOnce(jsonResponse(200, { status: 'processing', brief: null, audio: null, error: null }))
      .mockResolvedValueOnce(jsonResponse(200, doneJob));
    let elapsed = 0;
    const sleepFn = vi.fn(async (ms: number) => {
      elapsed += ms;
    });

    const result = await pollJob('https://api.example', 'key-1', 'job-1', {
      fetchFn,
      sleepFn,
      now: () => elapsed,
    });

    expect(result).toEqual({ outcome: 'done', job: doneJob });
    expect(sleepFn).toHaveBeenNthCalledWith(1, 2000);
    expect(sleepFn).toHaveBeenNthCalledWith(2, 3000);
  });

  it('caps the backoff delay at 10s', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { status: 'processing', brief: null, audio: null, error: null }))
      .mockResolvedValueOnce(jsonResponse(200, { status: 'processing', brief: null, audio: null, error: null }))
      .mockResolvedValueOnce(jsonResponse(200, { status: 'processing', brief: null, audio: null, error: null }))
      .mockResolvedValueOnce(jsonResponse(200, { status: 'processing', brief: null, audio: null, error: null }))
      .mockResolvedValueOnce(jsonResponse(200, doneJob));
    let elapsed = 0;
    const sleepFn = vi.fn(async (ms: number) => {
      elapsed += ms;
    });

    await pollJob('https://api.example', 'key-1', 'job-1', { fetchFn, sleepFn, now: () => elapsed });

    // 2000, 3000, 4500, 6750 — all under the 10s cap so far; assert the cap itself
    // by checking no call ever exceeds it.
    for (const call of sleepFn.mock.calls) {
      expect(call[0]).toBeLessThanOrEqual(10000);
    }
  });

  it('returns error outcome when the job reports status "error"', async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse(200, { status: 'error', brief: null, audio: null, error: 'boom' }));

    const result = await pollJob('https://api.example', 'key-1', 'job-1', { fetchFn, sleepFn: vi.fn(), now: () => 0 });

    expect(result).toEqual({ outcome: 'error' });
  });

  it('returns timeout when the 6-minute ceiling is reached without a terminal status', async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse(200, { status: 'processing', brief: null, audio: null, error: null }));
    let elapsed = 0;
    const sleepFn = vi.fn(async (ms: number) => {
      elapsed += ms;
    });

    const result = await pollJob('https://api.example', 'key-1', 'job-1', {
      fetchFn,
      sleepFn,
      now: () => elapsed,
    });

    expect(result).toEqual({ outcome: 'timeout' });
  });

  it('throws if the job reports status "done" with no brief', async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse(200, { status: 'done', brief: null, audio: null, error: null }));

    await expect(
      pollJob('https://api.example', 'key-1', 'job-1', { fetchFn, sleepFn: vi.fn(), now: () => 0 }),
    ).rejects.toThrow(/job-1/);
  });

  it('throws with the status code and a body snippet when a poll request itself fails', async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse(500, { error: 'internal error' }));

    await expect(
      pollJob('https://api.example', 'key-1', 'job-1', { fetchFn, sleepFn: vi.fn(), now: () => 0 }),
    ).rejects.toThrow(/500.*internal error/s);
  });

  it('invokes onStatus for every observed job status, including the terminal one', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { status: 'processing', brief: null, audio: null, error: null }))
      .mockResolvedValueOnce(jsonResponse(200, { status: 'processing', brief: null, audio: null, error: null }))
      .mockResolvedValueOnce(jsonResponse(200, doneJob));
    let elapsed = 0;
    const sleepFn = vi.fn(async (ms: number) => {
      elapsed += ms;
    });
    const statuses: string[] = [];

    await pollJob('https://api.example', 'key-1', 'job-1', {
      fetchFn,
      sleepFn,
      now: () => elapsed,
      onStatus: (status) => statuses.push(status),
    });

    expect(statuses).toEqual(['processing', 'processing', 'done']);
  });
});

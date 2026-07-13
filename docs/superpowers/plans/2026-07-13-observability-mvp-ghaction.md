# Observability MVP (pr-trailer-ghaction) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make GitHub Action run logs actually useful for debugging — surface the `jobId` and every poll status transition, and include HTTP status codes + response body snippets when a request to pr-trailer-api fails, instead of a generic one-line failure.

**Architecture:** `jobs-client.ts`'s `submitJob`/`pollJob` stay pure/testable (no `@actions/core` import inside them). Error messages gain status+body detail. `pollJob` gains an optional `onStatus` callback invoked once per observed job status, so `index.ts` can log progress without `jobs-client.ts` depending on `@actions/core`.

**Tech Stack:** TypeScript, Vitest, `@actions/core`.

## Global Constraints

- No jobId surfaced in the PR comment — Action run log only.
- `jobs-client.ts` (`submitJob`, `pollJob`) must remain pure functions with no `@actions/core` dependency, to stay unit-testable the way they are today.
- Every existing test must keep passing; run `npm test` after every task.

---

### Task 1: Include HTTP status + body detail in `jobs-client.ts` errors, and add a poll-status callback

**Files:**
- Modify: `src/api/jobs-client.ts`
- Test: `src/api/jobs-client.test.ts`

**Interfaces:**
- Produces:
  - `submitJob`'s `JobSubmissionError('rejected', ...)` message now includes the HTTP status code and a response body snippet.
  - `pollJob` now throws a plain `Error` (status + body snippet) if any poll request itself returns a non-ok HTTP response — previously this case wasn't checked at all and would silently loop until timeout.
  - `PollDeps` gains an optional field `onStatus?: (status: JobResponse['status']) => void`, invoked once per poll iteration with the job's current status (including the terminal one). Task 2 consumes this from `index.ts`.

- [ ] **Step 1: Update the test fixture and write the failing tests**

In `src/api/jobs-client.test.ts`, update the `jsonResponse` helper (near the top of the file) to also provide a `.text()` method, so error paths can read a body snippet:

```ts
function jsonResponse(status: number, body: unknown) {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response;
}
```

Add this test inside `describe('submitJob', ...)`, after the existing `'throws a JobSubmissionError with kind "rejected"...'` test:

```ts
  it('rejected error message includes the status code and a body snippet', async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse(400, { error: 'Invalid request body' }));

    await expect(submitJob('https://api.example', 'key-1', pr, files, fetchFn)).rejects.toThrow(
      /400.*Invalid request body/s,
    );
  });
```

Add these two tests inside `describe('pollJob', ...)`, after the existing tests:

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- jobs-client`
Expected: the 3 new tests FAIL (no status/body detail in the rejected message yet; `pollJob` doesn't check `response.ok` yet; `onStatus` doesn't exist yet), all pre-existing tests in this file still PASS.

- [ ] **Step 3: Implement in `src/api/jobs-client.ts`**

Change the `submitJob` rejected branch from:
```ts
  if (!response.ok) {
    throw new JobSubmissionError('rejected', `pr-trailer-api job submission failed with status ${response.status}.`);
  }
```
to:
```ts
  if (!response.ok) {
    const bodyText = await response.text().catch(() => '');
    throw new JobSubmissionError(
      'rejected',
      `pr-trailer-api job submission failed with status ${response.status}: ${bodyText.slice(0, 500) || '(empty body)'}`,
    );
  }
```

Add `onStatus` to the `PollDeps` interface:
```ts
export interface PollDeps {
  fetchFn?: typeof fetch;
  sleepFn?: (ms: number) => Promise<void>;
  now?: () => number;
  onStatus?: (status: JobResponse['status']) => void;
}
```

In `pollJob`, change the top of the loop from:
```ts
  for (;;) {
    const response = await fetchFn(`${apiUrl}/v1/jobs/${jobId}`, {
      headers: { 'X-Api-Key': apiKey },
    });
    const job = (await response.json()) as JobResponse;
```
to:
```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- jobs-client`
Expected: all tests in `src/api/jobs-client.test.ts` PASS.

- [ ] **Step 5: Commit**

```bash
git add src/api/jobs-client.ts src/api/jobs-client.test.ts
git commit -m "feat: include HTTP status/body detail in job-client errors, add poll-status callback"
```

---

### Task 2: Log the jobId and poll progress in `index.ts`

**Files:**
- Modify: `src/index.ts`

**Interfaces:**
- Consumes: `PollDeps.onStatus` (produced in Task 1).
- Produces: no new exports; behavior-only change (adds `core.info` calls, doesn't change control flow).

There is no existing unit test for `index.ts` (it's the entrypoint, wired up via `run().catch(...)` at module load) — verification for this task is `typecheck` + `build` + a manual review, consistent with how this file is already untested elsewhere in the repo.

- [ ] **Step 1: Implement the logging in `src/index.ts`**

Change:
```ts
  let jobId: string;
  try {
    jobId = await submitJob(
      apiUrl,
      apiKey,
      { title: prContext.title, body: prContext.body, commitMessages: prContext.commitMessages },
      prContext.files,
    );
  } catch (err) {
    if (err instanceof JobSubmissionError) {
      core.setFailed(err.message);
      return;
    }
    throw err;
  }

  const result = await pollJob(apiUrl, apiKey, jobId);
```
to:
```ts
  let jobId: string;
  try {
    jobId = await submitJob(
      apiUrl,
      apiKey,
      { title: prContext.title, body: prContext.body, commitMessages: prContext.commitMessages },
      prContext.files,
    );
  } catch (err) {
    if (err instanceof JobSubmissionError) {
      core.setFailed(err.message);
      return;
    }
    throw err;
  }

  core.info(`Submitted job ${jobId}`);

  const result = await pollJob(apiUrl, apiKey, jobId, {
    onStatus: (status) => core.info(`Job ${jobId} status: ${status}`),
  });
```

- [ ] **Step 2: Run typecheck and build**

Run: `npm run typecheck && npm run build`
Expected: both succeed with no errors.

- [ ] **Step 3: Run the full test suite**

Run: `npm test`
Expected: all tests PASS (no test covers `index.ts` directly, but this confirms nothing else broke).

- [ ] **Step 4: Commit**

```bash
git add src/index.ts
git commit -m "feat: log jobId and poll progress in the Action run log"
```

---

## Final verification

After both tasks:

- [ ] Run `npm test` — all tests pass.
- [ ] Run `npm run typecheck` — no errors.
- [ ] Run `npm run lint` — no errors.
- [ ] Run `npm run build` — succeeds (this is what CI packages into `dist/`).
- [ ] Manual (post-merge) verification, per the spec's Testing section: run the Action against the deployed pr-trailer-api (or the local-dev API) and confirm the run log shows the `jobId` and status transitions, and that a failure (e.g. temporarily using a wrong API key) produces an error message with a real status code and body snippet instead of a generic one-liner.

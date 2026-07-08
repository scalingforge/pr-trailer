import { describe, expect, it, vi } from 'vitest';
import { extractPrContext, type Octokit } from './extract-context';

function createFakeOctokit(files: unknown[], commits: unknown[]) {
  const listFiles = vi.fn();
  const listCommits = vi.fn();
  const paginate = vi.fn().mockImplementation((fn: unknown) => {
    if (fn === listFiles) return Promise.resolve(files);
    if (fn === listCommits) return Promise.resolve(commits);
    throw new Error('unexpected paginate call');
  });

  const octokit = {
    paginate,
    rest: {
      pulls: { listFiles, listCommits },
    },
  } as unknown as Octokit;

  return { octokit, paginate, listFiles, listCommits };
}

const baseParams = { owner: 'acme', repo: 'widgets', pullNumber: 42, title: 'Add feature', body: 'desc' };

describe('extractPrContext', () => {
  it('excludes files matching the default lockfile list, including a nested path', async () => {
    const { octokit } = createFakeOctokit(
      [
        { filename: 'package-lock.json', patch: 'p', additions: 1, deletions: 0, status: 'modified' },
        { filename: 'packages/foo/package-lock.json', patch: 'p', additions: 1, deletions: 0, status: 'modified' },
        { filename: 'src/index.ts', patch: 'p', additions: 1, deletions: 0, status: 'modified' },
      ],
      [],
    );

    const result = await extractPrContext(
      octokit,
      baseParams,
      ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'Cargo.lock', 'poetry.lock'],
    );

    expect(result.files.map((f) => f.path)).toEqual(['src/index.ts']);
  });

  it('excludes nothing when excludeFiles is empty', async () => {
    const { octokit } = createFakeOctokit(
      [{ filename: 'package-lock.json', patch: 'p', additions: 1, deletions: 0, status: 'modified' }],
      [],
    );

    const result = await extractPrContext(octokit, baseParams, []);

    expect(result.files.map((f) => f.path)).toEqual(['package-lock.json']);
  });

  it('falls back to an empty string when patch is missing', async () => {
    const { octokit } = createFakeOctokit(
      [{ filename: 'binary.png', additions: 0, deletions: 0, status: 'added' }],
      [],
    );

    const result = await extractPrContext(octokit, baseParams, []);

    expect(result.files[0].patch).toBe('');
  });

  it('falls back to an empty string when body is null', async () => {
    const { octokit } = createFakeOctokit([], []);

    const result = await extractPrContext(octokit, { ...baseParams, body: null }, []);

    expect(result.body).toBe('');
  });

  it('passes through every documented PrFileStatus value', async () => {
    const statuses = ['added', 'removed', 'modified', 'renamed', 'copied', 'changed', 'unchanged'];
    const { octokit } = createFakeOctokit(
      statuses.map((status, i) => ({ filename: `f${i}.ts`, patch: 'p', additions: 1, deletions: 0, status })),
      [],
    );

    const result = await extractPrContext(octokit, baseParams, []);

    expect(result.files.map((f) => f.status)).toEqual(statuses);
  });

  it('includes every commit message, not just the PR title', async () => {
    const { octokit } = createFakeOctokit(
      [],
      [{ commit: { message: 'feat: a' } }, { commit: { message: 'fix: b' } }, { commit: { message: 'chore: c' } }],
    );

    const result = await extractPrContext(octokit, baseParams, []);

    expect(result.commitMessages).toEqual(['feat: a', 'fix: b', 'chore: c']);
  });

  it('fetches files and commits via octokit.paginate with per_page 100', async () => {
    const { octokit, paginate, listFiles, listCommits } = createFakeOctokit([], []);

    await extractPrContext(octokit, baseParams, []);

    expect(paginate).toHaveBeenCalledWith(listFiles, {
      owner: 'acme',
      repo: 'widgets',
      pull_number: 42,
      per_page: 100,
    });
    expect(paginate).toHaveBeenCalledWith(listCommits, {
      owner: 'acme',
      repo: 'widgets',
      pull_number: 42,
      per_page: 100,
    });
  });

  it('carries the title and body straight through from params', async () => {
    const { octokit } = createFakeOctokit([], []);

    const result = await extractPrContext(octokit, baseParams, []);

    expect(result.title).toBe('Add feature');
    expect(result.body).toBe('desc');
  });
});

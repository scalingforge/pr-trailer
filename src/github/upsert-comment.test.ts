import { describe, expect, it, vi } from 'vitest';
import { PR_TRAILER_MARKER, upsertPrComment, type Octokit } from './upsert-comment';

function createFakeOctokit(comments: Array<{ id: number; body?: string }>) {
  const listComments = vi.fn();
  const createComment = vi.fn();
  const updateComment = vi.fn();
  const paginate = vi.fn().mockResolvedValue(comments);

  const octokit = {
    paginate,
    rest: {
      issues: {
        listComments,
        createComment,
        updateComment,
      },
    },
  } as unknown as Octokit;

  return { octokit, paginate, listComments, createComment, updateComment };
}

const params = { owner: 'acme', repo: 'widgets', pullNumber: 42 };

describe('upsertPrComment', () => {
  it('creates a new comment when none has the marker', async () => {
    const { octokit, paginate, listComments, createComment, updateComment } = createFakeOctokit([
      { id: 1, body: 'unrelated comment' },
    ]);

    await upsertPrComment(octokit, params, 'brief content');

    expect(paginate).toHaveBeenCalledWith(listComments, {
      owner: 'acme',
      repo: 'widgets',
      issue_number: 42,
      per_page: 100,
    });
    expect(createComment).toHaveBeenCalledTimes(1);
    expect(updateComment).not.toHaveBeenCalled();
  });

  it('updates the existing tracked comment when the marker is present', async () => {
    const { octokit, createComment, updateComment } = createFakeOctokit([
      { id: 1, body: 'unrelated comment' },
      { id: 2, body: `${PR_TRAILER_MARKER}\n\nold brief` },
    ]);

    await upsertPrComment(octokit, params, 'new brief content');

    expect(updateComment).toHaveBeenCalledTimes(1);
    expect(updateComment.mock.calls[0][0]).toMatchObject({
      owner: 'acme',
      repo: 'widgets',
      comment_id: 2,
    });
    expect(createComment).not.toHaveBeenCalled();
  });

  it('ignores comments from other users that do not contain the marker', async () => {
    const { octokit, createComment } = createFakeOctokit([
      { id: 1, body: 'a bot comment with no marker' },
      { id: 2, body: undefined },
    ]);

    await upsertPrComment(octokit, params, 'brief content');

    expect(createComment).toHaveBeenCalledTimes(1);
  });

  it('composes the body as marker, then content, then footer signature', async () => {
    const { octokit, createComment } = createFakeOctokit([]);

    await upsertPrComment(octokit, params, 'brief content');

    const body = createComment.mock.calls[0][0].body as string;
    const markerIndex = body.indexOf(PR_TRAILER_MARKER);
    const contentIndex = body.indexOf('brief content');
    const footerIndex = body.indexOf('Posted by [pr-trailer]');

    expect(markerIndex).toBe(0);
    expect(contentIndex).toBeGreaterThan(markerIndex);
    expect(footerIndex).toBeGreaterThan(contentIndex);
  });

  it('links the footer to the canonical repo, not the pre-rename name', async () => {
    const { octokit, createComment } = createFakeOctokit([]);

    await upsertPrComment(octokit, params, 'brief content');

    const body = createComment.mock.calls[0][0].body as string;

    expect(body).toContain('https://github.com/yasel-scf/pr-trailer)');
    expect(body).not.toContain('pr-trailer-ghaction');
  });
});

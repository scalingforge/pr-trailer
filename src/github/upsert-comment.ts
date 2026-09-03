import * as github from '@actions/github';

export type Octokit = ReturnType<typeof github.getOctokit>;

export const PR_TRAILER_MARKER = '<!-- pr-trailer:v1 -->';

const FEEDBACK_LINE = '🌱 *Help us grow and [share your feedback](https://forms.gle/DgRwVFE8wGBhQFhC8)*';
const FOOTER = '🤖 *Posted by [pr-trailer](https://github.com/scalingforge/pr-trailer)*';

function composeBody(body: string): string {
  return `${PR_TRAILER_MARKER}\n\n${body}\n\n---\n${FEEDBACK_LINE}\n\n${FOOTER}`;
}

export async function upsertPrComment(
  octokit: Octokit,
  params: { owner: string; repo: string; pullNumber: number },
  body: string,
): Promise<void> {
  const { owner, repo, pullNumber } = params;
  const composedBody = composeBody(body);

  const comments = await octokit.paginate(octokit.rest.issues.listComments, {
    owner,
    repo,
    issue_number: pullNumber,
    per_page: 100,
  });

  const existing = comments.find((comment: { body?: string }) => comment.body?.includes(PR_TRAILER_MARKER));

  if (existing) {
    await octokit.rest.issues.updateComment({
      owner,
      repo,
      comment_id: existing.id,
      body: composedBody,
    });
    return;
  }

  await octokit.rest.issues.createComment({
    owner,
    repo,
    issue_number: pullNumber,
    body: composedBody,
  });
}

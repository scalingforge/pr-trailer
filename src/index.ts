import * as core from '@actions/core';
import * as github from '@actions/github';

const TEST_COMMENT_BODY = '🤖 pr-trailer scaffold is alive';

async function run(): Promise<void> {
  // anthropic-api-key is declared as a required input but unused until a
  // later spec introduces real Claude API calls.
  core.getInput('anthropic-api-key', { required: true });
  const githubToken = core.getInput('github-token', { required: true });

  const octokit = github.getOctokit(githubToken);
  const { context } = github;

  const pullRequest = context.payload.pull_request;
  if (!pullRequest) {
    core.info('No pull_request in event payload; skipping comment.');
    return;
  }

  await octokit.rest.issues.createComment({
    owner: context.repo.owner,
    repo: context.repo.repo,
    issue_number: pullRequest.number,
    body: TEST_COMMENT_BODY,
  });

  core.info(`Posted test comment on PR #${pullRequest.number}`);
}

run().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  core.setFailed(message);
});

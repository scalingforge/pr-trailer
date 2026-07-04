import * as core from '@actions/core';
import * as github from '@actions/github';

interface BriefResponse {
  message: string;
}

async function run(): Promise<void> {
  const apiKey = core.getInput('api-key', { required: true });
  const apiUrl = core.getInput('api-url', { required: true });
  const githubToken = core.getInput('github-token', { required: true });

  const octokit = github.getOctokit(githubToken);
  const { context } = github;

  const pullRequest = context.payload.pull_request;
  if (!pullRequest) {
    core.info('No pull_request in event payload; skipping comment.');
    return;
  }

  const response = await fetch(`${apiUrl.replace(/\/$/, '')}/brief`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey,
    },
    body: JSON.stringify({ ping: true }),
  });

  if (response.status === 401) {
    throw new Error('pr-trailer-api rejected the request: invalid api-key.');
  }
  if (!response.ok) {
    throw new Error(`pr-trailer-api request failed with status ${response.status}.`);
  }

  const { message } = (await response.json()) as BriefResponse;

  await octokit.rest.issues.createComment({
    owner: context.repo.owner,
    repo: context.repo.repo,
    issue_number: pullRequest.number,
    body: message,
  });

  core.info(`Posted comment on PR #${pullRequest.number}`);
}

run().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  core.setFailed(message);
});

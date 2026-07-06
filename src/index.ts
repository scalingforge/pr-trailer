import * as core from '@actions/core';
import * as github from '@actions/github';
import { upsertPrComment } from './github/upsert-comment';

interface BriefResponse {
  message: string;
}

// Same service for every client — not user-configurable. Update this once
// pr-trailer-api has a real deployed URL (Task 7 of the wiring plan).
const PR_TRAILER_API_URL = 'https://TODO-replace-with-deployed-pr-trailer-api-url';

async function run(): Promise<void> {
  const apiKey = core.getInput('api-key', { required: true });
  const githubToken = core.getInput('github-token', { required: true });

  const octokit = github.getOctokit(githubToken);
  const { context } = github;

  const pullRequest = context.payload.pull_request;
  if (!pullRequest) {
    core.info('No pull_request in event payload; skipping comment.');
    return;
  }

  const response = await fetch(`${PR_TRAILER_API_URL}/brief`, {
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

  await upsertPrComment(
    octokit,
    { owner: context.repo.owner, repo: context.repo.repo, pullNumber: pullRequest.number },
    message,
  );

  core.info(`Posted comment on PR #${pullRequest.number}`);
}

run().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  core.setFailed(message);
});

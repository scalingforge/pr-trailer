import * as core from '@actions/core';
import * as github from '@actions/github';
import { extractPrContext } from './github/extract-context';
import { upsertPrComment } from './github/upsert-comment';
import { JobSubmissionError, pollJob, submitJob } from './api/jobs-client';
import { composeCommentBody } from './render/render-brief';

function parseExcludeFiles(raw: string): string[] {
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

async function run(): Promise<void> {
  const apiKey = core.getInput('api-key', { required: true });
  const apiUrl = core.getInput('api-url', { required: true });
  const githubToken = core.getInput('github-token', { required: true });
  const excludeFiles = parseExcludeFiles(core.getInput('exclude-files'));

  const octokit = github.getOctokit(githubToken);
  const { context } = github;

  const pullRequest = context.payload.pull_request;
  if (!pullRequest) {
    core.info('No pull_request in event payload; skipping comment.');
    return;
  }

  const prContext = await extractPrContext(
    octokit,
    {
      owner: context.repo.owner,
      repo: context.repo.repo,
      pullNumber: pullRequest.number,
      title: pullRequest.title as string,
      body: (pullRequest.body as string | null) ?? null,
    },
    excludeFiles,
  );

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

  if (result.outcome === 'error') {
    core.warning('pr-trailer-api reported a job error; skipping comment.');
    return;
  }
  if (result.outcome === 'timeout') {
    core.warning('pr-trailer-api job did not finish before the polling ceiling; skipping comment.');
    return;
  }

  const commentBody = composeCommentBody(result.job.brief, result.job.audio);

  await upsertPrComment(
    octokit,
    { owner: context.repo.owner, repo: context.repo.repo, pullNumber: pullRequest.number },
    commentBody,
  );

  core.info(`Posted comment on PR #${pullRequest.number}`);
}

run().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  core.setFailed(message);
});

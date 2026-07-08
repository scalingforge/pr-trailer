import { basename } from 'node:path';
import type * as github from '@actions/github';

export type Octokit = ReturnType<typeof github.getOctokit>;

export type PrFileStatus = 'added' | 'removed' | 'modified' | 'renamed' | 'copied' | 'changed' | 'unchanged';

export interface PrFile {
  path: string;
  patch: string;
  additions: number;
  deletions: number;
  status: PrFileStatus;
}

export interface PrContext {
  title: string;
  body: string;
  commitMessages: string[];
  files: PrFile[];
}

export async function extractPrContext(
  octokit: Octokit,
  params: {
    owner: string;
    repo: string;
    pullNumber: number;
    title: string;
    body: string | null;
  },
  excludeFiles: string[],
): Promise<PrContext> {
  const { owner, repo, pullNumber, title, body } = params;
  const excludeSet = new Set(excludeFiles);

  const rawFiles = await octokit.paginate(octokit.rest.pulls.listFiles, {
    owner,
    repo,
    pull_number: pullNumber,
    per_page: 100,
  });

  const files: PrFile[] = rawFiles
    .filter((file: { filename: string }) => !excludeSet.has(basename(file.filename)))
    .map(
      (file: { filename: string; patch?: string; additions: number; deletions: number; status: string }) => ({
        path: file.filename,
        patch: file.patch ?? '',
        additions: file.additions,
        deletions: file.deletions,
        status: file.status as PrFileStatus,
      }),
    );

  const rawCommits = await octokit.paginate(octokit.rest.pulls.listCommits, {
    owner,
    repo,
    pull_number: pullNumber,
    per_page: 100,
  });
  const commitMessages = rawCommits.map((commit: { commit: { message: string } }) => commit.commit.message);

  return {
    title,
    body: body ?? '',
    commitMessages,
    files,
  };
}

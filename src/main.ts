import * as core from '@actions/core'
import * as github from '@actions/github'
import {Context} from '@actions/github/lib/context'
import {poll} from './poll'

async function run(): Promise<void> {
  try {
    // read inputs
    const token = core.getInput('token', {required: true})

    // github context
    const context = github.context

    // ignore self/current job check run
    const ignore = (core.getInput('ignore') || '')
      .split(',')
      .map(check => check.trim())
    ignore.push(context.job)

    // obtain a Promise
    await poll({
      client: github.getOctokit(token),
      owner: context.repo.owner,
      repo: context.repo.repo,
      ref: pickSHA(context),
      ignoreChecks: ignore,

      // optional
      intervalSeconds: parseInt(core.getInput('interval') || '10'),
      timeoutSeconds: parseInt(core.getInput('timeout') || '3600')
    })

    core.setOutput('time', new Date().toTimeString())
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
}

function pickSHA(context: Context): string {
  if (context.eventName === 'pull_request') {
    return context.payload.pull_request?.head.sha || context.sha
  }
  return context.sha
}

run()

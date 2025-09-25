import * as core from '@actions/core'
import * as github from '@actions/github'
import {Context} from '@actions/github/lib/context'
import {poll} from './poll'
import {wait} from './wait'

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

    const matchPattern = core.getInput('match_pattern') || undefined
    const ignorePattern = core.getInput('ignore_pattern') || undefined

    const successConclusions = (core.getInput('success_conclusions') || 'success,skipped')
      .split(',')
      .map(conclusion => conclusion.trim())
      .filter(conclusion => conclusion.length > 0) // Remove empty strings

    // Validate success_conclusions values
    const validConclusions = ['success', 'failure', 'neutral', 'cancelled', 'skipped', 'timed_out', 'action_required']
    const invalidConclusions = successConclusions.filter(conclusion => !validConclusions.includes(conclusion))
    if (invalidConclusions.length > 0) {
      throw new Error(`Invalid success_conclusions: ${invalidConclusions.join(', ')}. Valid values: ${validConclusions.join(', ')}`)
    }

    const timeoutBehaviorInput = core.getInput('timeout_behavior') || 'fail'
    const validTimeoutBehaviors = ['fail', 'success']
    if (!validTimeoutBehaviors.includes(timeoutBehaviorInput)) {
      throw new Error(`Invalid timeout_behavior: ${timeoutBehaviorInput}. Valid values: ${validTimeoutBehaviors.join(', ')}`)
    }
    const timeoutBehavior = timeoutBehaviorInput as 'fail' | 'success'

    const delaySeconds = parseInt(core.getInput('delay') || '0')
    await wait(delaySeconds * 1000)

    await poll({
      client: github.getOctokit(token),
      owner: context.repo.owner,
      repo: context.repo.repo,
      ref: pickSHA(context),
      ignoreChecks: ignore,
      successConclusions,
      timeoutBehavior,

      matchPattern,
      ignorePattern,

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
  switch (context.eventName) {
    case 'pull_request':
    case 'pull_request_target':
      return context.payload.pull_request?.head.sha || context.sha
    case 'push':
      return context.payload.after || context.sha
    default:
      return context.sha
  }
}

run()

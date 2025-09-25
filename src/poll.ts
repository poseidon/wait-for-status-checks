import * as core from '@actions/core'
import {GitHub} from '@actions/github/lib/utils'
import type {RestEndpointMethodTypes} from '@octokit/plugin-rest-endpoint-methods'
import {wait} from './wait'

export interface Config {
  client: InstanceType<typeof GitHub>
  owner: string
  repo: string
  ref: string

  // frequency and timeout
  intervalSeconds: number
  timeoutSeconds: number
  timeoutBehavior: 'fail' | 'success'

  // ignore
  ignoreChecks: string[]

  // success criteria
  successConclusions: string[]

  matchPattern?: string
  ignorePattern?: string
}

export async function poll(config: Config): Promise<void> {
  const {
    client,
    owner,
    repo,
    ref,
    intervalSeconds,
    timeoutSeconds,
    timeoutBehavior,
    ignoreChecks,
    successConclusions,
    matchPattern,
    ignorePattern
  } = config
  let elapsedSeconds = 0

  core.info('Starting polling GitHub Check runs...')
  core.info(`timeout: ${timeoutSeconds} seconds`)
  core.info(`interval: ${intervalSeconds} seconds`)
  core.info(`ignore: ${JSON.stringify(ignoreChecks)}`)

  if (matchPattern) {
    core.info(`match pattern: ${matchPattern}`)
  }
  if (ignorePattern) {
    core.info(`ignore pattern: ${ignorePattern}`)
  }

  while (elapsedSeconds < timeoutSeconds) {
    try {
      // List GitHub Check Runs
      // https://docs.github.com/en/rest/checks/runs?apiVersion=2022-11-28#list-check-runs-for-a-git-reference
      core.info(`Fetching check runs for ${owner}/${repo}@${ref}`)
      let pageNumber = 0
      let totalChecks = 0
      let all_check_runs: RestEndpointMethodTypes['checks']['listForRef']['response']['data']['check_runs'] =
        []
      do {
        pageNumber++
        const response = await client.rest.checks.listForRef({
          owner,
          repo,
          ref,
          per_page: 100,
          page: pageNumber
        })

        totalChecks = response.data.total_count

        core.debug(
          `Received ${response.data.check_runs.length} check runs on page ${pageNumber}`
        )
        all_check_runs = all_check_runs.concat(response.data.check_runs)
        core.debug(
          `Received a total of ${all_check_runs.length} check runs and expected ${response.data.total_count}`
        )
        await wait(intervalSeconds * 1000)
      } while (totalChecks > all_check_runs.length)

      core.debug(`Received ${totalChecks} total check runs`)

      const latest_check_runs = filterLatestCheckRunResults(all_check_runs)
      core.debug(`Filtered latest runs count ${latest_check_runs.length}`)

      // ignore the current job's check run
      let check_runs = latest_check_runs.filter(
        run => !ignoreChecks.includes(run.name)
      )

      // filter by match pattern
      if (matchPattern) {
        core.debug(`Filtering check runs by match pattern: ${matchPattern}`)
        const pattern = new RegExp(matchPattern)
        check_runs = check_runs.filter(run => pattern.test(run.name))
      }

      // filter by ignore pattern
      if (ignorePattern) {
        core.debug(`Filtering check runs by ignore pattern: ${ignorePattern}`)
        const pattern = new RegExp(ignorePattern)
        check_runs = check_runs.filter(run => !pattern.test(run.name))
      }

      core.info(`Parse ${check_runs.length} check runs`)
      for (const run of check_runs) {
        core.debug(
          `> check run "${run.name}" is "${run.status}" with conclusion "${run.conclusion}"`
        )
      }

      // exit immediately if any runs completed without success (skipped counts as success)
      const failed = check_runs.filter(run =>
        isFailure({
          name: run.name,
          status: run.status,
          conclusion: run.conclusion
        }, successConclusions)
      )
      if (failed.length > 0) {
        core.info('One or more watched check runs were not successful')
        for (const run of failed) {
          core.info(
            `> check run "${run.name}" is completed with conclusion "${run.conclusion}" (unsuccessful)`
          )
        }
        core.setFailed('One or more check runs were not successful')
        return
      }

      // exit when all check runs completed without failure
      if (check_runs.every(run => run.status === 'completed')) {
        core.info('All runs completed without failure')
        return
      }

      // show pending (or queued) check runs
      const pending = check_runs.filter(run => run.status !== 'completed')
      if (pending.length > 0) {
        core.info(`${pending.length} check runs have not yet completed`)
      }
      for (const run of pending) {
        core.info(`> check run ${run.name} is still ${run.status}`)
      }
    } catch (error) {
      core.error(`error ${error}`)
    }

    core.info(`Retry in ${intervalSeconds}`)
    core.info('')
    elapsedSeconds += intervalSeconds
    await wait(intervalSeconds * 1000)
  }

  // Handle timeout based on configured behavior
  core.info(`Timeout reached after ${elapsedSeconds} seconds`)
  
  switch (timeoutBehavior) {
    case 'fail':
      core.setFailed(
        `elapsed time ${elapsedSeconds} exceeds timeout ${timeoutSeconds}`
      )
      break
      
    case 'success':
      core.info('Timeout behavior set to "success" - treating timeout as successful completion')
      break
      
    default:
      core.setFailed(`Unknown timeout behavior: ${timeoutBehavior}`)
  }
}

function filterLatestCheckRunResults(
  runs: RestEndpointMethodTypes['checks']['listForRef']['response']['data']['check_runs']
): RestEndpointMethodTypes['checks']['listForRef']['response']['data']['check_runs'] {
  return runs.reduce(
    (acc, check) => {
      const existing = acc.find(c => c.name === check.name)

      if (!existing) {
        acc.push(check)
        return acc
      }

      if (
        new Date(check.started_at || 0) > new Date(existing.started_at || 0)
      ) {
        acc = acc.filter(c => c.name !== check.name)
        acc.push(check)
      }
      return acc
    },
    [] as RestEndpointMethodTypes['checks']['listForRef']['response']['data']['check_runs']
  )
}

function isFailure(run: CheckRun, successConclusions: string[]): boolean {
  if (run.status === 'completed') {
    // conclusions not in the success list are considered failures
    return !successConclusions.includes(run.conclusion || '')
  }
  // run is still queued or pending
  return false
}

interface CheckRun {
  name: string
  status: string
  conclusion:
    | (
        | 'success'
        | 'failure'
        | 'neutral'
        | 'cancelled'
        | 'skipped'
        | 'timed_out'
        | 'action_required'
      )
    | null
}

import {wait} from '../src/wait'
import {CheckRun, filterCheckRuns} from '../src/poll'
import {describe, expect, test} from '@jest/globals'

test('throws invalid number', async () => {
  const input = parseInt('foo', 10)
  await expect(wait(input)).rejects.toThrow('milliseconds not a number')
})

test('wait 500 ms', async () => {
  const start = new Date()
  await wait(500)
  const end = new Date()
  var delta = Math.abs(end.getTime() - start.getTime())
  expect(delta).toBeGreaterThan(450)
})

describe('filterCheckRuns', () => {
  const test_cases: {
    name: string,
    runs: CheckRun[],
    expected: CheckRun[],
    matchPattern?: string,
    ignoreChecks?: string[],
    ignorePattern?: string | undefined,
  }[] = [
    { name: 'empty', runs: [], expected: [] },
    {
      name: '1 run no filter',
      runs: [{ name: 'check1', started_at: '2024-01-01T00:00:00', status: 'completed', conclusion: 'success' }],
      expected: [{ name: 'check1', started_at: '2024-01-01T00:00:00', status: 'completed', conclusion: 'success' }],
    },
    {
      name: '2 runs no filter',
      runs: [
        { name: 'check1', started_at: '2024-01-01T00:00:00', status: 'completed', conclusion: 'success' },
        { name: 'check2', started_at: '2024-01-01T00:01:00', status: 'completed', conclusion: 'success' },
      ],
      expected: [
        { name: 'check1', started_at: '2024-01-01T00:00:00', status: 'completed', conclusion: 'success' },
        { name: 'check2', started_at: '2024-01-01T00:01:00', status: 'completed', conclusion: 'success' },
      ],
    },
    {
      name: 'matchPattern',
      matchPattern: 'check-(cat|dog)',
      runs: [
        { name: 'check-cat', started_at: '2024-01-01T00:00:00', status: 'completed', conclusion: 'success' },
        { name: 'check-dog', started_at: '2024-01-01T00:01:00', status: 'completed', conclusion: 'success' },
        { name: 'check-bird', started_at: '2024-01-01T00:02:00', status: 'completed', conclusion: 'success' },
      ],
      expected: [
        { name: 'check-cat', started_at: '2024-01-01T00:00:00', status: 'completed', conclusion: 'success' },
        { name: 'check-dog', started_at: '2024-01-01T00:01:00', status: 'completed', conclusion: 'success' },
      ],
    },
    {
      name: 'ignoreChecks',
      ignoreChecks: ['check-dog', 'check-bird'],
      runs: [
        { name: 'check-cat', started_at: '2024-01-01T00:00:00', status: 'completed', conclusion: 'success' },
        { name: 'check-dog', started_at: '2024-01-01T00:01:00', status: 'completed', conclusion: 'success' },
        { name: 'check-bird', started_at: '2024-01-01T00:02:00', status: 'completed', conclusion: 'success' },
      ],
      expected: [
        { name: 'check-cat', started_at: '2024-01-01T00:00:00', status: 'completed', conclusion: 'success' },
      ],
    },
    {
      name: 'ignorePattern',
      ignorePattern: 'check-(cat|dog)',
      runs: [
        { name: 'check-cat', started_at: '2024-01-01T00:00:00', status: 'completed', conclusion: 'success' },
        { name: 'check-dog', started_at: '2024-01-01T00:01:00', status: 'completed', conclusion: 'success' },
        { name: 'check-bird', started_at: '2024-01-01T00:02:00', status: 'completed', conclusion: 'success' },
      ],
      expected: [
        { name: 'check-bird', started_at: '2024-01-01T00:02:00', status: 'completed', conclusion: 'success' },
      ],
    },
    {
      name: 'only keep most recent runs',
      ignorePattern: 'check-(cat|dog)',
      runs: [
        { name: 'check', started_at: '2024-01-01T00:00:00', status: 'completed', conclusion: 'failure' },
        { name: 'check', started_at: '2024-01-01T00:01:00', status: 'completed', conclusion: 'failure' },
        { name: 'check', started_at: '2024-01-01T00:02:00', status: 'completed', conclusion: 'success' },
      ],
      expected: [
        { name: 'check', started_at: '2024-01-01T00:02:00', status: 'completed', conclusion: 'success' },
      ],
    },
    {
      name: 'all filters',
      matchPattern: 'check-',
      ignoreChecks: ['check-dog', 'check-bird'],
      ignorePattern: 'check-(zebra|lion)',
      runs: [
        { name: 'check-cat', started_at: '2024-01-01T00:00:00', status: 'completed', conclusion: 'failure' },
        { name: 'check-cat', started_at: '2024-01-01T00:01:00', status: 'completed', conclusion: 'failure' },
        { name: 'check-cat', started_at: '2024-01-01T00:02:00', status: 'completed', conclusion: 'success' },
        { name: 'check-dog', started_at: '2024-01-01T00:01:00', status: 'completed', conclusion: 'success' },
        { name: 'check-bird', started_at: '2024-01-01T00:02:00', status: 'completed', conclusion: 'success' },
        { name: 'check-zebra', started_at: '2024-01-01T00:00:00', status: 'completed', conclusion: 'success' },
        { name: 'check-lion', started_at: '2024-01-01T00:00:00', status: 'completed', conclusion: 'success' },
      ],
      expected: [
        { name: 'check-cat', started_at: '2024-01-01T00:02:00', status: 'completed', conclusion: 'success' },
      ],
    },
  ];

  test_cases.forEach(({ name, runs, matchPattern, ignoreChecks, ignorePattern, expected }) => {
    test(name, () => {
      const result = filterCheckRuns(runs, matchPattern, ignoreChecks || [], ignorePattern);
      expect(result).toStrictEqual(expected);
    });
  });
});

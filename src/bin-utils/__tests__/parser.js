/* eslint import/namespace:0 */
import mockFindUp from 'find-up'
import mockReadLine from 'readline-sync'
import {oneLine} from 'common-tags'
import * as mockBinUtils from '../../bin-utils'
import mockGetLogger from '../../get-logger'
import parse from '../parser'

jest.mock('console')
jest.mock('../../get-logger')
jest.mock('../../bin-utils', () => {
  const defaultPsConfig = {scripts: {}, options: {}, isMock: true}
  const mockUtils = {
    preloadModule: jest.fn(),
    loadConfig: jest.fn(() => {
      const {psConfig: config} = mockUtils.mock
      if (typeof config !== 'undefined') {
        mockUtils.mock.psConfig = undefined
        return config
      }
      return defaultPsConfig
    }),
    loadCLIConfig: jest.fn(() => {
      const {cliConfig: config} = mockUtils.mock
      if (typeof config !== 'undefined') {
        mockUtils.mock.cliConfig = undefined
        return config
      }
      return {}
    }),
    initialize: jest.fn(() => {
      if (mockFindUp.mock.syncFail) {
        return undefined
      }
      return {
        packageScriptsPath: '/path/to/package-scripts.js',
        packageJsonPath: '/path/to/package.json',
      }
    }),
    help: jest.fn(),
    specificHelpScript: jest.fn(),
    clearAll,
    mock: {},
  }

  return mockUtils

  function clearAll() {
    Object.keys(mockUtils).forEach(key => {
      mockUtils[key].mock && mockUtils[key].mockClear()
    })
  }
})

jest.mock('yargs/lib/usage', () => {
  const usage = require.requireActual('yargs/lib/usage')
  function mockUsage(...args) {
    const actualUsage = usage(...args)
    return Object.assign(actualUsage, {
      showVersion: jest.fn(),
    })
  }
  return mockUsage
})

jest.mock('yargs/yargs', () => {
  const yargs = require.requireActual('yargs/yargs')

  return mockYargs

  function mockYargs(...args) {
    const realArgv = yargs(...args)
    const mockArgv = Object.assign(realArgv, {
      showHelp: jest.fn(),
      exit: jest.fn(),
    })
    return mockArgv
  }
})

const valid = [
  '',
  '--help',
  '-h',
  '--help-style scripts',
  '-y basic',
  '--version',
  '-v',
  '--silent',
  '-s',
  '--config foo',
  '-c foo',
  '--log-level info',
  '-l warn',
  '--require hey',
  '-r sup',
  '--prefix hola',
  '-p howdy',
]

const invalid = ['--foo bar', '--baz', '-b']

beforeEach(() => {
  jest.resetModules()
  mockGetLogger.clearAll()
  mockBinUtils.clearAll()
  mockReadLine.keyInYN.mockClear()
})

valid.forEach(argvString => {
  test(`${argvString} is valid`, () => {
    expect(() => parse(argvString)).not.toThrow()
  })
})

invalid.forEach(argvString => {
  test(`${argvString} is invalid`, () => {
    expect(() => parse(argvString)).toThrow(/invalid flag\(s\) passed/)
    expect(mockGetLogger.mock.error).toHaveBeenCalledTimes(1)
    expect(mockGetLogger.mock.error).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringMatching('invalid flag'),
        ref: 'invalid-flags',
      }),
    )
  })
})

test('happy path', () => {
  const {argv, psConfig} = parse('"build --fast"')
  expect(mockBinUtils.loadConfig).toHaveBeenCalledTimes(1)
  expect(psConfig.isMock).toBe(true)
  expect(argv).toEqual(expect.objectContaining({_: [`\"build --fast\"`]}))
})

test('with CLI config', () => {
  mockFindUp.mock.cliReturn = '/path/to/.npsrc'
  mockBinUtils.mock.cliConfig = {
    require: 'ts-node/register',
    config: 'package-scripts.ts',
  }
  const {argv, psConfig} = parse('"build --fast"')
  expect(mockBinUtils.loadConfig).toHaveBeenCalledTimes(1)
  expect(mockBinUtils.loadCLIConfig).toHaveBeenCalledTimes(1)
  expect(psConfig.isMock).toBe(true)
  expect(argv).toEqual(
    expect.objectContaining({
      _: [`\"build --fast\"`],
      require: 'ts-node/register',
      config: 'package-scripts.ts',
    }),
  )

  delete mockFindUp.mock.cliReturn
  delete mockBinUtils.mock.cliConfig
})

test('no psConfig found', () => {
  mockBinUtils.mock.psConfig = null
  expect(parse('"build --fast"')).toBe(undefined)
})

test('no config filepath found', () => {
  mockFindUp.mock.syncReturn = undefined
  expect(parse('"build --fast"')).toBe(undefined)
  expect(mockGetLogger.mock.warn).toHaveBeenCalledTimes(1)
  expect(mockGetLogger.mock.warn).toHaveBeenCalledWith(
    expect.objectContaining({
      message: expect.stringMatching(/find.*config file/i),
      ref: 'unable-to-find-config',
    }),
  )
  delete mockFindUp.mock.syncReturn
})

test(
  oneLine`
    init with an existing config will prompt for overriding
    which will do nothing if \`no\` is the response
  `,
  () => {
    mockReadLine.mock.keyInYNReturn = false
    mockFindUp.mock.syncReturn = '/some/path/to/things'

    const result = parse('init --config foo.js')
    expect(result).toBe(undefined)
    expect(mockReadLine.keyInYN).toHaveBeenCalledTimes(1)
    expect(mockReadLine.keyInYN).toHaveBeenCalledWith(
      expect.stringMatching(/overwrite.*file/),
    )
    expect(mockGetLogger.mock.info).toHaveBeenCalledTimes(1)
    expect(mockGetLogger.mock.info).toHaveBeenCalledWith(
      expect.stringMatching(/Exiting.*different/),
    )

    delete mockReadLine.mock.keyInYNReturn
    delete mockFindUp.mock.syncReturn
  },
)

test(
  oneLine`
    init with an existing config will prompt for overriding
    which will initialize if \`yes\` is the response
  `,
  () => {
    mockReadLine.mock.keyInYNReturn = true
    mockFindUp.mock.syncReturn = '/some/path/to/things'

    const result = parse('init foo.js')
    expect(result).toBe(undefined)
    expect(mockGetLogger.mock.info).toHaveBeenCalledWith(
      expect.stringMatching(/saved/),
    )

    delete mockReadLine.mock.keyInYNReturn
    delete mockFindUp.mock.syncReturn
  },
)

test('init without an existing config will initialize package-scripts.js', () => {
  mockFindUp.mock.syncReturn = null
  const result = parse('init')
  expect(result).toBe(undefined)
  expect(mockReadLine.keyInYN).toHaveBeenCalledTimes(0)
  expect(mockGetLogger.mock.info).toHaveBeenCalledWith(
    expect.stringMatching(/saved/),
  )

  delete mockReadLine.mock.keyInYNReturn
  delete mockFindUp.mock.syncReturn
})

test('init without an existing package.json will fail', () => {
  mockFindUp.mock.syncFail = true
  mockFindUp.mock.syncReturn = undefined

  const result = parse('init')
  expect(result).toBe(undefined)
  expect(mockReadLine.keyInYN).toHaveBeenCalledTimes(0)
  expect(mockGetLogger.mock.error).toHaveBeenCalledWith(
    expect.stringMatching(/Unable/),
  )

  delete mockFindUp.mock.syncFail
  delete mockReadLine.mock.keyInYNReturn
  delete mockFindUp.mock.syncReturn
})

test('if there is a help script in the psConfig, does not show the help', () => {
  mockBinUtils.mock.psConfig = {scripts: {help: 'hi'}, options: {}}
  expect(parse('help')).not.toBe(undefined)
  expect(mockGetLogger.mock.info).toHaveBeenCalledTimes(0)
})

test('if help is called with a script, it shows the help for that script', () => {
  mockBinUtils.mock.psConfig = {
    scripts: {
      specific: {
        description: 'the specific script',
        script: 'echo "specific"',
      },
    },
    options: {},
  }
  expect(parse('help specific')).toBe(undefined)
  expect(mockBinUtils.specificHelpScript).toHaveBeenCalledTimes(1)
  expect(mockGetLogger.mock.info).toHaveBeenCalledTimes(1)
})

// https://github.com/yargs/yargs/issues/782
// we can't test this functionality reasonably with unit tests
// so we've got an e2e test for it
// test(
//   'prompts for completions when --get-yargs-completions is specified',
//   () => {
//     const result = expect(parse('--get-yargs-completions f'))
//     console.log(result)
//   }
// )

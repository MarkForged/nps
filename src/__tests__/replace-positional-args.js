import {replacePositionalArgs} from '../replace-positional-args'

test('should return script and args if script undefined', () => {
  expect(replacePositionalArgs(undefined, ['foo'])).toEqual([
    undefined,
    ['foo'],
  ])
})

test('should return unmodified script and args if there are no positional args', () => {
  expect(replacePositionalArgs('foobar', ['foo'])).toEqual(['foobar', ['foo']])
})

test('should replace positional args in the order specified', () => {
  expect(replacePositionalArgs('foobar $2 $1', ['--', 'foo', 'bar'])).toEqual([
    'foobar bar foo',
    [],
  ])
})

test('should allow using positional args multiple times', () => {
  expect(
    replacePositionalArgs('foobar $1 $2 $1', ['--', 'foo', 'bar']),
  ).toEqual(['foobar foo bar foo', []])
})

test('should not throw if positional args required but not specified', () => {
  expect(() => replacePositionalArgs('foobar $2 $1', [])).not.toThrow()
})

test('should allow mixing positional args and environment variables', () => {
  expect(
    replacePositionalArgs('foobar $1 $FOO $2 $1', ['--', 'foo', 'bar']),
  ).toEqual(['foobar foo $FOO bar foo', []])
})

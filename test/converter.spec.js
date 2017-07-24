'use strict'

const test = require('blue-tape')
const dynamoConverter = require('../src/converter')
const awsConverter = require('aws-sdk').DynamoDB.Converter
const AwsSet = require('aws-sdk/lib/dynamodb/set')

var log = (...args) => console.log(...args.map(a => require('util').inspect(a, { colors: true, depth: null }))) // eslint-disable-line

const jsObject = {
  buffer: Buffer.from('string', 'utf8'),
  bufferList: [Buffer.from('string1', 'utf8'), Buffer.from('string2', 'utf8')],
  emptyArray: [],
  string: 'string',
  number: 123456,
  mixedList: ['string', 123],
  numberList: [1, 2, 3],
  stringList: ['a', 'b', 'c'],
  stringSet: new AwsSet(['1', '2', '3']),
  numberSet: new AwsSet([1, 2, 3]),
  binarySet: new AwsSet([Buffer.from('string1', 'utf8'), Buffer.from('string2', 'utf8')]),
  booleanTrue: true,
  booleanFalse: false,
  nullValue: null,
  objectValue: {
    string: 'string',
    numberList: [1, 2, 3],
    number: 1234,
    subObject: {
      string: 'substring',
      number: 123
    }
  }
}

const dynamoObject = awsConverter.marshall(jsObject)
const options = { convertEmptyValues: true }

// test('set', t => {
//   let setObject = {
//     stringSet: new AwsSet(['1', '2', '3']),
//     numberSet: new AwsSet([1, 2, 3]),
//     binarySet: new AwsSet([Buffer.from('string1', 'utf8'), Buffer.from('string2', 'utf8')])
//   }
//   let result = dynamoConverter.toDynamo(setObject)
//   // log('num', new AwsSet([1, 2, 3]).type)
//   log('set', result)
// })

test('converter', spec => {
  spec.test('toDynamo should match aws for non-empty, non-binary types', t => {
    let result = dynamoConverter.toDynamo(jsObject, options)
    t.deepEqual(result, dynamoObject, 'should match aws marshall exactly')

    t.end()
  })

  spec.test('toDynamo should throw an error for empty string and buffer types', t => {
    t.plan(2)
    t.throws(() => dynamoConverter.toDynamo({ emptyString: '' }), /emptyString/, 'throws on string')
    t.throws(() => dynamoConverter.toDynamo({ emptyBuffer: Buffer.from('') }), /emptyBuffer/, 'throws on buffer')

    t.end()
  })

  spec.test('toDynamo should remove empty values when removeEmptyValues is set', t => {
    t.plan(1)
    let result = dynamoConverter.toDynamo({ emptyBuffer: Buffer.from(''), emptyString: '', undefinedString: undefined, name: 'tim' }, { removeEmptyValues: true })
    let match = awsConverter.marshall({ name: 'tim' })
    t.deepEqual(result, match, 'matches aws object')
    t.end()
  })

  spec.test('toDynamo should remove functions', t => {
    t.plan(1)
    let result = dynamoConverter.toDynamo({ func: () => {}, name: 'tim' })
    let match = awsConverter.marshall({ name: 'tim' })
    t.deepEqual(result, match, 'matches aws object')
    t.end()
  })

  spec.test('toDynamo should convert empty values to null when convertEmptyValues is set', t => {
    t.plan(3)
    let result = dynamoConverter.toDynamo({ emptyBuffer: Buffer.from(''), emptyString: '', name: 'tim' }, { convertEmptyValues: true })
    let match = awsConverter.marshall({ emptyBuffer: Buffer.from(''), emptyString: '', name: 'tim' }, { convertEmptyValues: true })
    t.deepEqual(result, match, 'matches aws object')
    t.same(result.emptyString, { NULL: true }, 'string is NULL')
    t.same(result.emptyBuffer, { NULL: true }, 'buffer is NULL')
    t.end()
  })

  spec.test('toJS should convert back aws generated value', t => {
    let result = dynamoConverter.toJS(dynamoObject)
    t.deepEqual(result, jsObject, 'matches source object')

    t.end()
  })

  const complexResponse = [
    {
      Name: {
        string: {
          S: 'string'
        }
      }
    }
  ]

  const complexTarget = [
    {
      Name: {
        string: 'string'
      }
    }
  ]
  spec.test('toJS should handle partially-encoded objects', t => {
    let result = dynamoConverter.toJS(complexResponse)
    t.deepEqual(result, complexTarget, 'should convert to correct js object properties')

    t.end()
  })
})

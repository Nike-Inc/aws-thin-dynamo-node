'use strict'

const test = require('blue-tape')
const DynamoSet = require('../src/DynamoSet')

test('Dynamo Set', spec => {
  spec.test('allows string sets', t => {
    t.plan(2)
    let set = new DynamoSet(['1', '2', '3'])
    t.same(set.values, ['1', '2', '3'], 'has values')
    t.equal(set.type, 'String')
  })

  spec.test('allows number sets', t => {
    t.plan(2)
    let set = new DynamoSet([1, 2, 3])
    t.same(set.values, [1, 2, 3], 'has values')
    t.equal(set.type, 'Number')
  })

  spec.test('allows binary sets', t => {
    t.plan(2)
    let set = new DynamoSet([Buffer.from('string1', 'utf8'), Buffer.from('string2', 'utf8')])
    t.same(set.values, [Buffer.from('string1', 'utf8'), Buffer.from('string2', 'utf8')], 'has values')
    t.equal(set.type, 'Binary')
  })

  spec.test('does not allow other types', t => {
    t.plan(3)
    t.throws(() => new DynamoSet({ name: 1 }), /InvalidSetType/, 'does not allow objects')
    t.throws(() => new DynamoSet(new Date()), /InvalidSetType/, 'does not allow dates')
    t.throws(() => new DynamoSet([ [1], [2] ]), /InvalidSetType/, 'does not allow arrays')
  })
})

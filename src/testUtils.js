'use strict'

const util = require('./util')

module.exports = makeUtils

function makeUtils (options) {
  let context = Object.assign({}, options)

  context.logger = util.logWrapper(context.logger)
  if (!context.credentials && context.secretAccessKey) {
    context.credentials = {
      secretAccessKey: context.secretAccessKey,
      accessKeyId: context.accessKeyId,
      sessionToken: context.sessionToken
    }
  }

  return {
    createTable: createTable.bind(null, context),
    deleteTable: deleteTable.bind(null, context)
  }
}

function createTable (context, params, callback) {
  return dynamoRequest(context, 'CreateTable', params, callback)
}

function deleteTable (context, params, callback) {
  return dynamoRequest(context, 'DeleteTable', params, callback)
}

function dynamoRequest (context, action, params, callback) {
  context.logger.info('starting request', action)
  return util.optionalCallback(context, callback, util.signedRequest(context, {
    action: action,
    body: JSON.stringify(params)
  }).then(response => {
    context.logger.info('response received', action)
    return response.data
  }))
}

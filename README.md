[![NPM version](https://img.shields.io/npm/v/aws-thin-dynamo.svg)](https://www.npmjs.com/package/aws-thin-dynamo)
[![JavaScript Style Guide](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com)

# What is this for?

The [AWS JS SDK](https://github.com/aws/aws-sdk-js) does a lot. For Lambdas is does *too much*; it incurs a 1-2 seconds cold-start time, depending on what you load from it. Even for directly loading the smaller clients, it loads 800kb of code from "core". If you really need to squeeze out that extra performance for Lambda cold-starts, you need a smaller client. This client, with dependencies, is ~32kb. If you are using other thin clients, those dependencies are identical, and share 8kb of the size (its mostly the AWS V4 request signer). This should cost cold-start no more than 100ms, even on the smallest lambda configuration size.

**aws-thin-dynamo** attempts to be a drop-in replacement for the API it does cover. For ease of use the `callback` parameter can be ommitted from all async calls to get a Promise instead.

As this attempts to duplicate the Official Client's API, you can use [the AWS docs](http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/DynamoDB/DocumentClient.html). Don't forget this client will return a promise if you don't provide a `callback` parameter.

# Installation

```
npm i aws-thin-dynamo
```
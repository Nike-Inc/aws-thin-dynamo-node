#!/bin/bash
set -e

# run tests and save as report
npm run test:ci

# setup reports directory
mkdir -p junit

#copy test output into reports
cp ./test-results.xml junit/test-results.xml
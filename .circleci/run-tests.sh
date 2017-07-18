#!/bin/bash
set -e

# run tests and save as report
npm run test:ci

# setup reports directory
mkdir -p reports

#copy test output into reports
cp ./test-results.xml reports/ava.xml
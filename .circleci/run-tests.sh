#!/bin/bash

# run tests and save as report
npm run test:ci
CODE=$?

# setup reports directory
mkdir -p test-results

if [ -e xunit.xml ]; then
  TestSource="xunit.xml"
  TestTarget="ava.xml"
elif [ -e junit.xml ]; then
  TestSource="junit.xml"
  TestTarget="test-results.xml"
else
  echo "No test results found"
  exit 1
fi

cp ./${TestSource} test-results/${TestTarget}
exit $CODE
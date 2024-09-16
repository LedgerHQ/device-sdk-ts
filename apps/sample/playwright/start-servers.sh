#!/bin/bash

echo "Starting mock server..."
(cd ../../../ && cd device-sdk-mock-webserver && ./gradlew run) &
MOCK_SERVER_PID=$!

while ! nc -z localhost 8080; do   
  echo "Waiting for mock server to start..."
  sleep 1
done
echo "mock server is up!"

echo "Starting sample app..."
(cd .. && pnpm sample dev:default-mock) &
SAMPLE_APP_PID=$!

while ! nc -z localhost 3000; do   
  echo "Waiting for sample app to start..."
  sleep 1
done
echo "sample app is up!"

# trap to kill the background processes on script exit
trap "kill $MOCK_SERVER_PID $SAMPLE_APP_PID" EXIT

wait $MOCK_SERVER_PID $SAMPLE_APP_PID

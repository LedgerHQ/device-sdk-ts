#!/bin/bash

ROOT_PATH=$(cd $(dirname $0)/..; pwd)
DAPP=$1

if [ -z "$DAPP" ]; then
  echo "Provider is required"
  exit 1
fi

# Check if $2 is a flag (starts with --) or a chain name
if [ -z "$2" ] || [[ "$2" == --* ]]; then
    TEST_FILE="$ROOT_PATH/ressources/erc7730/$DAPP/raw-$DAPP.json"
    ARGUMENTS="${@:2}"
else
    CHAIN=$2
    TEST_FILE="$ROOT_PATH/ressources/erc7730/$DAPP/raw-$DAPP.$CHAIN.json"
    ARGUMENTS="${@:3}"
fi



if [ ! -f "$TEST_FILE" ]; then
  echo "Test file not found: $TEST_FILE"
  exit 1
fi

pnpm cs-tester cli raw-file $TEST_FILE $ARGUMENTS
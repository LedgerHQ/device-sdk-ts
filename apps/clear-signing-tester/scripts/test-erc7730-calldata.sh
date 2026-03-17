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
  SKIP_FILE="${TEST_FILE%.json}.skip.json"
  if [ -f "$SKIP_FILE" ]; then
    echo "Skipping $SKIP_FILE (.skip file)"
    exit 0
  fi
  echo "Test file not found: $TEST_FILE"
  exit 1
fi

(cd $ROOT_PATH && pnpm cli raw-file $TEST_FILE $ARGUMENTS)
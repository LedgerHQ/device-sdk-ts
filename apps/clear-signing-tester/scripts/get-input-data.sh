#!/bin/bash

curl -s "https://etherscan.io/tx/$1" | grep -o 'Function:.*' | sed 's/Function://' | sed 's/(.*)//g'

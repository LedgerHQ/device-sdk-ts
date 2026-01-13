#!/bin/bash

curl -s "https://etherscan.io/address/$1" | grep 'data-tadd' | sed -n 's/.*<span>(\([^)]*\))<\/span>.*/\1/p'

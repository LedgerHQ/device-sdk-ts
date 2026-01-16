#!/bin/bash

curl -s "https://etherscan.io/getRawTx?tx=$1" | grep "Returned Raw Transaction Hex" | grep -o '0x[0-9a-fA-F]*'

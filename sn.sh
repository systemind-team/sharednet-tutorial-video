#!/bin/sh
# usage: sn.sh <agent> <sharednet args...>
#   agents/<agent>/env        extra env (driver markers, keys)
#   agents/<agent>/machine    which simulated machine (shared HOME) it runs on
#   agents/<agent>/workspace  project directory name
SP="$(cd "$(dirname "$0")" && pwd)/.state"
A=$1; shift
D=$SP/agents/$A
M=$(cat $D/machine 2>/dev/null || echo $A)
W=$(cat $D/workspace 2>/dev/null || echo work)
mkdir -p $SP/machines/$M/home $SP/machines/$M/$W
cd $SP/machines/$M/$W
exec env -i PATH="$PATH" HOME=$SP/machines/$M/home TERM=xterm-256color SHAREDNET_WAKE=off SHAREDNET_BASE_URL=http://127.0.0.1:3001 $(cat $D/env 2>/dev/null) \
  node --no-warnings --experimental-strip-types /Users/chenyu/Desktop/SharedNet/packages/cli/src/main.ts "$@"

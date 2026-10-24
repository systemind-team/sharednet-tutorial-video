#!/bin/sh
# Fresh "Alex Rivera" account and a clean simulated laptop for one take.
set -e
SP="$(cd "$(dirname "$0")" && pwd)/.state"
B=http://127.0.0.1:3001; PW=$(cat $SP/demo-password.txt)
E="alex.$(date +%s)@sharednet.test"
curl -s --noproxy '*' -o /dev/null -X POST $B/api/auth/sign-up/email -H 'Content-Type: application/json' -H "Origin: $B" -d "{\"email\":\"$E\",\"password\":\"$PW\",\"name\":\"Alex Rivera\"}"
psql postgres://localhost:5432/sharednet_dev -qc "update sharednet_auth.\"user\" set email_verified=true where email='$E'"
rm -f $SP/alex.cookies
curl -s --noproxy '*' -c $SP/alex.cookies -o /dev/null -X POST $B/api/auth/sign-in/email -H 'Content-Type: application/json' -H "Origin: $B" -d "{\"email\":\"$E\",\"password\":\"$PW\"}"
rm -rf $SP/machines/alex-mbp
echo "$E"
rm -f $SP/sam.cookies
curl -s --noproxy '*' -c $SP/sam.cookies -o /dev/null -X POST $B/api/auth/sign-in/email -H 'Content-Type: application/json' -H "Origin: $B" -d "{\"email\":\"sam@sharednet.test\",\"password\":\"$PW\"}"
# Sam's side: a fresh Cursor session and its own Room, so earlier takes leave nothing behind.
S=$($(dirname "$0")/sn.sh sam-cursor session start --json | python3 -c "import sys,json;print(json.load(sys.stdin)['session_id'])")
echo $S > $SP/sam.session
$(dirname "$0")/sn.sh sam-cursor room create --name design-system --session $S | python3 -c "import sys,json;print(json.load(sys.stdin)['room']['id'])" > $SP/sam.room
psql postgres://localhost:5432/sharednet_dev -qc "update sharednet.instance set display_name='design-reviewer' where id='$S'"
echo "sam $S $(cat $SP/sam.room)"

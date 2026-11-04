#!/usr/bin/env bash
# Smoke-test every API route with three users. Usage: smoke.sh <base-url>
set -u
B=${1:-http://localhost:3100}
D=$(mktemp -d)
J='content-type: application/json'
UP=
SAMPLES=/home/TurtleWolfe/ajaia-assessment/samples
FORGED="ajaia_session=carol.$(printf 'A%.0s' {1..43})"

echo "home no cookie: $(curl -s -o /dev/null -w '%{http_code} %{redirect_url}' "$B/")"
echo "api no cookie: $(curl -s -o /dev/null -w '%{http_code}' "$B/api/documents")"
for u in alice bob carol; do curl -s -c "$D/$u" -H "$J" -d "{\"userId\":\"$u\"}" "$B/api/session" >/dev/null; done
echo "alice list: $(curl -s -b "$D/alice" "$B/api/documents" | head -c 300)"
ID=$(curl -s -b "$D/alice" -H "$J" -d '{}' "$B/api/documents" | python3 -c 'import sys,json;print(json.load(sys.stdin)["id"])')
echo "created $ID"
echo "save v1: $(curl -s -b "$D/alice" -X PATCH -H "$J" -d '{"content":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"hi"}]}]},"version":1}' "$B/api/documents/$ID")"
echo "stale v1: $(curl -s -w ' %{http_code}' -b "$D/alice" -X PATCH -H "$J" -d '{"content":{"type":"doc"},"version":1}' "$B/api/documents/$ID")"
echo "rename: $(curl -s -b "$D/alice" -X PATCH -H "$J" -d '{"title":"Smoke test"}' "$B/api/documents/$ID")"
echo "empty title: $(curl -s -w ' %{http_code}' -b "$D/alice" -X PATCH -H "$J" -d '{"title":"  "}' "$B/api/documents/$ID")"
echo "carol api: $(curl -s -o /dev/null -w '%{http_code}' -b "$D/carol" "$B/api/documents/$ID")  carol page: $(curl -s -o /dev/null -w '%{http_code}' -b "$D/carol" "$B/docs/$ID")"
echo "share bob viewer: $(curl -s -b "$D/alice" -H "$J" -d '{"userId":"bob","role":"viewer"}' "$B/api/documents/$ID/shares")"
echo "bob read: $(curl -s -o /dev/null -w '%{http_code}' -b "$D/bob" "$B/api/documents/$ID")  bob rename: $(curl -s -w ' %{http_code}' -b "$D/bob" -X PATCH -H "$J" -d '{"title":"nope"}' "$B/api/documents/$ID")"
echo "bob shares: $(curl -s -w ' %{http_code}' -b "$D/bob" "$B/api/documents/$ID/shares")"
echo "bob list shared: $(curl -s -b "$D/bob" "$B/api/documents" | python3 -c 'import sys,json;print([(d["title"],d["role"]) for d in json.load(sys.stdin)["shared"]])')"
curl -s -b "$D/alice" -H "$J" -d '{"userId":"bob","role":"editor"}' "$B/api/documents/$ID/shares" >/dev/null
echo "bob as editor save v2: $(curl -s -w ' %{http_code}' -b "$D/bob" -X PATCH -H "$J" -d '{"content":{"type":"doc","content":[{"type":"paragraph"}]},"version":2}' "$B/api/documents/$ID")"
echo "revoke: $(curl -s -b "$D/alice" -X DELETE -H "$J" -d '{"userId":"bob"}' "$B/api/documents/$ID/shares")  bob after revoke: $(curl -s -o /dev/null -w '%{http_code}' -b "$D/bob" "$B/api/documents/$ID")"
echo "forged cookie: $(curl -s -o /dev/null -w '%{http_code}' -H "cookie: $FORGED" "$B/api/documents")"
R=$(curl -s -w ' %{http_code}' -b "$D/alice" -F "file=@$SAMPLES/sample.md" "$B/api/import"); echo "upload md: $R"; UP+=" $(echo "$R" | python3 -c 'import sys,json;print(json.loads(sys.stdin.read().rsplit(" ",1)[0])["id"])')"
R=$(curl -s -w ' %{http_code}' -b "$D/alice" -F "file=@$SAMPLES/sample.docx" "$B/api/import"); echo "upload docx: $R"; UP+=" $(echo "$R" | python3 -c 'import sys,json;print(json.loads(sys.stdin.read().rsplit(" ",1)[0])["id"])')"
R=$(curl -s -w ' %{http_code}' -b "$D/alice" -F "file=@$SAMPLES/sample.txt" "$B/api/import"); echo "upload txt: $R"; UP+=" $(echo "$R" | python3 -c 'import sys,json;print(json.loads(sys.stdin.read().rsplit(" ",1)[0])["id"])')"
echo "upload pdf: $(curl -s -w ' %{http_code}' -b "$D/alice" -F "file=@$SAMPLES/sample.txt;filename=x.pdf" "$B/api/import")"
echo "alice doc page: $(curl -s -o /dev/null -w '%{http_code}' -b "$D/alice" "$B/docs/$ID")"
echo "delete smoke doc: $(curl -s -b "$D/alice" -X DELETE "$B/api/documents/$ID")"
for u in $UP; do curl -s -o /dev/null -b "$D/alice" -X DELETE "$B/api/documents/$u"; done
echo "after cleanup alice owns: $(curl -s -b "$D/alice" "$B/api/documents" | python3 -c 'import sys,json;print([d["title"] for d in json.load(sys.stdin)["owned"]])')"
rm -rf "$D"

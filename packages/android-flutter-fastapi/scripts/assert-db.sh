#!/usr/bin/env bash
# assert-db.sh
# Database assertion helper shared by L1/L2/L3 e2e. Verifies rows landed correctly.
# Usage:
#   bash scripts/assert-db.sh --table transactions --where '{"amount_cents":1250}' --expect exists
#   bash scripts/assert-db.sh --table transactions --where '{"user_id":"u1"}' --expect count:1
#   bash scripts/assert-db.sh --sqlite /tmp/app.db --table accounts --where '{}' --expect 'count>=1'
#
# Connection: backend DB via $DATABASE_URL (SQLAlchemy), or a sqlite file via --sqlite <path>
# (e.g. an exported drift DB for L3 native assertions).

set -euo pipefail

TABLE="" WHERE="{}" EXPECT="exists" SQLITE_PATH=""
while [ $# -gt 0 ]; do
  case "$1" in
    --table)  TABLE="$2"; shift 2;;
    --where)  WHERE="$2"; shift 2;;
    --expect) EXPECT="$2"; shift 2;;
    --sqlite) SQLITE_PATH="$2"; shift 2;;
    *) echo "Unknown arg: $1" >&2; exit 2;;
  esac
done

[ -z "$TABLE" ] && { echo "ERROR: --table required" >&2; exit 2; }

python3 - "$TABLE" "$WHERE" "$EXPECT" "$SQLITE_PATH" <<'PYEOF'
import json, os, re, sys
table, where_raw, expect, sqlite_path = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
where = json.loads(where_raw or "{}")

# build a parameterized WHERE clause
clauses, params = [], {}
for i, (k, v) in enumerate(where.items()):
    if v is None:
        clauses.append(f"{k} IS NULL")
    else:
        clauses.append(f"{k} = :p{i}")
        params[f"p{i}"] = v
where_sql = (" WHERE " + " AND ".join(clauses)) if clauses else ""
sql = f"SELECT COUNT(*) FROM {table}{where_sql}"

if sqlite_path:
    import sqlite3
    con = sqlite3.connect(sqlite_path)
    # translate :pN to ? for sqlite3
    ordered = [params[f"p{i}"] for i in range(len(params))]
    sql_q = re.sub(r":p\d+", "?", sql)
    count = con.execute(sql_q, ordered).fetchone()[0]
    con.close()
else:
    url = os.environ.get("DATABASE_URL")
    if not url:
        print("ERROR: set DATABASE_URL or pass --sqlite <path>", file=sys.stderr); sys.exit(2)
    from sqlalchemy import create_engine, text
    eng = create_engine(url)
    with eng.connect() as conn:
        count = conn.execute(text(sql), params).scalar()

# evaluate expectation
ok, detail = False, ""
if expect == "exists":
    ok, detail = count > 0, f"count={count} (expected >0)"
elif expect in ("not-exists", "absent"):
    ok, detail = count == 0, f"count={count} (expected 0)"
elif expect.startswith("count:"):
    n = int(expect.split(":", 1)[1]); ok, detail = count == n, f"count={count} (expected =={n})"
else:
    m = re.match(r"count\s*(>=|<=|>|<|==)\s*(\d+)", expect)
    if m:
        op, n = m.group(1), int(m.group(2))
        ok = {"==": count==n, ">=": count>=n, "<=": count<=n, ">": count>n, "<": count<n}[op]
        detail = f"count={count} (expected {op}{n})"
    else:
        print(f"ERROR: unknown --expect '{expect}'", file=sys.stderr); sys.exit(2)

if ok:
    print(f"✅ DB assert PASS: {table} {where_raw} → {detail}")
    sys.exit(0)
else:
    print(f"❌ DB assert FAIL: {table} {where_raw} → {detail}")
    sys.exit(1)
PYEOF

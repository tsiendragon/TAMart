#!/usr/bin/env bash
# e2e-promote.sh
# Promote a web-validated flow (L2) into a native integration_test (L3).
# Generates frontend/integration_test/<feature>_e2e_test.dart from e2e/flows/<feature>.flow.yaml,
# keeping the flow spec as the single source of truth for both layers.
# Usage: bash scripts/e2e-promote.sh <feature>

set -euo pipefail

FEATURE="${1:-}"
FRONTEND_DIR="${FRONTEND_DIR:-frontend}"
FLOW="e2e/flows/${FEATURE}.flow.yaml"
OUT="${FRONTEND_DIR}/integration_test/${FEATURE}_e2e_test.dart"

[ -z "$FEATURE" ] && { echo "ERROR: feature required. Usage: e2e-promote.sh <feature>" >&2; exit 2; }
[ -f "$FLOW" ] || { echo "ERROR: flow spec not found: $FLOW" >&2; exit 1; }
command -v python3 &>/dev/null || { echo "ERROR: python3 required" >&2; exit 1; }

mkdir -p "${FRONTEND_DIR}/integration_test"

python3 - "$FLOW" "$OUT" "$FEATURE" <<'PYEOF'
import sys, re
flow_path, out_path, feature = sys.argv[1], sys.argv[2], sys.argv[3]

# minimal YAML step parsing without PyYAML dependency: read 'steps:' block lines
text = open(flow_path, encoding="utf-8").read()
steps = []
in_steps = False
for line in text.splitlines():
    if re.match(r'^\s*steps:\s*$', line):
        in_steps = True; continue
    if in_steps:
        if re.match(r'^\S', line):  # next top-level key ends steps
            break
        m = re.match(r'\s*-\s*(\w+):\s*(.*)$', line)
        if m:
            steps.append((m.group(1), m.group(2).strip()))

def kv(s):
    d = {}
    for part in re.findall(r'(\w+)\s*:\s*("?[^,}]+"?)', s.strip().strip("{}")):
        d[part[0]] = part[1].strip().strip('"')
    return d

lines = []
emit = lines.append
emit("// GENERATED from %s by e2e-promote.sh — edit flow spec, then re-run." % flow_path)
emit("// L3 native e2e: exercises the real APK code path (native sqlite/secure storage).")
emit("import 'package:flutter/material.dart';")
emit("import 'package:flutter_test/flutter_test.dart';")
emit("import 'package:integration_test/integration_test.dart';")
emit("// import 'package:<your_app>/main_e2e.dart' as app;  // TODO: set package name")
emit("")
emit("void main() {")
emit("  IntegrationTestWidgetsFlutterBinding.ensureInitialized();")
emit("")
emit("  testWidgets('%s e2e flow', (tester) async {" % feature)
emit("    // app.main(); await tester.pumpAndSettle();  // TODO: launch e2e entry point")
emit("")
for action, arg in steps:
    a = kv(arg)
    if action == "tap":
        emit("    await tester.tap(find.bySemanticsIdentifier('%s'));" % a.get("id",""))
        emit("    await tester.pumpAndSettle();")
    elif action == "type":
        emit("    // TODO: enterText needs an EditableText finder; descend from the semantics node if needed")
        emit("    await tester.enterText(find.bySemanticsIdentifier('%s'), '%s');" % (a.get("id",""), a.get("value","")))
        emit("    await tester.pumpAndSettle();")
    elif action == "expect_screen":
        emit("    expect(find.bySemanticsIdentifier('%s'), findsOneWidget);" % arg.strip())
    elif action == "expect_text":
        emit("    expect(find.bySemanticsIdentifier('%s'), findsWidgets); // contains '%s' — refine if needed" % (a.get("id",""), a.get("contains","")))
    elif action == "expect_visible":
        emit("    expect(find.bySemanticsIdentifier('%s'), findsOneWidget);" % a.get("id", arg.strip()))
    elif action == "wait":
        emit("    await tester.pumpAndSettle();")
    elif action == "screenshot":
        emit("    // screenshot '%s' — optional on L3 (see takeScreenshot + driver); primary baselines live in L2" % arg.strip())
    else:
        emit("    // TODO: unmapped step '%s: %s'" % (action, arg))
emit("")
emit("    // DB assertions: run out-of-band against the native DB, e.g.")
emit("    //   bash scripts/assert-db.sh --sqlite <exported.db> --table <t> --where '{...}' --expect exists")
emit("  });")
emit("}")

open(out_path, "w", encoding="utf-8").write("\n".join(lines) + "\n")
print("✅ generated %s (%d steps mapped). Review TODOs before running." % (out_path, len(steps)))
PYEOF

echo "▶ Next: review $OUT, set package import, then: bash scripts/e2e-native-run.sh $FEATURE"

#!/usr/bin/env bash
# After a push: wait for its `checks` run on GitHub (typecheck, lint, tests; then the APK, which
# checks.yml builds only when every check passed) and report how it went, one line per outcome:
#
#   CHECKS PASSED — building the APK
#   CHECKS FAILED                      followed by one `ERROR <file> <line> <title> :: <message>` per problem
#   APK READY <path> (<size>)          the APK is downloaded to <path>, ready to hand on
#   APK FAILED                         followed by the Gradle error
#   CANCELLED                          a newer push to the branch took over
#
# Exit code: 0 APK ready (or checks passed on a branch that gets no APK), 1 something failed, 2 cancelled.
# Meant to be watched line by line (an agent's monitor, or a terminal): each line is an event to act on —
# send the APK on, or fix the errors and push again.
#
# Usage: scripts/ci-watch.sh [commit] [branch]   (defaults: HEAD, the current branch)
#   OUT_DIR=…  where the APK goes (default: $TMPDIR/mineforgefight-apk)
# Needs `gh` (signed in) and git; run it from inside the repository.
set -uo pipefail

repo=lacho2350/mineForgeFight
sha=$(git rev-parse "${1:-HEAD}") || exit 1
branch=${2:-$(git rev-parse --abbrev-ref HEAD)}
out_dir=${OUT_DIR:-${TMPDIR:-/tmp}/mineforgefight-apk}
short=${sha::7}

# The failure annotations of a job (what tsc, lint, jest or Gradle reported), minus the runner's noise.
errors() {
  gh api "repos/$repo/check-runs/$1/annotations?per_page=100" --jq '.[]
    | select(.annotation_level == "failure" and (.message | test("Process completed|was canceled") | not))
    | "ERROR \(.path) \(.start_line) \(.title // "") :: \(.message | gsub("\n"; " | ") | .[0:900])"' 2>/dev/null
}

# The job's [id, status, conclusion], by name prefix ("checks", or "apk" — a called workflow's job is "apk / apk").
job() {
  printf '%s\n' "$jobs" | awk -F'\t' -v name="$1" 'index($2, name) == 1 { print $1, $3, $4; exit }'
}

run=""
said_checks=""
while true; do
  if [ -z "$run" ]; then
    run=$(gh api "repos/$repo/actions/runs?head_sha=$sha&branch=$branch&event=push&per_page=20" \
      --jq '[.workflow_runs[] | select(.name == "checks")][0].id // empty' 2>/dev/null)
    [ -z "$run" ] && { sleep 20; continue; }
  fi
  jobs=$(gh api "repos/$repo/actions/runs/$run/jobs?per_page=50" --jq '.jobs[] | [.id, .name, .status, (.conclusion // "")] | @tsv' 2>/dev/null) || { sleep 30; continue; }
  read -r checks_id checks_status checks_result <<<"$(job checks)"
  if [ "${checks_status:-}" = "completed" ] && [ -z "$said_checks" ]; then
    said_checks=1
    case "$checks_result" in
      success)
        if [ "$branch" = main ] || [ "$branch" = release-prep ]; then
          echo "CHECKS PASSED — building the APK ($branch at $short)"
        else
          echo "CHECKS PASSED ($branch at $short; no APK for this branch)"
          exit 0
        fi
        ;;
      cancelled)
        echo "CANCELLED ($branch at $short: a newer push took over)"
        exit 2
        ;;
      *)
        echo "CHECKS FAILED ($branch at $short) — no APK built"
        errors "$checks_id"
        exit 1
        ;;
    esac
  fi
  read -r apk_id apk_status apk_result <<<"$(job apk)"
  # The run is over and never had an APK job (a commit from before the APK moved into checks.yml).
  if [ -n "$said_checks" ] && [ -z "${apk_id:-}" ] && [ "$(gh api "repos/$repo/actions/runs/$run" --jq .status 2>/dev/null)" = completed ]; then
    echo "APK FAILED ($branch at $short): this run has no APK job — see https://github.com/$repo/releases/tag/apk-$branch"
    exit 1
  fi
  if [ -n "$said_checks" ] && [ "${apk_status:-}" = "completed" ]; then
    case "$apk_result" in
      success)
        release=$(gh api "repos/$repo/releases/tags/apk-$branch" --jq '[.target_commitish, (.assets[0].id | tostring), .assets[0].name] | @tsv' 2>/dev/null)
        read -r target asset name <<<"$release"
        if [ "${target:-}" != "$sha" ] || [ -z "${asset:-}" ]; then
          echo "APK FAILED ($branch at $short): the release apk-$branch is not this commit's build (it's ${target::7})"
          exit 1
        fi
        mkdir -p "$out_dir"
        path="$out_dir/${name%.apk}-$short.apk"
        if gh api -H "Accept: application/octet-stream" "repos/$repo/releases/assets/$asset" > "$path" && [ -s "$path" ]; then
          echo "APK READY $path ($(du -h "$path" | cut -f1)) — https://github.com/$repo/releases/download/apk-$branch/$name"
          exit 0
        fi
        echo "APK FAILED ($branch at $short): built, but the download failed — https://github.com/$repo/releases/download/apk-$branch/$name"
        exit 1
        ;;
      cancelled)
        echo "CANCELLED ($branch at $short: a newer push took over the APK build)"
        exit 2
        ;;
      skipped)
        echo "APK FAILED ($branch at $short): the APK job was skipped"
        exit 1
        ;;
      *)
        echo "APK FAILED ($branch at $short)"
        errors "$apk_id"
        exit 1
        ;;
    esac
  fi
  sleep 30
done

#!/usr/bin/env bash
# Stop the QA stack.  --wipe also removes the postgres volume.
source "$(dirname "${BASH_SOURCE[0]}")/_env.sh"

if [[ "${1:-}" == "--wipe" ]]; then
  echo "== QA stack down + volume wipe =="
  "${COMPOSE[@]}" down -v --remove-orphans
else
  echo "== QA stack down (volume kept) =="
  "${COMPOSE[@]}" down --remove-orphans
fi

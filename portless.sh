#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

if [[ "${PORTLESS:-1}" == "0" ]]; then
	exec bun run dev:direct
fi

exec ./node_modules/.bin/portless gotm-remix bun run dev:direct

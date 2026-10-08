#!/bin/sh
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then echo "Nejdriv nainstaluj Node.js z https://nodejs.org (verze LTS)."; exit 1; fi
( sleep 2; (open http://localhost:3000/host || xdg-open http://localhost:3000/host) >/dev/null 2>&1 ) &
node server.js

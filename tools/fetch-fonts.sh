#!/usr/bin/env bash
# Download the game's two fonts into public/fonts so the phone app has them
# offline. Both are SIL Open Font License fonts from Google Fonts. The web
# version falls back to Google Fonts when these files are missing.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p public/fonts
base=https://raw.githubusercontent.com/google/fonts/main/ofl
get() { curl -fsSL --retry 3 -o "public/fonts/$2" "$base/$1"; echo "  $2"; }
echo "Fetching fonts into public/fonts:"
get 'grenzegotisch/GrenzeGotisch%5Bwght%5D.ttf' GrenzeGotisch.ttf
for w in Regular Medium SemiBold Bold; do get "barlowsemicondensed/BarlowSemiCondensed-$w.ttf" "BarlowSemiCondensed-$w.ttf"; done
get 'grenzegotisch/OFL.txt' OFL-GrenzeGotisch.txt
get 'barlowsemicondensed/OFL.txt' OFL-BarlowSemiCondensed.txt

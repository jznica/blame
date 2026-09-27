#!/bin/sh
# Inline core.js into the page so the demo is a single file.
cd "$(dirname "$0")"
python3 -c "
src=open('index.src.html').read(); core=open('core.js').read()
open('index.html','w').write(src.replace('/*@@CORE@@*/', core))
"
echo "built index.html"

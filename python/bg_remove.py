#!/usr/bin/env python3
"""Background removal using rembg (U2-Net model)."""
import sys
import json
from pathlib import Path
from rembg import remove
from PIL import Image

def process(input_path, output_path):
    img = Image.open(input_path)
    result = remove(img)
    result.save(output_path, 'PNG')
    w, h = result.size
    return {'width': w, 'height': h, 'output': str(output_path)}

if __name__ == '__main__':
    if len(sys.argv) < 3:
        print(json.dumps({'error': 'Usage: bg_remove.py <input> <output>'}))
        sys.exit(1)
    try:
        result = process(sys.argv[1], sys.argv[2])
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({'error': str(e)}))
        sys.exit(1)

#!/usr/bin/env python3
"""IP/Copyright risk detection using perceptual hashing + OCR + brand keywords."""
import sys
import json
import os
from pathlib import Path
from PIL import Image
import imagehash

# High-risk brand keywords (expandable)
BRAND_KEYWORDS = [
    'disney', 'marvel', 'nike', 'adidas', 'supreme', 'gucci', 'louis vuitton',
    'chanel', 'prada', 'hermes', 'coca cola', 'pepsi', 'starbucks', 'apple',
    'google', 'microsoft', 'ferrari', 'lamborghini', 'porsche', 'bmw',
    'pokemon', 'pikachu', 'hello kitty', 'sanrio', 'snoopy', 'peanuts',
    'star wars', 'harry potter', 'batman', 'superman', 'spiderman',
    'mickey mouse', 'minnie', 'winnie the pooh', 'frozen', 'elsa',
    'nfl', 'nba', 'mlb', 'fifa', 'olympics', 'world cup',
    'louis vuitton', 'lv', 'versace', 'burberry', 'dior', 'fendi',
    'barbie', 'hot wheels', 'lego', 'transformers', 'nintendo', 'mario',
    'sonic', 'minecraft', 'fortnite', 'roblox', 'among us',
]

def compute_hashes(image_path):
    """Compute multiple perceptual hashes for an image."""
    img = Image.open(image_path)
    return {
        'phash': str(imagehash.phash(img)),
        'dhash': str(imagehash.dhash(img)),
        'ahash': str(imagehash.average_hash(img)),
    }

def check_brand_keywords(text):
    """Check text against brand keyword blacklist."""
    text_lower = text.lower()
    found = [kw for kw in BRAND_KEYWORDS if kw in text_lower]
    return found

def check_image(image_path, brand_hashes_dir=None):
    """Run full IP check on an image. Returns risk assessment."""
    results = {
        'risk_level': 'compliant',
        'checks': [],
        'details': []
    }

    # 1. Compute hashes
    hashes = compute_hashes(image_path)
    results['hashes'] = hashes

    # 2. Compare against known brand hashes if available
    if brand_hashes_dir and os.path.exists(brand_hashes_dir):
        brand_files = Path(brand_hashes_dir).glob('*.json')
        for bf in brand_files:
            brand_data = json.loads(bf.read_text())
            brand_phash = imagehash.hex_to_hash(brand_data.get('phash', ''))
            img_phash = imagehash.hex_to_hash(hashes['phash'])
            distance = brand_phash - img_phash
            if distance < 10:
                results['risk_level'] = 'infringing'
                results['details'].append(f"Matches brand: {brand_data.get('name', bf.stem)} (distance: {distance})")
            elif distance < 20:
                if results['risk_level'] != 'infringing':
                    results['risk_level'] = 'high_risk'
                results['details'].append(f"Similar to brand: {brand_data.get('name', bf.stem)} (distance: {distance})")
        results['checks'].append('brand_hash_compare')

    # 3. Try OCR for text detection (if pytesseract available)
    try:
        import pytesseract
        img = Image.open(image_path)
        text = pytesseract.image_to_string(img)
        if text.strip():
            found_brands = check_brand_keywords(text)
            if found_brands:
                results['risk_level'] = 'high_risk'
                results['details'].append(f"Brand text detected: {', '.join(found_brands)}")
            results['ocr_text'] = text.strip()[:200]
        results['checks'].append('ocr')
    except ImportError:
        results['checks'].append('ocr_skipped')

    # 4. Check filename for brand keywords
    filename = os.path.basename(image_path).lower()
    found_in_name = check_brand_keywords(filename)
    if found_in_name:
        if results['risk_level'] == 'compliant':
            results['risk_level'] = 'high_risk'
        results['details'].append(f"Brand keyword in filename: {', '.join(found_in_name)}")
    results['checks'].append('filename_keywords')

    return results

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(json.dumps({'error': 'Usage: ip_check.py <image_path> [brand_hashes_dir]'}))
        sys.exit(1)
    brand_dir = sys.argv[2] if len(sys.argv) > 2 else None
    try:
        result = check_image(sys.argv[1], brand_dir)
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({'error': str(e)}))
        sys.exit(1)

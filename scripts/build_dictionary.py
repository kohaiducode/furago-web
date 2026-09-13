import os
import gzip
import urllib.request
import json
import re

JMDICT_URL = "http://ftp.edrdg.org/pub/Nihongo/JMdict.gz"
JMDICT_GZ_FILE = "JMdict.gz"
JMDICT_XML_FILE = "JMdict.xml"
OUTPUT_JSON = "www/assets/dict.json"

def map_pos(p):
    p = p.lower().strip()
    if p.startswith('v') or p in ('vt', 'vi', 'vs', 'vk', 'vz', 'vr'):
        return '動詞'
    if p.startswith('adj'):
        return '形容詞'
    if p.startswith('adv'):
        return '副詞'
    if p in ('n', 'n-adv', 'n-t', 'n-pref', 'n-suf', 'pn', 'ctr'):
        return '名詞'
    if p == 'exp':
        return '表現'
    if p == 'int':
        return '間投詞'
    if p in ('conj', 'prt'):
        return '接続詞'
    return '名詞'

def parse_jmdict(xml_file):
    print("Reading JMdict XML...")
    with open(xml_file, 'r', encoding='utf-8') as f:
        xml_content = f.read()
    
    xml_content = re.sub(r'<!DOCTYPE[^>]+>', '', xml_content)
    
    print("Extracting entries...")
    dictionary = {}
    
    entry_pattern = re.compile(r'<entry>(.*?)</entry>', re.DOTALL)
    keb_pattern = re.compile(r'<keb>(.*?)</keb>')
    reb_pattern = re.compile(r'<reb>(.*?)</reb>')
    sense_pattern = re.compile(r'<sense>(.*?)</sense>', re.DOTALL)
    pos_pattern = re.compile(r'<pos>&(.*?);</pos>')
    fre_gloss_pattern = re.compile(r'<gloss xml:lang="fre">(.*?)</gloss>')
    
    count = 0
    for match in entry_pattern.finditer(xml_content):
        entry_xml = match.group(1)
        kebs = keb_pattern.findall(entry_xml)
        rebs = reb_pattern.findall(entry_xml)
        
        # Extract POS at entry level
        raw_pos_list = pos_pattern.findall(entry_xml)
        mapped_pos = list(set([map_pos(p) for p in raw_pos_list]))
        if not mapped_pos:
            mapped_pos = ['名詞']

        senses = sense_pattern.findall(entry_xml)
        
        for sense in senses:
            fre_glosses = fre_gloss_pattern.findall(sense)
            if fre_glosses:
                entry_data = {
                    'k': kebs,
                    'r': rebs,
                    'p': mapped_pos,
                    'g': fre_glosses
                }
                
                for gloss in fre_glosses:
                    clean_gloss = re.sub(r'\(.*?\)', '', gloss).strip().lower()
                    parts = re.split(r'[,;]', clean_gloss)
                    for part in parts:
                        part = part.strip()
                        if not part or len(part) < 2: 
                            continue
                        
                        if part not in dictionary:
                            dictionary[part] = []
                        
                        if entry_data not in dictionary[part]:
                            dictionary[part].append(entry_data)
                            
        count += 1
        if count % 50000 == 0:
            print(f"Processed {count} entries...")

    print(f"Base dictionary built with {len(dictionary)} French keys.")

    # Add plural and feminine aliases to dictionary for nouns & adjectives
    print("Generating common inflections (plurals & feminines)...")
    inflections = {}
    for word, entries in list(dictionary.items()):
        # Only for single words
        if ' ' not in word:
            # Plural: -s
            if not word.endswith('s') and not word.endswith('x') and len(word) > 2:
                plural = word + 's'
                if plural not in dictionary and plural not in inflections:
                    inflections[plural] = entries
            
            # -al -> -aux (e.g. animal -> animaux, journal -> journaux)
            if word.endswith('al') and len(word) > 3:
                plural_aux = word[:-2] + 'aux'
                if plural_aux not in dictionary and plural_aux not in inflections:
                    inflections[plural_aux] = entries

            # -eau -> -eaux (e.g. bateau -> bateaux)
            if word.endswith('eau') and len(word) > 4:
                plural_eaux = word + 'x'
                if plural_eaux not in dictionary and plural_eaux not in inflections:
                    inflections[plural_eaux] = entries

    for k, v in inflections.items():
        if k not in dictionary:
            dictionary[k] = v

    print(f"Total keys after inflections: {len(dictionary)}")
    return dictionary

def main():
    os.makedirs(os.path.dirname(OUTPUT_JSON), exist_ok=True)
    dictionary = parse_jmdict(JMDICT_XML_FILE)
    print("Saving to JSON...")
    with open(OUTPUT_JSON, 'w', encoding='utf-8') as f:
        json.dump(dictionary, f, ensure_ascii=False, separators=(',', ':'))
    print(f"Done! Dictionary saved to {OUTPUT_JSON}. Size: {os.path.getsize(OUTPUT_JSON) / 1024 / 1024:.2f} MB")

if __name__ == "__main__":
    main()

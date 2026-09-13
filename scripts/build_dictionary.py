import os
import gzip
import urllib.request
import xml.etree.ElementTree as ET
import json
import re

JMDICT_URL = "http://ftp.edrdg.org/pub/Nihongo/JMdict.gz"
JMDICT_GZ_FILE = "JMdict.gz"
JMDICT_XML_FILE = "JMdict.xml"
OUTPUT_JSON = "www/assets/dict.json"

def download_file(url, filename):
    print(f"Downloading {url}...")
    urllib.request.urlretrieve(url, filename)
    print("Download complete.")

def extract_gz(gz_file, xml_file):
    print(f"Extracting {gz_file} to {xml_file}...")
    with gzip.open(gz_file, 'rb') as f_in:
        with open(xml_file, 'wb') as f_out:
            f_out.write(f_in.read())
    print("Extraction complete.")

def parse_jmdict(xml_file):
    print("Parsing JMdict XML...")
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
    pos_pattern2 = re.compile(r'<pos>(.*?)</pos>')
    fre_gloss_pattern = re.compile(r'<gloss xml:lang="fre">(.*?)</gloss>')
    
    count = 0
    for match in entry_pattern.finditer(xml_content):
        entry_xml = match.group(1)
        kebs = keb_pattern.findall(entry_xml)
        rebs = reb_pattern.findall(entry_xml)
        senses = sense_pattern.findall(entry_xml)
        
        for sense in senses:
            fre_glosses = fre_gloss_pattern.findall(sense)
            if fre_glosses:
                pos_list = pos_pattern.findall(sense)
                if not pos_list:
                    pos_list = pos_pattern2.findall(sense)
                
                entry_data = {
                    'k': kebs,
                    'r': rebs,
                    'p': pos_list,
                    'g': fre_glosses
                }
                
                for gloss in fre_glosses:
                    clean_gloss = re.sub(r'\(.*?\)', '', gloss).strip().lower()
                    parts = re.split(r'[,;]', clean_gloss)
                    for part in parts:
                        part = part.strip()
                        if not part: continue
                        
                        if part not in dictionary:
                            dictionary[part] = []
                        
                        if entry_data not in dictionary[part]:
                            dictionary[part].append(entry_data)
                            
        count += 1
        if count % 20000 == 0:
            print(f"Processed {count} entries...")

    print(f"Dictionary built with {len(dictionary)} French keys.")
    return dictionary

def main():
    os.makedirs(os.path.dirname(OUTPUT_JSON), exist_ok=True)
    if not os.path.exists(JMDICT_XML_FILE):
        if not os.path.exists(JMDICT_GZ_FILE):
            download_file(JMDICT_URL, JMDICT_GZ_FILE)
        extract_gz(JMDICT_GZ_FILE, JMDICT_XML_FILE)
    dictionary = parse_jmdict(JMDICT_XML_FILE)
    print("Saving to JSON...")
    with open(OUTPUT_JSON, 'w', encoding='utf-8') as f:
        json.dump(dictionary, f, ensure_ascii=False, separators=(',', ':'))
    print(f"Done! Dictionary saved to {OUTPUT_JSON}. Size: {os.path.getsize(OUTPUT_JSON) / 1024 / 1024:.2f} MB")

if __name__ == "__main__":
    main()

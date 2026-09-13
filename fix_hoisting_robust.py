import re

def fix_hoisting_robust():
    with open('www/app.js', 'r', encoding='utf-8') as f:
        js = f.read()

    # Find the start
    start_str = "// 0. DICTIONARY SERVICE"
    start_idx = js.find(start_str)
    
    # We must find the line containing this to get the full block
    start_idx = js.rfind("// ---", 0, start_idx) 
    
    dict_start = js.find("const DictionaryService = {", start_idx)
    
    brace_count = 0
    in_block = False
    end_idx = -1
    
    for i in range(dict_start, len(js)):
        if js[i] == '{':
            in_block = True
            brace_count += 1
        elif js[i] == '}':
            brace_count -= 1
            if in_block and brace_count == 0:
                end_idx = i + 1
                break
                
    if js[end_idx] == ';':
        end_idx += 1
        
    block = js[start_idx:end_idx]
    
    # Remove block
    js = js[:start_idx] + js[end_idx:]
    
    # Put block right after imports/constants at the top
    # The first line is `const DATA_URL = ...`
    insert_idx = js.find("const DATA_URL")
    if insert_idx == -1:
        insert_idx = 0
        
    js = js[:insert_idx] + block + "\n\n" + js[insert_idx:]
    
    with open('www/app.js', 'w', encoding='utf-8') as f:
        f.write(js)

fix_hoisting_robust()

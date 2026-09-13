import re

def move_dict_service():
    with open('www/app.js', 'r', encoding='utf-8') as f:
        js = f.read()

    # Find the DictionaryService block
    start_str = "// -----------------------------------------------------\n// 0. DICTIONARY SERVICE (OFFLINE)"
    end_str = "};\n// --- GESTION DU CLIC / TAP SIMPLE SUR UN MOT ---"
    
    start_idx = js.find(start_str)
    end_idx = js.find("};\n", js.find("async function lookupWord(word, surroundingSentence)", start_idx))
    
    if start_idx == -1 or end_idx == -1:
        print("Could not find block!")
        return

    # Extract the block
    # The end of the block is the closing brace of DictionaryService.
    # We can just use string parsing to find the exact block.
    
    brace_count = 0
    in_block = False
    actual_end_idx = -1
    
    dict_start = js.find("const DictionaryService = {", start_idx)
    for i in range(dict_start, len(js)):
        if js[i] == '{':
            in_block = True
            brace_count += 1
        elif js[i] == '}':
            brace_count -= 1
            if in_block and brace_count == 0:
                actual_end_idx = i + 1 # Include the brace
                break
                
    if actual_end_idx != -1:
        # Check if there is a semicolon
        if js[actual_end_idx] == ';':
            actual_end_idx += 1
            
    block = js[start_idx:actual_end_idx]
    
    # Remove block from current position
    js = js[:start_idx] + js[actual_end_idx:]
    
    # Put block at the very top
    js = block + "\n\n" + js
    
    with open('www/app.js', 'w', encoding='utf-8') as f:
        f.write(js)

move_dict_service()

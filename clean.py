import re

def clean():
    # 1. Clean app.js
    with open('www/app.js', 'r', encoding='utf-8') as f:
        app = f.read()
    
    if app.startswith("try {\n"):
        app = app[6:]
    
    # Remove the catch block at the bottom
    catch_block = """} catch(err) {
  console.error('REAL ERROR:', err.message, err.stack); alert('REAL ERROR: ' + err.message + '\\n' + err.stack);
}"""
    app = app.replace(catch_block, "")
    
    with open('www/app.js', 'w', encoding='utf-8') as f:
        f.write(app)
        
    # 2. Clean index.html
    with open('www/index.html', 'r', encoding='utf-8') as f:
        html = f.read()
        
    script_block = """<script>
window.onerror = function(msg, url, line, col, error) {
    alert("GLOBAL ERROR: " + msg + " at line " + line);
};
window.addEventListener("unhandledrejection", function(e) {
    alert("PROMISE REJECTION: " + (e.reason && e.reason.message ? e.reason.message : e.reason));
});
</script>
"""
    html = html.replace(script_block, "")
    
    with open('www/index.html', 'w', encoding='utf-8') as f:
        f.write(html)

clean()

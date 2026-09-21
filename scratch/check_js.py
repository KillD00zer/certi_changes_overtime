import sys

files = [
    'extension/sidepanel/panel.js',
    'extension/preview/preview.js',
    'extension/scripts/background.js',
    'extension/scripts/docx_builder.js',
    'extension/scripts/geo_engine.js',
    'extension/scripts/content_script.js'
]
for f in files:
    content = open(f, encoding='utf-8').read()
    stack = []
    pairs = {')': '(', '}': '{', ']': '['}
    line = 1
    col = 1
    in_str = None
    in_comm_line = False
    in_comm_block = False
    i = 0
    err = None
    while i < len(content):
        c = content[i]
        nxt = content[i+1] if i+1 < len(content) else ''
        if c == '\n':
            line += 1
            col = 1
            in_comm_line = False
            i += 1
            continue
        if in_comm_line:
            i += 1
            col += 1
            continue
        if in_comm_block:
            if c == '*' and nxt == '/':
                in_comm_block = False
                i += 2
                col += 2
                continue
            i += 1
            col += 1
            continue
        if in_str:
            if c == '\\':
                i += 2
                col += 2
                continue
            if c == in_str:
                in_str = None
            i += 1
            col += 1
            continue
        if c in ('"', "'", '`'):
            in_str = c
            i += 1
            col += 1
            continue
        if c == '/' and nxt == '/':
            in_comm_line = True
            i += 2
            col += 2
            continue
        if c == '/' and nxt == '*':
            in_comm_block = True
            i += 2
            col += 2
            continue
        if c in '({[':
            stack.append((c, line, col))
        elif c in ')}]':
            expected = pairs[c]
            if not stack:
                err = f'Unexpected {c} at {line}:{col}'
                break
            top, tl, tc = stack.pop()
            if top != expected:
                err = f'Mismatched {c} at {line}:{col}, expected matching for {top} from {tl}:{tc}'
                break
        i += 1
        col += 1
    if not err and stack:
        top, tl, tc = stack.pop()
        err = f'Unclosed {top} from {tl}:{tc}'
    print(f'{f}: {err if err else "VALID"}')

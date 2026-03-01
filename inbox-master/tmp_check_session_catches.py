from pathlib import Path
path = Path('inboxreya/src/lib/session.ts')
lines = path.read_text(encoding='utf-8').splitlines()
results = []
for idx, line in enumerate(lines):
    stripped = line.strip()
    if stripped.startswith('} catch'):
        block_lines = []
        depth = 1
        j = idx + 1
        while j < len(lines) and depth > 0:
            l = lines[j]
            block_lines.append(l.strip())
            if '{' in l:
                depth += l.count('{')
            if '}' in l:
                depth -= l.count('}')
            j += 1
        if not any('console.' in bl for bl in block_lines):
            results.append((idx + 1, stripped))
print('\n'.join(f"{line}: {text}" for line, text in results))

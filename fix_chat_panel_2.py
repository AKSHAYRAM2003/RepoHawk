import re

with open('frontend/src/components/dashboard/QAChatPanel.tsx', 'r') as f:
    content = f.read()

replacements = [
    (r'"#1e293b"', '"var(--on-surface-variant)"'),
    (r'"#475569"', '"var(--on-surface-variant)"'),
    (r'"#64748b"', '"var(--on-surface-variant)"'),
    (r'"#334155"', '"var(--on-surface-variant)"'),
    (r'"#6366f1"', '"var(--primary)"'),
    (r'"#818cf8"', '"color-mix(in srgb, var(--primary) 80%, white)"'),
    (r'"#a5b4fc"', '"color-mix(in srgb, var(--primary) 60%, white)"'),
    (r'"#c7d2fe"', '"color-mix(in srgb, var(--primary) 40%, white)"'),
]

for old, new in replacements:
    content = re.sub(old, new, content)

with open('frontend/src/components/dashboard/QAChatPanel.tsx', 'w') as f:
    f.write(content)

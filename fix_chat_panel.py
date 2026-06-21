import re

with open('frontend/src/components/dashboard/QAChatPanel.tsx', 'r') as f:
    content = f.read()

# Replace hardcoded dark mode colors with theme variables
replacements = [
    (r'color:\s*"#f1f5f9"', 'color: "var(--on-surface)"'),
    (r'color:\s*"#e2e8f0"', 'color: "var(--on-surface)"'),
    (r'color:\s*"#f8fafc"', 'color: "var(--on-surface)"'),
    (r'color:\s*"#cbd5e1"', 'color: "var(--on-surface-variant)"'),
    (r'color:\s*"#64748b"', 'color: "var(--on-surface-variant)"'),
    (r'color:\s*"#475569"', 'color: "var(--on-surface-variant)"'),
    (r'color:\s*"#334155"', 'color: "var(--on-surface-variant)"'),
    (r'color:\s*"#1e293b"', 'color: "var(--on-surface-variant)"'),
    (r'color:\s*"#a5b4fc"', 'color: "var(--primary)"'),
    (r'color:\s*"#818cf8"', 'color: "var(--primary)"'),
    (r'color:\s*"#6366f1"', 'color: "var(--primary)"'),
    (r'color:\s*"#c7d2fe"', 'color: "var(--primary)"'),
    
    (r'background:\s*"rgba\(99,102,241,0.15\)"', 'background: "color-mix(in srgb, var(--primary) 15%, transparent)"'),
    (r'background:\s*"rgba\(99,102,241,0.1\)"', 'background: "color-mix(in srgb, var(--primary) 10%, transparent)"'),
    (r'background:\s*"rgba\(99,102,241,0.22\)"', 'background: "color-mix(in srgb, var(--primary) 22%, transparent)"'),
    (r'background:\s*"rgba\(99,102,241,0.18\)"', 'background: "color-mix(in srgb, var(--primary) 18%, transparent)"'),
    (r'background:\s*"rgba\(99,102,241,0.3\)"', 'background: "color-mix(in srgb, var(--primary) 30%, transparent)"'),
    (r'background:\s*"rgba\(99,102,241,0.08\)"', 'background: "color-mix(in srgb, var(--primary) 8%, transparent)"'),
    (r'background:\s*"rgba\(99,102,241,0.9\)"', 'background: "var(--primary)"'),
    (r'background:\s*"rgba\(99,102,241,1\)"', 'background: "var(--primary)"'),
    
    (r'background:\s*"rgba\(5,6,12,0.85\)"', 'background: "var(--surface-container-highest)"'),
    (r'background:\s*"rgba\(12,14,22,0.85\)"', 'background: "var(--surface-container-high)"'),
    (r'background:\s*"rgba\(6,7,14,0.7\)"', 'background: "color-mix(in srgb, var(--surface-container) 70%, transparent)"'),
    (r'background:\s*"rgba\(14,16,26,0.95\)"', 'background: "var(--surface-container-highest)"'),
    (r'background:\s*"rgba\(8,9,14,0.98\)"', 'background: "var(--surface-container-high)"'),
    (r'background:\s*"rgba\(255,255,255,0.02\)"', 'background: "color-mix(in srgb, var(--on-surface) 5%, transparent)"'),
    (r'background:\s*"rgba\(255,255,255,0.03\)"', 'background: "color-mix(in srgb, var(--on-surface) 5%, transparent)"'),
    (r'background:\s*"rgba\(255,255,255,0.05\)"', 'background: "color-mix(in srgb, var(--on-surface) 10%, transparent)"'),
    
    (r'border:\s*"1px solid rgba\(255,255,255,0.06\)"', 'border: "1px solid var(--outline-variant)"'),
    (r'border:\s*"1px solid rgba\(255,255,255,0.04\)"', 'border: "1px solid var(--outline-variant)"'),
    (r'border:\s*"1px solid rgba\(255,255,255,0.07\)"', 'border: "1px solid var(--outline-variant)"'),
    (r'border:\s*"1px solid rgba\(255,255,255,0.08\)"', 'border: "1px solid var(--outline-variant)"'),
    (r'borderBottom:\s*"1px solid rgba\(255,255,255,0.04\)"', 'borderBottom: "1px solid var(--outline-variant)"'),
    (r'borderTop:\s*"1px solid rgba\(255,255,255,0.04\)"', 'borderTop: "1px solid var(--outline-variant)"'),
    
    (r'border:\s*"1px solid rgba\(99,102,241,0.22\)"', 'border: "1px solid color-mix(in srgb, var(--primary) 22%, transparent)"'),
    (r'border:\s*"1px solid rgba\(99,102,241,0.28\)"', 'border: "1px solid color-mix(in srgb, var(--primary) 28%, transparent)"'),
    (r'border:\s*"1px solid rgba\(99,102,241,0.3\)"', 'border: "1px solid color-mix(in srgb, var(--primary) 30%, transparent)"'),
    (r'border:\s*"1px solid rgba\(99,102,241,0.38\)"', 'border: "1px solid color-mix(in srgb, var(--primary) 38%, transparent)"'),
    (r'border:\s*"1px solid rgba\(99,102,241,0.4\)"', 'border: "1px solid color-mix(in srgb, var(--primary) 40%, transparent)"'),
    (r'borderColor:\s*"rgba\(99,102,241,0.5\)"', 'borderColor: "color-mix(in srgb, var(--primary) 50%, transparent)"'),
    (r'borderColor:\s*"rgba\(99,102,241,0.22\)"', 'borderColor: "color-mix(in srgb, var(--primary) 22%, transparent)"'),
    (r'borderColor:\s*"rgba\(255,255,255,0.07\)"', 'borderColor: "var(--outline-variant)"'),

    (r'background:\s*"linear-gradient\(135deg, rgba\(99,102,241,0.22\), rgba\(139,92,246,0.15\)\)"', 'background: "linear-gradient(135deg, color-mix(in srgb, var(--primary) 22%, transparent), color-mix(in srgb, var(--secondary) 15%, transparent))"'),
    (r'background:\s*"linear-gradient\(135deg, rgba\(99,102,241,0.28\), rgba\(139,92,246,0.14\)\)"', 'background: "linear-gradient(135deg, color-mix(in srgb, var(--primary) 28%, transparent), color-mix(in srgb, var(--secondary) 14%, transparent))"'),
    
    (r'boxShadow:\s*"0 0 28px rgba\(99,102,241,0.2\)"', 'boxShadow: "0 0 28px color-mix(in srgb, var(--primary) 20%, transparent)"'),
    (r'boxShadow:\s*"0 0 12px rgba\(99,102,241,0.4\)"', 'boxShadow: "0 0 12px color-mix(in srgb, var(--primary) 40%, transparent)"'),
    
    (r'fill="#fff"', 'fill="currentColor"'),
]

for old, new in replacements:
    content = re.sub(old, new, content)

# Also fix the buttons:
# Add type="button" to stopGeneration and sendMessage
content = content.replace(
    'onClick={stopGeneration}',
    'type="button"\n                  onClick={(e) => { e.preventDefault(); stopGeneration(); }}'
)

content = content.replace(
    'onClick={() => sendMessage(input)}',
    'type="button"\n                  onClick={(e) => { e.preventDefault(); sendMessage(input); }}'
)

# And in the suggestion chips:
content = content.replace(
    'onClick={() => sendMessage(s)}',
    'type="button"\n                  onClick={(e) => { e.preventDefault(); sendMessage(s); }}'
)

with open('frontend/src/components/dashboard/QAChatPanel.tsx', 'w') as f:
    f.write(content)


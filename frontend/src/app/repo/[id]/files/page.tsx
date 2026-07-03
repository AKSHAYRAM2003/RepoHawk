'use client';

import React, {
  useState, useEffect, useMemo, useCallback, useRef,
} from 'react';
import { Light as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomOneDark } from 'react-syntax-highlighter/dist/esm/styles/hljs';
import { atomOneLight } from 'react-syntax-highlighter/dist/esm/styles/hljs';

// Register languages
import ts   from 'react-syntax-highlighter/dist/esm/languages/hljs/typescript';
import js   from 'react-syntax-highlighter/dist/esm/languages/hljs/javascript';
import py   from 'react-syntax-highlighter/dist/esm/languages/hljs/python';
import go   from 'react-syntax-highlighter/dist/esm/languages/hljs/go';
import rs   from 'react-syntax-highlighter/dist/esm/languages/hljs/rust';
import java from 'react-syntax-highlighter/dist/esm/languages/hljs/java';
import cpp  from 'react-syntax-highlighter/dist/esm/languages/hljs/cpp';
import cs   from 'react-syntax-highlighter/dist/esm/languages/hljs/csharp';
import rb   from 'react-syntax-highlighter/dist/esm/languages/hljs/ruby';
import php  from 'react-syntax-highlighter/dist/esm/languages/hljs/php';
import swift   from 'react-syntax-highlighter/dist/esm/languages/hljs/swift';
import kotlin  from 'react-syntax-highlighter/dist/esm/languages/hljs/kotlin';
import md   from 'react-syntax-highlighter/dist/esm/languages/hljs/markdown';
import json from 'react-syntax-highlighter/dist/esm/languages/hljs/json';
import yaml from 'react-syntax-highlighter/dist/esm/languages/hljs/yaml';
import bash from 'react-syntax-highlighter/dist/esm/languages/hljs/bash';
import html from 'react-syntax-highlighter/dist/esm/languages/hljs/xml';
import css  from 'react-syntax-highlighter/dist/esm/languages/hljs/css';
import scss from 'react-syntax-highlighter/dist/esm/languages/hljs/scss';
import sql  from 'react-syntax-highlighter/dist/esm/languages/hljs/sql';
import dockerfile from 'react-syntax-highlighter/dist/esm/languages/hljs/dockerfile';
import xml  from 'react-syntax-highlighter/dist/esm/languages/hljs/xml';

SyntaxHighlighter.registerLanguage('typescript', ts);
SyntaxHighlighter.registerLanguage('javascript', js);
SyntaxHighlighter.registerLanguage('python', py);
SyntaxHighlighter.registerLanguage('go', go);
SyntaxHighlighter.registerLanguage('rust', rs);
SyntaxHighlighter.registerLanguage('java', java);
SyntaxHighlighter.registerLanguage('cpp', cpp);
SyntaxHighlighter.registerLanguage('csharp', cs);
SyntaxHighlighter.registerLanguage('ruby', rb);
SyntaxHighlighter.registerLanguage('php', php);
SyntaxHighlighter.registerLanguage('swift', swift);
SyntaxHighlighter.registerLanguage('kotlin', kotlin);
SyntaxHighlighter.registerLanguage('markdown', md);
SyntaxHighlighter.registerLanguage('json', json);
SyntaxHighlighter.registerLanguage('yaml', yaml);
SyntaxHighlighter.registerLanguage('bash', bash);
SyntaxHighlighter.registerLanguage('html', html);
SyntaxHighlighter.registerLanguage('css', css);
SyntaxHighlighter.registerLanguage('scss', scss);
SyntaxHighlighter.registerLanguage('sql', sql);
SyntaxHighlighter.registerLanguage('dockerfile', dockerfile);
SyntaxHighlighter.registerLanguage('xml', xml);

// ─── Language helpers ─────────────────────────────────────────────────────────

const EXT_LANG: Record<string, string> = {
  '.ts': 'typescript',  '.tsx': 'typescript',
  '.js': 'javascript',  '.jsx': 'javascript', '.mjs': 'javascript', '.cjs': 'javascript',
  '.py': 'python',      '.go': 'go',     '.rs': 'rust',
  '.java': 'java',      '.cpp': 'cpp',   '.cc': 'cpp', '.cxx': 'cpp',
  '.c': 'cpp',          '.h': 'cpp',     '.hpp': 'cpp',
  '.cs': 'csharp',      '.rb': 'ruby',   '.php': 'php',
  '.swift': 'swift',    '.kt': 'kotlin', '.kts': 'kotlin',
  '.md': 'markdown',    '.mdx': 'markdown',
  '.json': 'json',      '.yaml': 'yaml', '.yml': 'yaml', '.toml': 'yaml',
  '.sh': 'bash',        '.bash': 'bash', '.zsh': 'bash',
  '.html': 'html',      '.htm': 'html',  '.vue': 'html',
  '.css': 'css',        '.scss': 'scss', '.sass': 'scss', '.less': 'scss',
  '.sql': 'sql',        '.xml': 'xml',   '.svg': 'xml',
  '.proto': 'bash',     '.graphql': 'bash', '.gql': 'bash',
};

function getLang(path: string): string {
  const lower = path.toLowerCase();
  if (lower.endsWith('dockerfile') || lower.split('/').pop() === 'dockerfile') return 'dockerfile';
  const dot = lower.lastIndexOf('.');
  return dot === -1 ? 'bash' : (EXT_LANG[lower.slice(dot)] ?? 'bash');
}

const LANG_COLOR: Record<string, string> = {
  typescript: '#818cf8', javascript: '#facc15', python: '#60a5fa',
  go: '#22d3ee',        rust: '#fb923c',        java: '#f87171',
  bash: '#4ade80',      markdown: '#a3a3a3',    json: '#fbbf24',
  yaml: '#c084fc',      css: '#38bdf8',         html: '#fb923c',
  sql: '#f472b6',       dockerfile: '#34d399',  cpp: '#a78bfa',
  csharp: '#60a5fa',    ruby: '#f87171',        swift: '#fb923c',
  kotlin: '#a78bfa',    scss: '#f472b6',        xml: '#94a3b8',
};
function langColor(lang: string) { return LANG_COLOR[lang] ?? '#94a3b8'; }

function formatBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

function fileType(path: string, lang: string): string {
  const name = path.split('/').pop() ?? '';
  if (lang === 'typescript' && name.endsWith('.tsx')) return 'React Component (TSX)';
  if (lang === 'typescript') return 'TypeScript Module';
  if (lang === 'javascript' && name.endsWith('.jsx')) return 'React Component (JSX)';
  if (lang === 'javascript') return 'JavaScript Module';
  if (lang === 'python') return 'Python Module';
  if (lang === 'go') return 'Go Source';
  if (lang === 'rust') return 'Rust Source';
  if (lang === 'java') return 'Java Class';
  if (lang === 'json') return 'JSON Config';
  if (lang === 'yaml') return 'YAML Config';
  if (lang === 'markdown') return 'Markdown Document';
  if (lang === 'css' || lang === 'scss') return 'Stylesheet';
  if (lang === 'sql') return 'SQL Script';
  if (lang === 'dockerfile') return 'Dockerfile';
  return lang.charAt(0).toUpperCase() + lang.slice(1) + ' File';
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface FileInfo { path: string; language: string; chunk_count: number; }

interface OpenFile extends FileInfo {
  content?: string;
  size_bytes?: number;
  lines?: number;
  loading?: boolean;
  error?: string;
}

// ─── File tree builder ────────────────────────────────────────────────────────

type TreeNode =
  | { kind: 'file'; name: string; file: FileInfo }
  | { kind: 'dir';  name: string; children: TreeNode[] };

function buildTree(files: FileInfo[]): TreeNode[] {
  const treeMap: Record<string, unknown> = {};
  for (const f of files) {
    const parts = f.path.split('/');
    let cur: Record<string, unknown> = treeMap;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!cur[parts[i]]) cur[parts[i]] = { __c: {} };
      cur = (cur[parts[i]] as Record<string, unknown>).__c as Record<string, unknown>;
    }
    cur[parts[parts.length - 1]] = { __f: f };
  }

  function toNodes(map: Record<string, unknown>): TreeNode[] {
    return Object.keys(map)
      .sort((a, b) => {
        const aDir = !(map[a] as Record<string, unknown>).__f;
        const bDir = !(map[b] as Record<string, unknown>).__f;
        if (aDir && !bDir) return -1;
        if (!aDir && bDir) return 1;
        return a.localeCompare(b);
      })
      .map(k => {
        const v = map[k] as Record<string, unknown>;
        if (v.__f) return { kind: 'file' as const, name: k, file: v.__f as FileInfo };
        return { kind: 'dir' as const, name: k, children: toNodes(v.__c as Record<string, unknown>) };
      });
  }

  return toNodes(treeMap);
}

// ─── SVG file-type icons ──────────────────────────────────────────────────────

function FileIcon({ lang, size = 13 }: { lang: string; size?: number }) {
  const color = langColor(lang);
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <rect x="2" y="1" width="9" height="13" rx="1.5" fill={color + '22'} stroke={color} strokeWidth="1"/>
      <path d="M8 1v4h4" stroke={color} strokeWidth="1" fill="none"/>
      <line x1="4" y1="8"  x2="10" y2="8"  stroke={color} strokeWidth="0.8"/>
      <line x1="4" y1="10" x2="9"  y2="10" stroke={color} strokeWidth="0.8"/>
      <line x1="4" y1="12" x2="8"  y2="12" stroke={color} strokeWidth="0.8"/>
    </svg>
  );
}

function FolderIcon({ open, size = 13 }: { open: boolean; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      {open ? (
        <>
          <path d="M1 4.5C1 3.67 1.67 3 2.5 3H6l1.5 2H14a1.5 1.5 0 011.5 1.5v6A1.5 1.5 0 0114 14H2.5A1.5 1.5 0 011 12.5V4.5z" fill="var(--folder-fill,#3b82f6)" fillOpacity="0.25" stroke="var(--folder-fill,#3b82f6)" strokeWidth="0.8"/>
        </>
      ) : (
        <>
          <path d="M1 4.5C1 3.67 1.67 3 2.5 3H6l1.5 2H13.5A1.5 1.5 0 0115 6.5v6A1.5 1.5 0 0113.5 14h-11A1.5 1.5 0 011 12.5V4.5z" fill="var(--folder-fill,#3b82f6)" fillOpacity="0.18" stroke="var(--folder-fill,#3b82f6)" strokeWidth="0.8"/>
        </>
      )}
    </svg>
  );
}

// ─── TreeNode Row ─────────────────────────────────────────────────────────────

function TreeNodeRow({
  node, depth, activePath, onSelect,
}: {
  node: TreeNode; depth: number; activePath: string | null;
  onSelect: (f: FileInfo) => void;
}) {
  const [open, setOpen] = useState(depth < 2);
  const indent = 8 + depth * 16;

  if (node.kind === 'file') {
    const lang = getLang(node.file.path);
    const accent = langColor(lang);
    const isActive = activePath === node.file.path;
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={() => onSelect(node.file)}
        onKeyDown={e => e.key === 'Enter' && onSelect(node.file)}
        className="group"
        style={{
          display: 'flex', alignItems: 'center', gap: 7,
          paddingLeft: indent, paddingRight: 10,
          height: 28, cursor: 'pointer', borderRadius: 6,
          margin: '1px 6px',
          background: isActive
            ? `color-mix(in srgb, ${accent} 12%, var(--surface-container-high))`
            : 'transparent',
          borderLeft: `2px solid ${isActive ? accent : 'transparent'}`,
          transition: 'background 0.12s, border-color 0.12s',
        }}
        onMouseEnter={e => {
          if (!isActive) (e.currentTarget as HTMLDivElement).style.background = 'color-mix(in srgb, var(--on-surface) 5%, transparent)';
        }}
        onMouseLeave={e => {
          if (!isActive) (e.currentTarget as HTMLDivElement).style.background = 'transparent';
        }}
      >
        <FileIcon lang={lang} />
        <span style={{
          fontSize: 12.5, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          color: isActive ? accent : 'var(--on-surface-variant)',
          fontWeight: isActive ? 600 : 400,
        }}>
          {node.name}
        </span>
        {node.file.chunk_count > 0 && (
          <span style={{ fontSize: 9, color: 'var(--outline)', fontFamily: 'monospace', flexShrink: 0 }}>
            {node.file.chunk_count}
          </span>
        )}
      </div>
    );
  }

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen(o => !o)}
        onKeyDown={e => e.key === 'Enter' && setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 7,
          paddingLeft: indent, paddingRight: 10,
          height: 28, cursor: 'pointer', borderRadius: 6,
          margin: '1px 6px',
          userSelect: 'none',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'color-mix(in srgb, var(--on-surface) 5%, transparent)'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="var(--on-surface-variant)" style={{ flexShrink: 0, transition: 'transform 0.15s', transform: open ? 'rotate(0deg)' : 'rotate(-90deg)' }}>
          <path d="M1 3l4 4 4-4" stroke="var(--on-surface-variant)" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <FolderIcon open={open} />
        <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--on-surface)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {node.name}
        </span>
        <span style={{ fontSize: 9, color: 'var(--outline)', fontFamily: 'monospace', flexShrink: 0 }}>
          {node.children.length}
        </span>
      </div>
      {open && (
        <div>
          {node.children.map(c => (
            <TreeNodeRow key={c.kind === 'file' ? c.file.path : c.name + depth} node={c} depth={depth + 1} activePath={activePath} onSelect={onSelect} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Tab bar ──────────────────────────────────────────────────────────────────

function TabBar({
  tabs, activePath, onSelect, onClose,
}: {
  tabs: OpenFile[]; activePath: string | null;
  onSelect: (p: string) => void; onClose: (p: string) => void;
}) {
  if (!tabs.length) return null;
  return (
    <div style={{
      display: 'flex', alignItems: 'center',
      background: 'var(--surface-container-low)',
      borderBottom: '1px solid var(--outline-variant)',
      overflowX: 'auto', flexShrink: 0, minHeight: 38,
      scrollbarWidth: 'none',
    }}>
      {tabs.map(f => {
        const isActive = f.path === activePath;
        const lang = getLang(f.path);
        const accent = langColor(lang);
        const name = f.path.split('/').pop() ?? f.path;
        return (
          <div
            key={f.path}
            onClick={() => onSelect(f.path)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '0 14px', height: 38, flexShrink: 0,
              cursor: 'pointer', userSelect: 'none',
              borderRight: '1px solid var(--outline-variant)',
              borderBottom: `2px solid ${isActive ? accent : 'transparent'}`,
              background: isActive ? 'var(--surface-container)' : 'transparent',
              transition: 'background 0.12s',
            }}
            onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLDivElement).style.background = 'color-mix(in srgb, var(--on-surface) 5%, transparent)'; }}
            onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
          >
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: accent, flexShrink: 0, opacity: isActive ? 1 : 0.45 }} />
            <span style={{ fontSize: 12, color: isActive ? 'var(--on-surface)' : 'var(--on-surface-variant)', whiteSpace: 'nowrap' }}>
              {name}
            </span>
            {f.loading && <span style={{ fontSize: 10, color: accent }}>•</span>}
            <button
              onClick={e => { e.stopPropagation(); onClose(f.path); }}
              style={{
                background: 'none', border: 'none', color: 'var(--outline)',
                cursor: 'pointer', fontSize: 15, lineHeight: 1, padding: '1px 2px',
                borderRadius: 3, display: 'flex', alignItems: 'center',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--on-surface)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--outline)'; }}
            >×</button>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SourceFilesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params);

  const [files, setFiles] = useState<FileInfo[]>([]);
  const [apiStatus, setApiStatus] = useState<'loading' | 'ready' | 'error' | 'incomplete'>('loading');
  const [total, setTotal] = useState(0);

  const [search, setSearch]       = useState('');
  const [langFilter, setLangFilter] = useState('all');

  const [openTabs, setOpenTabs]   = useState<OpenFile[]>([]);
  const openTabsRef = useRef<OpenFile[]>([]);
  useEffect(() => { openTabsRef.current = openTabs; }, [openTabs]);
  const inflightRef = useRef<Set<string>>(new Set()); // tracks paths currently being fetched
  const [activePath, setActivePath] = useState<string | null>(null);

  // Dark mode detection
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    const check = () => setIsDark(document.documentElement.classList.contains('dark'));
    check();
    const obs = new MutationObserver(check);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);

  // Sidebar resize
  const [sidebarW, setSidebarW] = useState(264);
  const dragRef = useRef(false);
  const startXRef = useRef(0);
  const startWRef = useRef(264);
  const onHandleMouseDown = useCallback((e: React.MouseEvent) => {
    dragRef.current = true; startXRef.current = e.clientX; startWRef.current = sidebarW;
    e.preventDefault();
  }, [sidebarW]);
  useEffect(() => {
    const move = (e: MouseEvent) => {
      if (!dragRef.current) return;
      setSidebarW(Math.max(180, Math.min(480, startWRef.current + e.clientX - startXRef.current)));
    };
    const up = () => { dragRef.current = false; };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
  }, []);

  // Load file list
  useEffect(() => {
    fetch(`/api/repos/${id}/files`)
      .then(r => r.json())
      .then(d => {
        if (d.status === 'complete') {
          setFiles(d.files ?? []);
          setTotal(d.total ?? 0);
          setApiStatus('ready');
        } else {
          setApiStatus('incomplete');
        }
      })
      .catch(() => setApiStatus('error'));
  }, [id]);

  // Notify PropertiesPanel of the active file
  const notifyProperties = useCallback((file: OpenFile | null) => {
    if (!file) {
      window.dispatchEvent(new CustomEvent('repohawk-node-selected', { detail: { node: null } }));
      return;
    }
    const lang = getLang(file.path);
    window.dispatchEvent(new CustomEvent('repohawk-node-selected', {
      detail: {
        node: {
          id: file.path,
          data: {
            label: file.path.split('/').pop() ?? file.path,
            type: 'file',
            layer: file.path.includes('/') ? file.path.split('/').slice(0, -1).join('/') : '(root)',
            description: fileType(file.path, lang),
            tech: lang,
            // Extra metadata stored in group so we can show it
            group: [
              `Language: ${lang}`,
              file.lines ? `Lines: ${file.lines.toLocaleString()}` : '',
              file.size_bytes != null ? `Size: ${formatBytes(file.size_bytes)}` : '',
              `Chunks: ${file.chunk_count}`,
            ].filter(Boolean).join(' · '),
          },
        },
      },
    }));
  }, []);

  // Open a file — uses openTabsRef + inflightRef to prevent double-fetch
  const openFile = useCallback(async (f: FileInfo) => {
    setActivePath(f.path);

    // Already fully loaded? Just switch to it.
    const existing = openTabsRef.current.find(t => t.path === f.path);
    if (existing && existing.content !== undefined) {
      notifyProperties(existing);
      return;
    }

    // Already being fetched? Just add/switch tab, don't double-fetch.
    if (inflightRef.current.has(f.path)) {
      setOpenTabs(prev => prev.find(t => t.path === f.path) ? prev : [...prev, { ...f, loading: true }]);
      return;
    }

    // Add tab in loading state
    setOpenTabs(prev => prev.find(t => t.path === f.path) ? prev : [...prev, { ...f, loading: true }]);
    inflightRef.current.add(f.path);

    try {
      const res = await fetch(`/api/repos/${id}/file?path=${encodeURIComponent(f.path)}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
        const errMsg = err.detail ?? `HTTP ${res.status}`;
        setOpenTabs(prev => prev.map(t => t.path === f.path ? { ...t, loading: false, error: errMsg } : t));
        return;
      }
      const data = await res.json();
      const loaded: OpenFile = {
        ...f, loading: false,
        content: data.content ?? '',
        size_bytes: data.size_bytes,
        lines: data.lines,
      };
      setOpenTabs(prev => prev.map(t => t.path === f.path ? loaded : t));
      notifyProperties(loaded);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Network error';
      setOpenTabs(prev => prev.map(t => t.path === f.path ? { ...t, loading: false, error: msg } : t));
    } finally {
      inflightRef.current.delete(f.path);
    }
  }, [id, notifyProperties]);

  const closeTab = useCallback((path: string) => {
    setOpenTabs(prev => {
      const next = prev.filter(t => t.path !== path);
      if (activePath === path) {
        const newActive = next.length ? next[next.length - 1] : null;
        setActivePath(newActive ? newActive.path : null);
        notifyProperties(newActive ?? null);
      }
      return next;
    });
  }, [activePath, notifyProperties]);

  // Filtered files + tree
  const filteredFiles = useMemo(() =>
    files.filter(f => {
      const matchLang   = langFilter === 'all' || f.language === langFilter;
      const matchSearch = !search || f.path.toLowerCase().includes(search.toLowerCase());
      return matchLang && matchSearch;
    }),
  [files, search, langFilter]);

  const tree      = useMemo(() => buildTree(filteredFiles), [filteredFiles]);
  const languages = useMemo(() => [...new Set(files.map(f => f.language))].sort(), [files]);

  const activeFile = openTabs.find(t => t.path === activePath) ?? null;
  const activeLang = activeFile ? getLang(activeFile.path) : 'bash';
  const accent     = langColor(activeLang);

  // ── Loading states ─────────────────────────────────────────────────────────
  if (apiStatus === 'loading') return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', gap:12, flexDirection:'column' }}>
      <div style={{ width:22, height:22, border:'2px solid var(--primary)', borderTopColor:'transparent', borderRadius:'50%', animation:'spin 0.7s linear infinite' }} />
      <span style={{ color:'var(--on-surface-variant)', fontSize:13 }}>Loading file index…</span>
    </div>
  );
  if (apiStatus === 'error') return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', color:'#f87171', fontSize:13 }}>Failed to load files.</div>
  );
  if (apiStatus === 'incomplete') return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', flexDirection:'column', gap:10 }}>
      <span style={{ fontSize:32 }}>⏳</span>
      <span style={{ color:'var(--on-surface-variant)', fontSize:13 }}>Run analysis first to index source files.</span>
    </div>
  );

  // ── Main Layout ────────────────────────────────────────────────────────────
  return (
    <div style={{ display:'flex', height:'100%', background:'var(--surface)', overflow:'hidden', position:'relative' }}>

      {/* ── Sidebar ── */}
      <div style={{
        width: sidebarW, flexShrink:0, display:'flex', flexDirection:'column',
        background:'var(--surface-container-low)',
        borderRight:'1px solid var(--outline-variant)',
        overflow:'hidden',
      }}>

        {/* Header */}
        <div style={{
          padding:'12px 14px 10px',
          borderBottom:'1px solid var(--outline-variant)',
          flexShrink:0,
        }}>
          <p style={{ fontSize:10, fontWeight:800, letterSpacing:'0.12em', textTransform:'uppercase', color:'var(--on-surface-variant)', marginBottom:8 }}>
            Explorer
          </p>
          {/* Search */}
          <div style={{
            display:'flex', alignItems:'center', gap:7,
            background:'var(--surface-container)',
            border:'1px solid var(--outline-variant)',
            borderRadius:8, padding:'5px 10px',
          }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--outline)" strokeWidth="2.5">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              type="text"
              placeholder="Search files…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                background:'transparent', border:'none', outline:'none',
                color:'var(--on-surface)', fontSize:12, flex:1, width:0,
              }}
            />
            {search && (
              <button onClick={() => setSearch('')} style={{ background:'none', border:'none', color:'var(--outline)', cursor:'pointer', padding:0, fontSize:14, lineHeight:1, display:'flex' }}>
                ×
              </button>
            )}
          </div>
        </div>

        {/* Language chips */}
        <div style={{ display:'flex', gap:4, flexWrap:'wrap', padding:'8px 10px', borderBottom:'1px solid var(--outline-variant)', flexShrink:0 }}>
          {(['all', ...languages]).map(lang => {
            const isActive = langFilter === lang;
            const color = lang === 'all' ? 'var(--primary)' : langColor(lang);
            const rawColor = lang === 'all' ? undefined : langColor(lang);
            return (
              <button
                key={lang}
                onClick={() => setLangFilter(lang)}
                style={{
                  padding:'2px 8px', borderRadius:12, fontSize:9.5, fontWeight:700,
                  cursor:'pointer',
                  border: isActive
                    ? `1px solid ${rawColor ? rawColor + '80' : 'var(--primary)'}`
                    : '1px solid var(--outline-variant)',
                  background: isActive
                    ? (rawColor ? rawColor + '20' : 'color-mix(in srgb, var(--primary) 15%, transparent)')
                    : 'transparent',
                  color: isActive ? (rawColor ?? 'var(--primary)') : 'var(--on-surface-variant)',
                  transition:'all 0.12s',
                }}
              >
                {lang === 'all' ? `All (${total})` : lang}
              </button>
            );
          })}
        </div>

        {/* File tree */}
        <div style={{ flex:1, overflowY:'auto', padding:'4px 0', scrollbarWidth:'thin', scrollbarColor:'var(--outline-variant) transparent' }}>
          {filteredFiles.length === 0 ? (
            <div style={{ padding:24, textAlign:'center', color:'var(--on-surface-variant)', fontSize:12 }}>
              No files match
            </div>
          ) : (
            tree.map(node => (
              <TreeNodeRow
                key={node.kind === 'file' ? node.file.path : node.name}
                node={node} depth={0}
                activePath={activePath}
                onSelect={openFile}
              />
            ))
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding:'6px 14px', borderTop:'1px solid var(--outline-variant)',
          flexShrink:0, display:'flex', gap:8, alignItems:'center',
        }}>
          <span style={{ fontSize:10, color:'var(--on-surface-variant)' }}>{filteredFiles.length.toLocaleString()} files</span>
          <span style={{ fontSize:10, color:'var(--outline)' }}>·</span>
          <span style={{ fontSize:10, color:'var(--on-surface-variant)' }}>{languages.length} lang{languages.length !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* ── Resize handle ── */}
      <div
        onMouseDown={onHandleMouseDown}
        style={{ width:4, cursor:'col-resize', background:'transparent', flexShrink:0, zIndex:10, transition:'background 0.15s' }}
        onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'var(--primary)'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
      />

      {/* ── Editor area ── */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', minWidth:0 }}>

        {/* Tab bar */}
        <TabBar tabs={openTabs} activePath={activePath} onSelect={setActivePath} onClose={closeTab} />

        {/* File path + meta breadcrumb */}
        {activeFile && !activeFile.loading && !activeFile.error && (
          <div style={{
            display:'flex', alignItems:'center', gap:14,
            padding:'4px 16px',
            background:'var(--surface-container-low)',
            borderBottom:'1px solid var(--outline-variant)',
            flexShrink:0,
          }}>
            <span style={{ display:'flex', alignItems:'center', gap:5, flexShrink:0 }}>
              <span style={{ width:7, height:7, borderRadius:'50%', background:accent }} />
              <span style={{ fontSize:10, color:accent, fontWeight:700, fontFamily:'monospace' }}>{activeLang}</span>
            </span>
            <span style={{ fontSize:11, color:'var(--on-surface-variant)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1 }}>
              {activeFile.path}
            </span>
            <span style={{ fontSize:10, color:'var(--outline)', flexShrink:0, display:'flex', gap:10 }}>
              {activeFile.lines && <span>{activeFile.lines.toLocaleString()} lines</span>}
              {activeFile.size_bytes != null && <span>{formatBytes(activeFile.size_bytes)}</span>}
            </span>
          </div>
        )}

        {/* Code viewer */}
        <div style={{ flex:1, overflow:'auto', background: isDark ? '#1a1b26' : '#fafafa' }}>
          {!activePath ? (
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100%', gap:14, userSelect:'none', opacity:0.4 }}>
              <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="var(--on-surface-variant)" strokeWidth="1.2">
                <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
              </svg>
              <span style={{ color:'var(--on-surface-variant)', fontSize:13 }}>Select a file from the tree</span>
            </div>
          ) : activeFile?.loading ? (
            <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', gap:10, flexDirection:'column' }}>
              <div style={{ width:18, height:18, border:`2px solid ${accent}`, borderTopColor:'transparent', borderRadius:'50%', animation:'spin 0.6s linear infinite' }} />
              <span style={{ color:'var(--on-surface-variant)', fontSize:12 }}>Loading…</span>
            </div>
          ) : activeFile?.error ? (
            <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', color:'#f87171', fontSize:13 }}>
              {activeFile.error}
            </div>
          ) : activeFile?.content !== undefined ? (
            <SyntaxHighlighter
              language={activeLang}
              style={isDark ? atomOneDark : atomOneLight}
              showLineNumbers
              lineNumberStyle={{
                color: isDark ? '#3b4261' : '#c5c8d1',
                fontSize:11, minWidth:'3.5em', userSelect:'none',
                paddingRight:16, fontFamily:'monospace', borderRight:`1px solid ${isDark ? '#1e2030' : '#e5e7eb'}`, marginRight:12,
              }}
              customStyle={{
                margin:0, padding:'14px 0',
                background: isDark ? '#1a1b26' : '#fafafa',
                fontSize:13, fontFamily:"'JetBrains Mono','Fira Code','Cascadia Code','Menlo',monospace",
                lineHeight:1.7, minHeight:'100%',
              }}
              codeTagProps={{ style:{ fontFamily:'inherit' } }}
              wrapLongLines={false}
            >
              {activeFile.content}
            </SyntaxHighlighter>
          ) : null}
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        ::-webkit-scrollbar { width:6px; height:6px; }
        ::-webkit-scrollbar-track { background:transparent; }
        ::-webkit-scrollbar-thumb { background:var(--outline-variant); border-radius:3px; }
        ::-webkit-scrollbar-thumb:hover { background:var(--outline); }
      `}</style>
    </div>
  );
}

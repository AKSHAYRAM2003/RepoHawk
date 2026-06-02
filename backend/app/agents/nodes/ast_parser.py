"""
Step 4: AST Parser Node
Walks a cloned repository and parses each supported file using tree-sitter.
Extracts semantic structure: classes, functions, imports — not raw lines.

Input:  AnalysisState with cloned_path
Output: AnalysisState with parsed_files, total_files, successfully_parsed
"""

import os
from typing import Dict, Any, List, Optional, Tuple

from tree_sitter import Language, Parser

from app.agents.state import ParsedFile


# --- Language Registry ---

# Supported languages and their file extensions
LANGUAGE_MAP = {
    ".py": "python",
    ".js": "javascript",
    ".jsx": "javascript",
    ".ts": "typescript",
    ".tsx": "typescript",
    ".go": "go",
}

# Wider list of programming/scripting/markup source file extensions to prioritize
CODE_EXTENSIONS = {
    ".py", ".js", ".jsx", ".ts", ".tsx", ".go",
    ".rs", ".java", ".c", ".cpp", ".cc", ".cxx", ".h", ".hpp",
    ".cs", ".php", ".rb", ".swift", ".kt", ".kts", ".scala",
    ".sh", ".bash", ".pl", ".pm", ".sql", ".r", ".m",
    ".html", ".css", ".scss", ".sass", ".less",
}


# Directories/files to skip (noise, not architecture)
SKIP_DIRS = {
    "node_modules", ".git", "__pycache__", ".venv", "venv", "env",
    "dist", "build", ".next", ".nuxt", "vendor", ".tox",
    "egg-info", ".eggs", ".mypy_cache", ".pytest_cache",
    "coverage", ".coverage", "htmlcov",
}

SKIP_FILES = {
    "package-lock.json", "yarn.lock", "pnpm-lock.yaml",
    ".DS_Store", "Thumbs.db",
}

# Binary/image extensions to skip (LLM cannot read these)
BINARY_EXTENSIONS = {
    ".png", ".jpg", ".jpeg", ".gif", ".bmp", ".ico", ".webp", ".svg",
    ".woff", ".woff2", ".ttf", ".otf", ".eot",
    ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
    ".zip", ".tar", ".gz", ".bz2", ".xz", ".rar", ".7z",
    ".mp3", ".mp4", ".avi", ".mov", ".wmv", ".flv",
    ".exe", ".dll", ".so", ".dylib", ".bin",
    ".pyc", ".pyo", ".pyd",
    ".o", ".a", ".lib", ".obj",
}

# Max file size to parse (skip huge generated files)
MAX_FILE_SIZE_BYTES = 100_000  # 100KB


def _get_tree_sitter_language(lang_name: str):
    """Load tree-sitter language module dynamically."""
    try:
        if lang_name == "python":
            import tree_sitter_python as tsp
            return Language(tsp.language())
        elif lang_name == "javascript":
            import tree_sitter_javascript as tsjs
            return Language(tsjs.language())
        elif lang_name == "typescript":
            import tree_sitter_typescript as tsts
            return Language(tsts.language_typescript())
        elif lang_name == "go":
            import tree_sitter_go as tsgo
            return Language(tsgo.language())
    except ImportError:
        return None
    return None


def _extract_chunks_from_tree(tree, source_bytes: bytes, lang_name: str) -> List[str]:
    """
    Walk the AST and extract meaningful code chunks.
    Each chunk = one top-level definition (class, function, import block).
    """
    chunks = []
    root = tree.root_node

    # Node types to extract per language
    extract_types = {
        "python": ["class_definition", "function_definition", "import_statement",
                    "import_from_statement", "decorated_definition"],
        "javascript": ["class_declaration", "function_declaration", "export_statement",
                        "import_statement", "lexical_declaration", "variable_declaration"],
        "typescript": ["class_declaration", "function_declaration", "export_statement",
                        "import_statement", "lexical_declaration", "interface_declaration",
                        "type_alias_declaration"],
        "go": ["function_declaration", "method_declaration", "type_declaration",
               "import_declaration", "package_clause"],
    }

    target_types = set(extract_types.get(lang_name, []))

    for child in root.children:
        if child.type in target_types:
            chunk_text = source_bytes[child.start_byte:child.end_byte].decode("utf-8", errors="replace")
            # Keep chunks under 2000 chars to stay embedding-friendly
            if len(chunk_text) <= 2000:
                chunks.append(chunk_text)
            else:
                # Split large chunks (e.g. a massive class) into header + first part
                chunks.append(chunk_text[:2000] + "\n# ... (truncated)")

    return chunks


def _fallback_chunk(content: str) -> List[str]:
    """
    Fallback for unsupported languages: split by double newlines.
    Each chunk is a logical block of code.
    """
    blocks = content.split("\n\n")
    chunks = []
    for block in blocks:
        stripped = block.strip()
        if stripped and len(stripped) > 20:  # Skip tiny fragments
            chunks.append(stripped[:2000])
    return chunks


def parse_single_file(file_path: str, repo_root: str) -> Optional[ParsedFile]:
    """
    Parse a single file using tree-sitter (or fallback).
    Returns a ParsedFile or None if file should be skipped.
    """
    rel_path = os.path.relpath(file_path, repo_root)
    _, ext = os.path.splitext(file_path)

    # Read file content
    try:
        with open(file_path, "r", encoding="utf-8", errors="replace") as f:
            content = f.read()
    except (IOError, OSError):
        return None

    # Skip empty files
    if not content.strip():
        return None

    lang_name = LANGUAGE_MAP.get(ext)

    if lang_name:
        # Tree-sitter parsing
        ts_lang = _get_tree_sitter_language(lang_name)
        if ts_lang:
            parser = Parser(ts_lang)
            tree = parser.parse(content.encode("utf-8"))
            chunks = _extract_chunks_from_tree(tree, content.encode("utf-8"), lang_name)
            # If tree-sitter found nothing, fall back
            if not chunks:
                chunks = _fallback_chunk(content)
        else:
            chunks = _fallback_chunk(content)
    else:
        # Unsupported language — use fallback chunking
        lang_name = ext.lstrip(".") or "unknown"
        chunks = _fallback_chunk(content)

    if not chunks:
        return None

    return ParsedFile(
        path=rel_path,
        language=lang_name,
        content=content,
        chunks=chunks,
    )


def ast_parser_node(state: Dict[str, Any]) -> Dict[str, Any]:
    """
    LangGraph node: Walks the cloned repo and parses all files.

    Args:
        state: Current AnalysisState with cloned_path

    Returns:
        Partial state with parsed_files, total_files, successfully_parsed
    """
    cloned_path = state.get("cloned_path")

    if not cloned_path or not os.path.isdir(cloned_path):
        return {
            "error": f"Clone path not found: {cloned_path}",
            "current_step": "error",
            "progress_log": [f"❌ Clone path missing: {cloned_path}"],
        }

    # 1. Collect candidate files
    candidates = []
    skipped = 0

    for dirpath, dirnames, filenames in os.walk(cloned_path):
        # Skip irrelevant directories (modifies dirnames in-place)
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]

        for filename in filenames:
            if filename in SKIP_FILES:
                continue

            file_path = os.path.join(dirpath, filename)
            _, ext = os.path.splitext(filename)

            # Skip binary/image files that LLM cannot read
            if ext.lower() in BINARY_EXTENSIONS:
                skipped += 1
                continue

            # Skip oversized files
            try:
                if os.path.getsize(file_path) > MAX_FILE_SIZE_BYTES:
                    skipped += 1
                    continue
            except OSError:
                continue

            # 2. Filter noise files
            name_lower = filename.lower()
            
            # Skip hidden files/dotfiles (except for known configuration or source files if any, but standard is skip)
            if filename.startswith(".") and not filename.startswith(".env"):
                continue
                
            # Skip licenses/notices
            if name_lower in {"license", "copying", "patents", "notice", "license.txt", "license.md", "copying.txt"}:
                continue
                
            # Skip translated readmes (e.g. README_zh.md, README_ru.md, README_ja.md)
            if name_lower.startswith("readme_") or name_lower.startswith("contributing_"):
                continue

            candidates.append((file_path, filename, ext.lower()))

    # 3. Assign priority score (lower is higher priority)
    scored_files = []
    for file_path, filename, ext in candidates:
        rel_path = os.path.relpath(file_path, cloned_path)
        rel_path_lower = rel_path.lower()
        name_lower = filename.lower()
        
        is_test = (
            "test" in rel_path_lower or
            name_lower.startswith("test_") or
            name_lower.endswith("_test") or
            "__tests__" in rel_path_lower
        )
        
        if is_test:
            # Deprioritize tests to lowest tier
            score = 5
        elif ext in CODE_EXTENSIONS or ext in LANGUAGE_MAP:
            # Priority 1: Primary source code / code scripts / markup (.py, .js, .ts, .go, .rs, .java, etc.)
            score = 1
        elif name_lower == "readme.md":
            # Priority 2: Main README
            score = 2
        elif name_lower in {"package.json", "requirements.txt", "pyproject.toml", "go.mod", "dockerfile", "docker-compose.yml", "makefile"}:
            # Priority 3: Primary manifests
            score = 3
        else:
            # Priority 4: Other text/config files
            score = 4
            
        scored_files.append({
            "path": file_path,
            "score": score
        })

    # Sort candidates by priority score (ascending)
    scored_files.sort(key=lambda x: x["score"])

    # 4. Parse sorted files
    parsed_files: List[ParsedFile] = []
    total_files = len(scored_files)

    for sf in scored_files:
        result = parse_single_file(sf["path"], cloned_path)
        if result:
            parsed_files.append(result)

    return {
        "parsed_files": parsed_files,
        "total_files": total_files,
        "successfully_parsed": len(parsed_files),
        "current_step": "parsing_complete",
        "progress_log": [
            f"✅ Parsed {len(parsed_files)}/{total_files} files "
            f"({skipped} skipped for size)"
        ],
    }

"""
Unit Tests for Step 4: AST Parser Node
Tests tree-sitter parsing, fallback chunking, file walking, and skip logic.
Uses temp files with real code — no network calls needed.
"""

import sys
import os
import tempfile
import shutil
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.agents.nodes.ast_parser import (
    parse_single_file,
    ast_parser_node,
    SKIP_DIRS,
    _fallback_chunk,
)


# --- Helper: create a temp repo with sample files ---

def create_test_repo():
    """Creates a temporary directory simulating a small Python/JS project."""
    repo_dir = tempfile.mkdtemp(prefix="repohawk_test_")

    # Python file with class and function
    py_content = '''
import os
from typing import List

class AuthService:
    """Handles authentication."""
    def __init__(self, db):
        self.db = db

    def verify_token(self, token: str) -> bool:
        return token == "valid"

def helper_function():
    return 42
'''
    os.makedirs(os.path.join(repo_dir, "src", "auth"), exist_ok=True)
    with open(os.path.join(repo_dir, "src", "auth", "service.py"), "w") as f:
        f.write(py_content)

    # JS file with export and function
    js_content = '''
import React from 'react';

export function Dashboard() {
    return <div>Hello</div>;
}

function helperUtil() {
    return 42;
}
'''
    os.makedirs(os.path.join(repo_dir, "src", "components"), exist_ok=True)
    with open(os.path.join(repo_dir, "src", "components", "Dashboard.jsx"), "w") as f:
        f.write(js_content)

    # A markdown file (unsupported by tree-sitter — fallback)
    with open(os.path.join(repo_dir, "README.md"), "w") as f:
        f.write("# My Project\n\nThis is a test project.\n\nIt does things.")

    # An empty file (should be skipped)
    with open(os.path.join(repo_dir, "empty.py"), "w") as f:
        f.write("")

    # A node_modules dir (should be entirely skipped)
    os.makedirs(os.path.join(repo_dir, "node_modules", "lodash"), exist_ok=True)
    with open(os.path.join(repo_dir, "node_modules", "lodash", "index.js"), "w") as f:
        f.write("module.exports = {};")

    return repo_dir


# --- Tests ---

def test_parse_python_file():
    """tree-sitter should extract classes, functions, imports from Python"""
    repo_dir = create_test_repo()
    py_file = os.path.join(repo_dir, "src", "auth", "service.py")

    result = parse_single_file(py_file, repo_dir)

    assert result is not None
    assert result["language"] == "python"
    assert result["path"] == os.path.join("src", "auth", "service.py")
    assert len(result["chunks"]) >= 3, f"Expected >=3 chunks (import, class, function), got {len(result['chunks'])}"

    # Verify we got the class
    chunk_text = "\n".join(result["chunks"])
    assert "AuthService" in chunk_text
    assert "verify_token" in chunk_text

    print(f"✅ Python parsed: {len(result['chunks'])} chunks extracted")
    shutil.rmtree(repo_dir)


def test_parse_javascript_file():
    """tree-sitter should extract components and functions from JSX"""
    repo_dir = create_test_repo()
    js_file = os.path.join(repo_dir, "src", "components", "Dashboard.jsx")

    result = parse_single_file(js_file, repo_dir)

    assert result is not None
    assert result["language"] == "javascript"
    assert len(result["chunks"]) >= 1

    chunk_text = "\n".join(result["chunks"])
    assert "Dashboard" in chunk_text

    print(f"✅ JavaScript parsed: {len(result['chunks'])} chunks extracted")
    shutil.rmtree(repo_dir)


def test_parse_unsupported_file_uses_fallback():
    """Markdown/unknown files should use fallback paragraph-based chunking"""
    repo_dir = create_test_repo()
    md_file = os.path.join(repo_dir, "README.md")

    result = parse_single_file(md_file, repo_dir)

    assert result is not None
    assert result["language"] == "md"
    assert len(result["chunks"]) >= 1

    print(f"✅ Fallback chunking on .md: {len(result['chunks'])} chunks")
    shutil.rmtree(repo_dir)


def test_parse_empty_file_returns_none():
    """Empty files should be skipped (return None)"""
    repo_dir = create_test_repo()
    empty_file = os.path.join(repo_dir, "empty.py")

    result = parse_single_file(empty_file, repo_dir)

    assert result is None
    print("✅ Empty file returns None (skipped)")
    shutil.rmtree(repo_dir)


def test_fallback_chunk_splits_by_paragraphs():
    """Fallback chunker should split on double newlines"""
    text = "This is the first block of code that is long enough to be kept by the filter\n\nThis is the second block of code that is also long enough to pass the minimum length check"
    chunks = _fallback_chunk(text)
    assert len(chunks) >= 2, f"Expected >=2 chunks, got {len(chunks)}: {chunks}"
    print(f"✅ Fallback chunking produced {len(chunks)} chunks")


def test_ast_parser_node_full_repo():
    """Full pipeline test: walk a repo and parse all files"""
    repo_dir = create_test_repo()

    state = {"cloned_path": repo_dir}
    result = ast_parser_node(state)

    assert "error" not in result or not result.get("error")
    assert result["successfully_parsed"] >= 2  # At least Python + JS
    assert result["total_files"] >= 2
    assert result["current_step"] == "parsing_complete"
    assert len(result["parsed_files"]) >= 2

    print(f"✅ Full repo parsed: {result['successfully_parsed']}/{result['total_files']} files")
    shutil.rmtree(repo_dir)


def test_node_modules_skipped():
    """node_modules directory should be completely skipped"""
    repo_dir = create_test_repo()

    state = {"cloned_path": repo_dir}
    result = ast_parser_node(state)

    # No file from node_modules should appear
    for pf in result["parsed_files"]:
        assert "node_modules" not in pf["path"], f"node_modules file leaked: {pf['path']}"

    print("✅ node_modules directory completely skipped")
    shutil.rmtree(repo_dir)


def test_missing_clone_path_returns_error():
    """If cloned_path doesn't exist, return error gracefully"""
    state = {"cloned_path": "/nonexistent/path/xyz"}
    result = ast_parser_node(state)

    assert result.get("error") and result["error"] != ""
    assert result["current_step"] == "error"
    print("✅ Missing clone path returns error (no crash)")


if __name__ == "__main__":
    print("\n🧪 Running Step 4 Unit Tests: AST Parser Node\n" + "=" * 55)
    test_parse_python_file()
    test_parse_javascript_file()
    test_parse_unsupported_file_uses_fallback()
    test_parse_empty_file_returns_none()
    test_fallback_chunk_splits_by_paragraphs()
    test_ast_parser_node_full_repo()
    test_node_modules_skipped()
    test_missing_clone_path_returns_error()
    print("\n" + "=" * 55)
    print("✅ All 8 tests passed! Step 4 complete.\n")

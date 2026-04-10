"""
Unit Tests for Step 3: Git Cloner Node
Tests URL validation, path generation, cloning, cleanup, and error handling.
"""

import sys
import os
import shutil
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.agents.nodes.git_cloner import (
    validate_github_url,
    get_clone_path,
    cleanup_clone,
    git_cloner_node,
    CLONE_BASE_DIR,
)


# ---- URL Validation Tests ----

def test_valid_github_urls():
    """Accept standard GitHub URLs"""
    valid = [
        "https://github.com/owner/repo",
        "https://github.com/tiangolo/fastapi",
        "https://github.com/AKSHAYRAM2003/RepoHawk",
        "https://github.com/facebook/react",
    ]
    for url in valid:
        assert validate_github_url(url), f"Should accept: {url}"
    print(f"✅ {len(valid)} valid GitHub URLs accepted")


def test_invalid_github_urls():
    """Reject non-GitHub and malicious URLs"""
    invalid = [
        "https://gitlab.com/owner/repo",
        "https://github.com/",
        "https://github.com/owner",
        "http://github.com/owner/repo",  # http not https
        "https://evil.com/github.com/owner/repo",
        "https://github.com/../../../etc/passwd",
        "not-a-url",
        "",
    ]
    for url in invalid:
        assert not validate_github_url(url), f"Should reject: {url}"
    print(f"✅ {len(invalid)} invalid URLs rejected")


# ---- Path Generation Tests ----

def test_clone_path_generation():
    """Clone path should be inside CLONE_BASE_DIR and contain repo_id"""
    path = get_clone_path("abc-123")
    assert path.startswith(CLONE_BASE_DIR)
    assert "abc-123" in path
    print(f"✅ Clone path generated: {path}")


def test_clone_path_sanitization():
    """Dangerous characters in repo_id should be stripped"""
    path = get_clone_path("../../../etc/passwd")
    assert ".." not in path
    assert "etc" in path  # letters are kept, slashes stripped
    assert "/" not in os.path.basename(path)
    print("✅ Path traversal characters stripped from repo_id")


# ---- Cloner Node Tests ----

def test_clone_real_small_repo():
    """Actually clone a tiny public repo (tests real Git behavior)"""
    test_repo_id = "test-clone-step3"
    state = {
        "repo_url": "https://github.com/octocat/Hello-World",
        "repo_id": test_repo_id,
    }

    result = git_cloner_node(state)

    assert "error" not in result or result.get("error") is None or result.get("error") == "", \
        f"Clone failed: {result.get('error')}"
    assert result["cloned_path"] is not None
    assert os.path.isdir(result["cloned_path"]), "Clone dir should exist"
    assert result["current_step"] == "cloning_complete"
    assert len(result["progress_log"]) >= 1
    
    # Verify files actually exist in clone
    files = os.listdir(result["cloned_path"])
    assert len(files) > 0, "Cloned repo should have files"

    print(f"✅ Real clone succeeded: {result['cloned_path']} ({len(files)} items)")

    # Cleanup
    cleanup_clone(test_repo_id)
    assert not os.path.exists(get_clone_path(test_repo_id)), "Cleanup should remove dir"
    print("✅ Cleanup removed cloned directory")


def test_clone_invalid_url_returns_error():
    """Invalid URL should return error state, not crash"""
    state = {
        "repo_url": "https://evil.com/not-github",
        "repo_id": "test-invalid",
    }

    result = git_cloner_node(state)

    assert result.get("error") is not None and result["error"] != ""
    assert result["current_step"] == "error"
    assert "Invalid" in result["progress_log"][0]
    print("✅ Invalid URL returns proper error state")


def test_clone_nonexistent_repo_returns_error():
    """A GitHub URL that doesn't exist should return a Git error"""
    state = {
        "repo_url": "https://github.com/nobody/this-repo-does-not-exist-xyz-12345",
        "repo_id": "test-nonexistent",
    }

    result = git_cloner_node(state)

    assert result.get("error") is not None and result["error"] != ""
    assert result["current_step"] == "error"
    print(f"✅ Nonexistent repo returns error: {result['error'][:60]}...")

    # Cleanup just in case
    cleanup_clone("test-nonexistent")


def test_cleanup_nonexistent_path():
    """Cleanup should not crash if directory doesn't exist"""
    cleanup_clone("doesnt-exist-at-all-xyz")
    print("✅ Cleanup on non-existent path doesn't crash")


if __name__ == "__main__":
    print("\n🧪 Running Step 3 Unit Tests: Git Cloner Node\n" + "=" * 55)
    test_valid_github_urls()
    test_invalid_github_urls()
    test_clone_path_generation()
    test_clone_path_sanitization()
    test_clone_real_small_repo()
    test_clone_invalid_url_returns_error()
    test_clone_nonexistent_repo_returns_error()
    test_cleanup_nonexistent_path()
    print("\n" + "=" * 55)
    print("✅ All 8 tests passed! Step 3 complete.\n")

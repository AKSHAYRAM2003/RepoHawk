"""
Integration Tests for Step 10 (Repos): FastAPI Wiring
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.main import app


def test_analyze_repo_route_registered():
    routes = [route.path for route in app.routes]
    assert "/api/v1/repos/analyze" in routes


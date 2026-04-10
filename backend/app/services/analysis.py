"""
Repo Analysis Service
Handles the execution of the agentic analysis pipeline and database persistence.
"""

import uuid
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.repo import Repo
from app.models.diagram import Diagram
from app.agents.graph import analysis_graph

async def run_repo_analysis(repo_id: uuid.UUID, db_factory):
    """
    Runs the LangGraph analysis pipeline and updates the Repo record.
    Passed a db_factory (async session maker) because background tasks need their own session.
    """
    async with db_factory() as db:
        # 1. Fetch Repo
        stmt = select(Repo).where(Repo.id == repo_id)
        result = await db.execute(stmt)
        repo = result.scalar_one_or_none()
        
        if not repo:
            return

        repo.analysis_status = "running"
        await db.commit()

        # 2. Invoke Analysis Graph
        initial_state = {
            "repo_url": repo.github_url,
            "repo_id": str(repo.id)
        }

        try:
            # Note: This is a synchronous call to the compiled graph. 
            # In a production app, you might use an async invoke or separate worker.
            final_state = analysis_graph.invoke(initial_state)

            if "error" in final_state and final_state["error"]:
                repo.analysis_status = "failed"
                await db.commit()
                return

            # 3. Create Diagram record
            new_diagram = Diagram(
                repo_id=repo.id,
                mermaid_syntax=final_state.get("mermaid_syntax", ""),
                reactflow_json={
                    "nodes": final_state.get("reactflow_nodes", []),
                    "edges": final_state.get("reactflow_edges", [])
                },
                confidence_level=final_state.get("confidence_level", "low")
            )
            db.add(new_diagram)

            # 4. Update Repo
            repo.analysis_status = "complete"
            repo.last_analyzed_at = datetime.utcnow()
            repo.file_count = final_state.get("total_files", 0)
            
            await db.commit()

        except Exception as e:
            repo.analysis_status = "failed"
            await db.commit()
            print(f"FATAL: Analysis failed for {repo.id}: {str(e)}")

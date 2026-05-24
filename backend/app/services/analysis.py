"""
Repo Analysis Service
Handles the execution of the agentic analysis pipeline and database persistence.
"""

import uuid
import asyncio
import logging
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.repo import Repo
from app.models.diagram import Diagram
from app.agents.graph import analysis_graph
from app.core.progress import progress_manager, task_manager

logger = logging.getLogger("repohawk.analysis")


async def run_repo_analysis(repo_id: uuid.UUID, db_factory):
    """
    Runs the LangGraph analysis pipeline and updates the Repo record.
    Passed a db_factory (async session maker) because background tasks need their own session.
    """
    current_task = asyncio.current_task()
    task_manager.register_task(str(repo_id), current_task)

    try:
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
                "repo_id": str(repo.id),
                "progress_log": [],
                "parsed_files": [],
                "reactflow_nodes": [],
                "reactflow_edges": [],
                "retry_count": 0
            }

            final_state = initial_state.copy()

            try:
                # Run the compiled graph step-by-step using astream
                async for event in analysis_graph.astream(initial_state):
                    for node_name, node_state in event.items():
                        # Merge node updates
                        for key, val in node_state.items():
                            if key == "progress_log" and val:
                                final_state["progress_log"].extend(val)
                                # Publish each log item
                                for log in val:
                                    progress_manager.publish(str(repo_id), {
                                        "step": node_name,
                                        "log": log,
                                        "status": "running"
                                    })
                            else:
                                final_state[key] = val

                if "error" in final_state and final_state["error"]:
                    repo.analysis_status = "failed"
                    await db.commit()
                    # Publish failure status
                    progress_manager.publish(str(repo_id), {
                        "step": "pipeline_error",
                        "log": f"❌ Analysis failed: {final_state['error']}",
                        "status": "failed"
                    })
                    return

                # 3. Create Diagram record (defensive: set reactflow_json after creation if needed)
                try:
                    new_diagram = Diagram(
                        repo_id=repo.id,
                        mermaid_syntax=final_state.get("mermaid_syntax", ""),
                        reactflow_json={
                            "nodes": final_state.get("reactflow_nodes", []),
                            "edges": final_state.get("reactflow_edges", [])
                        },
                        confidence_level=final_state.get("confidence_level", "low")
                    )
                except TypeError:
                    new_diagram = Diagram(
                        repo_id=repo.id,
                        mermaid_syntax=final_state.get("mermaid_syntax", ""),
                        confidence_level=final_state.get("confidence_level", "low")
                    )
                    new_diagram.reactflow_json = {
                        "nodes": final_state.get("reactflow_nodes", []),
                        "edges": final_state.get("reactflow_edges", [])
                    }
                db.add(new_diagram)

                # 4. Update Repo
                repo.analysis_status = "complete"
                repo.last_analyzed_at = datetime.utcnow()
                repo.file_count = final_state.get("total_files", 0)
                
                await db.commit()

                # Publish completion status
                progress_manager.publish(str(repo_id), {
                    "step": "pipeline_complete",
                    "log": "🎉 Codebase analysis completed successfully!",
                    "status": "complete"
                })

            except asyncio.CancelledError:
                # Handle cancellation explicitly
                repo.analysis_status = "failed"
                await db.commit()
                progress_manager.publish(str(repo_id), {
                    "step": "pipeline_cancelled",
                    "log": "⏹️ Analysis stopped by user.",
                    "status": "failed"
                })
                raise

            except Exception as e:
                import traceback
                logger.error(f"Analysis failed for {repo.id}: {str(e)}")
                logger.error(traceback.format_exc())
                repo.analysis_status = "failed"
                await db.commit()
                progress_manager.publish(str(repo_id), {
                    "step": "pipeline_error",
                    "log": f"❌ Fatal analysis error: {str(e)}",
                    "status": "failed"
                })
    finally:
        task_manager.unregister_task(str(repo_id))


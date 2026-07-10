"""
Repo Analysis Service
Handles the execution of the agentic analysis pipeline and database persistence.
"""

import uuid
import asyncio
import logging
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from app.models.repo import Repo
from app.models.diagram import Diagram
from app.models.notification import Notification
from app.agents.graph import analysis_graph
from app.core.progress import progress_manager, task_manager

logger = logging.getLogger("repohawk.analysis")


async def recover_stale_analyses(db_factory):
    """
    Called once at server startup. Any repo stuck in 'running' or 'queued'
    state is from a previous server process that died (crash, restart, kill).
    Mark these as 'failed' so the frontend stops showing an infinite spinner
    and the user can re-run the analysis.
    """
    async with db_factory() as db:
        result = await db.execute(
            select(Repo).where(Repo.analysis_status.in_(["running", "queued"]))
        )
        stale = result.scalars().all()
        if not stale:
            return
        for repo in stale:
            logger.warning(
                f"Startup recovery: repo '{repo.name}' ({repo.id}) was stuck "
                f"in '{repo.analysis_status}' — marking as failed (server restart detected)."
            )
            repo.analysis_status = "failed"
            current_logs = list(repo.logs or [])
            current_logs.append({
                "step": "recovery",
                "log": "⚠️ Analysis was interrupted by a server restart. Please re-run.",
                "status": "failed",
            })
            repo.logs = current_logs
        await db.commit()
        logger.info(f"Startup recovery: cleaned {len(stale)} stale repo(s).")


async def run_repo_analysis(repo_id: uuid.UUID, db_factory):
    """
    Runs the LangGraph analysis pipeline and updates the Repo record.
    Passed a db_factory (async session maker) because background tasks need their own session.
    """
    current_task = asyncio.current_task()
    task_manager.register_task(str(repo_id), current_task)

    async def _safe_commit(db):
        """Commit and rollback the session if it fails so it stays usable."""
        try:
            await db.commit()
        except Exception as commit_err:
            logger.error(f"DB commit failed, rolling back: {commit_err}")
            await db.rollback()
            raise

    try:
        async with db_factory() as db:
            # 1. Fetch Repo
            stmt = select(Repo).where(Repo.id == repo_id)
            result = await db.execute(stmt)
            repo = result.scalar_one_or_none()
            
            if not repo:
                return

            repo.analysis_status = "running"
            await _safe_commit(db)

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
                # Enforce a maximum duration per pipeline step so the
                # analysis can't hang indefinitely if an LLM call stalls.
                step_timeout = 300  # seconds per step (5 minutes)
                ait = analysis_graph.astream(initial_state).__aiter__()
                while True:
                    try:
                        event = await asyncio.wait_for(ait.__anext__(), timeout=step_timeout)
                    except StopAsyncIteration:
                        break
                    for node_name, node_state in event.items():
                        # Merge node updates
                        for key, val in node_state.items():
                            if key == "progress_log" and val:
                                final_state["progress_log"].extend(val)
                                # Publish and persist each log item
                                for log in val:
                                    event_data = {
                                        "step": node_name,
                                        "log": log,
                                        "status": "running"
                                    }
                                    progress_manager.publish(str(repo_id), event_data)
                                    # Persist to DB (reassign for SQLAlchemy mutation tracking)
                                    current_logs = list(repo.logs or [])
                                    current_logs.append(event_data)
                                    repo.logs = current_logs
                                    await _safe_commit(db)
                            else:
                                final_state[key] = val

                if "error" in final_state and final_state["error"]:
                    repo.analysis_status = "failed"
                    await _safe_commit(db)

                    notif = Notification(
                        user_id=repo.user_id,
                        type="analysis_failed",
                        title=f"Analysis failed — {repo.name}",
                        body=final_state["error"][:200],
                        link=f"/repo/{repo.id}",
                    )
                    db.add(notif)
                    await _safe_commit(db)
                    # Publish failure status
                    event_data = {
                        "step": "pipeline_error",
                        "log": f"❌ Analysis failed: {final_state['error']}",
                        "status": "failed"
                    }
                    progress_manager.publish(str(repo_id), event_data)
                    current_logs = list(repo.logs or [])
                    current_logs.append(event_data)
                    repo.logs = current_logs
                    await _safe_commit(db)
                    return

                # 3. Create Diagram record
                try:
                    new_diagram = Diagram(
                        repo_id=repo.id,
                        user_id=repo.user_id,
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
                        user_id=repo.user_id,
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
                
                await _safe_commit(db)

                # Notify user of completion
                notif = Notification(
                    user_id=repo.user_id,
                    type="analysis_complete",
                    title=f"Analysis complete — {repo.name}",
                    body=f"Architecture diagram generated with {final_state.get('total_files', 0)} files analyzed",
                    link=f"/repo/{repo.id}",
                )
                db.add(notif)
                await _safe_commit(db)

                # Publish completion status
                final_event = {
                    "step": "pipeline_complete",
                    "log": "🎉 Codebase analysis completed successfully!",
                    "status": "complete"
                }
                progress_manager.publish(str(repo_id), final_event)
                current_logs = list(repo.logs or [])
                current_logs.append(final_event)
                repo.logs = current_logs
                await _safe_commit(db)

            except asyncio.TimeoutError:
                await db.rollback()
                repo.analysis_status = "failed"
                timeout_event = {
                    "step": "pipeline_error",
                    "log": "⏰ Analysis timed out (a single step exceeded 5 minutes). Try analyzing a smaller repository.",
                    "status": "failed"
                }
                current_logs = list(repo.logs or [])
                current_logs.append(timeout_event)
                repo.logs = current_logs
                await _safe_commit(db)
                progress_manager.publish(str(repo_id), timeout_event)

                notif = Notification(
                    user_id=repo.user_id,
                    type="analysis_failed",
                    title=f"Analysis timed out — {repo.name}",
                    body="A single step exceeded 5 minutes. Try a smaller repository.",
                    link=f"/repo/{repo.id}",
                )
                db.add(notif)
                await _safe_commit(db)

            except asyncio.CancelledError:
                # Handle cancellation explicitly
                await db.rollback()
                repo.analysis_status = "failed"
                cancel_event = {
                    "step": "pipeline_cancelled",
                    "log": "⏹️ Analysis stopped by user.",
                    "status": "failed"
                }
                current_logs = list(repo.logs or [])
                current_logs.append(cancel_event)
                repo.logs = current_logs
                await _safe_commit(db)
                progress_manager.publish(str(repo_id), cancel_event)
                raise

            except Exception as e:
                import traceback
                logger.error(f"Analysis pipeline error: {str(e)}")
                logger.error(traceback.format_exc())
                # Rollback any broken transaction before writing failure status
                await db.rollback()
                repo.analysis_status = "failed"
                error_event = {
                    "step": "pipeline_error",
                    "log": f"❌ Fatal analysis error: {str(e)}",
                    "status": "failed"
                }
                current_logs = list(repo.logs or [])
                current_logs.append(error_event)
                repo.logs = current_logs
                await _safe_commit(db)
                progress_manager.publish(str(repo_id), error_event)

                notif = Notification(
                    user_id=repo.user_id,
                    type="analysis_failed",
                    title=f"Analysis failed — {repo.name}",
                    body=str(e)[:200],
                    link=f"/repo/{repo.id}",
                )
                db.add(notif)
                await _safe_commit(db)
    finally:
        task_manager.unregister_task(str(repo_id))


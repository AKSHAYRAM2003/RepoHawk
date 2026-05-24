import asyncio
from typing import Dict, List

class ProgressManager:
    """
    A simple in-memory publish-subscribe manager for repo analysis progress.
    Allows the background analysis worker to publish logs, and the SSE connection
    to listen to updates for specific repository IDs.
    """
    def __init__(self):
        self.queues: Dict[str, List[asyncio.Queue]] = {}

    def get_queue(self, repo_id: str) -> asyncio.Queue:
        if repo_id not in self.queues:
            self.queues[repo_id] = []
        queue = asyncio.Queue()
        self.queues[repo_id].append(queue)
        return queue

    def remove_queue(self, repo_id: str, queue: asyncio.Queue):
        if repo_id in self.queues:
            if queue in self.queues[repo_id]:
                self.queues[repo_id].remove(queue)
            if not self.queues[repo_id]:
                del self.queues[repo_id]

    def publish(self, repo_id: str, data: dict):
        if repo_id in self.queues:
            for queue in self.queues[repo_id]:
                queue.put_nowait(data)

progress_manager = ProgressManager()


class TaskManager:
    """
    Manages active asyncio tasks running repository analysis.
    Allows for cancellation of tasks on user request.
    """
    def __init__(self):
        self.active_tasks: Dict[str, asyncio.Task] = {}

    def register_task(self, repo_id: str, task: asyncio.Task):
        self.active_tasks[repo_id] = task

    def unregister_task(self, repo_id: str):
        if repo_id in self.active_tasks:
            del self.active_tasks[repo_id]

    def cancel_task(self, repo_id: str) -> bool:
        if repo_id in self.active_tasks:
            task = self.active_tasks[repo_id]
            task.cancel()
            return True
        return False


task_manager = TaskManager()


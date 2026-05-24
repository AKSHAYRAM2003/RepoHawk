import asyncio
from typing import Dict, List

class ProgressManager:
    """
    Pub-sub manager for repo analysis progress events.
    Stores event history so reconnecting clients can replay past events.
    """
    def __init__(self):
        self.queues: Dict[str, List[asyncio.Queue]] = {}
        self.history: Dict[str, List[dict]] = {}
        self._max_history = 500

    def get_queue(self, repo_id: str) -> asyncio.Queue:
        if repo_id not in self.queues:
            self.queues[repo_id] = []
        queue = asyncio.Queue()
        self.queues[repo_id].append(queue)
        # Replay past events into the new queue
        for event in self.history.get(repo_id, []):
            queue.put_nowait(event)
        return queue

    def remove_queue(self, repo_id: str, queue: asyncio.Queue):
        if repo_id in self.queues:
            if queue in self.queues[repo_id]:
                self.queues[repo_id].remove(queue)
            if not self.queues[repo_id]:
                del self.queues[repo_id]

    def publish(self, repo_id: str, data: dict):
        # Store in history
        if repo_id not in self.history:
            self.history[repo_id] = []
        self.history[repo_id].append(data)
        # Trim history
        if len(self.history[repo_id]) > self._max_history:
            self.history[repo_id] = self.history[repo_id][-self._max_history:]

        # Notify all listeners
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

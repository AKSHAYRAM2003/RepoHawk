#!/usr/bin/env python3
"""
Garbage Collection Script

Deletes git clones in /tmp/repohawk that are older than 24 hours to prevent the 
server from running out of disk space. This can be run as a cron job.
"""

import os
import time
import shutil
import logging

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger("garbage_collection")

CLONE_BASE_DIR = os.path.join(os.environ.get("TMPDIR", "/tmp"), "repohawk")
MAX_AGE_SECONDS = 24 * 60 * 60  # 24 hours

def run_gc():
    if not os.path.exists(CLONE_BASE_DIR):
        logger.info(f"Directory {CLONE_BASE_DIR} does not exist. Nothing to clean.")
        return

    now = time.time()
    deleted_count = 0
    reclaimed_bytes = 0

    for item in os.listdir(CLONE_BASE_DIR):
        item_path = os.path.join(CLONE_BASE_DIR, item)
        if not os.path.isdir(item_path):
            continue

        try:
            # Check modification time of the directory
            mtime = os.path.getmtime(item_path)
            age = now - mtime
            
            if age > MAX_AGE_SECONDS:
                # Calculate size before deleting
                size = 0
                for dirpath, _, filenames in os.walk(item_path):
                    for f in filenames:
                        fp = os.path.join(dirpath, f)
                        if not os.path.islink(fp):
                            size += os.path.getsize(fp)
                            
                shutil.rmtree(item_path)
                deleted_count += 1
                reclaimed_bytes += size
                logger.info(f"Deleted stale clone: {item} (Age: {age/3600:.1f}h, Freed: {size/1024/1024:.2f}MB)")
                
        except Exception as e:
            logger.error(f"Error processing {item_path}: {e}")

    logger.info(f"GC Complete. Deleted {deleted_count} clones. Freed {reclaimed_bytes/1024/1024:.2f} MB total.")

if __name__ == "__main__":
    logger.info("Starting garbage collection...")
    run_gc()

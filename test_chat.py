import asyncio
import httpx

async def main():
    async with httpx.AsyncClient() as client:
        req = {
            "repo_id": "00000000-0000-0000-0000-000000000000",
            "query": "hello"
        }
        async with client.stream("POST", "http://localhost:8003/api/v1/chat/stream", json=req) as r:
            async for chunk in r.aiter_text():
                print(chunk)

asyncio.run(main())

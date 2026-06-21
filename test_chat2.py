import asyncio
import httpx

async def main():
    async with httpx.AsyncClient() as client:
        req = {
            "repo_id": "00000000-0000-0000-0000-000000000000",
            "query": "hello"
        }
        r = await client.post("http://localhost:8005/api/v1/chat/stream", json=req)
        print("Status:", r.status_code)
        print("Body:", r.text)

asyncio.run(main())

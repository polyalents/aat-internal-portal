from sqlalchemy import text
from app.database import engine

import asyncio

async def reset():
    async with engine.begin() as conn:
        await conn.execute(text("DROP SCHEMA public CASCADE"))
        await conn.execute(text("CREATE SCHEMA public"))

asyncio.run(reset())


import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pathlib import Path

# Load environment variables
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

async def reset_sessions():
    mongo_url = os.environ.get('MONGO_URL')
    db_name = os.environ.get('DB_NAME')
    
    if not mongo_url or not db_name:
        print("Error: MONGO_URL or DB_NAME not found in environment variables.")
        return

    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]

    print(f"Connected to database: {db_name}")

    # Clear exam_sessions
    try:
        result = await db.exam_sessions.delete_many({})
        print(f"Deleted {result.deleted_count} documents from 'exam_sessions'.")
    except Exception as e:
        print(f"Error clearing 'exam_sessions': {e}")

    # Clear proctoring_flags
    try:
        result = await db.proctoring_flags.delete_many({})
        print(f"Deleted {result.deleted_count} documents from 'proctoring_flags'.")
    except Exception as e:
        print(f"Error clearing 'proctoring_flags': {e}")

    print("Reset complete.")

if __name__ == "__main__":
    asyncio.run(reset_sessions())

import pymongo
import os
from dotenv import load_dotenv

# Load environment variables to get the new MONGO_URL
# It will load the cluster URL you just added to .env
load_dotenv('.env')

LOCAL_MONGO_URL = "mongodb://localhost:27017"
LOCAL_DB_NAME = "test_database"

ATLAS_DB_NAME = os.getenv("DB_NAME", "test_database")

import urllib.parse

def escape_mongo_url(url: str) -> str:
    if not url: return url
    scheme_end = url.find('://')
    if scheme_end == -1: return url
    prefix = url[:scheme_end+3]
    rest = url[scheme_end+3:]
    
    auth_end = rest.find('/')
    q_end = rest.find('?')
    if auth_end == -1 and q_end == -1:
        authority = rest; path_query = ""
    elif auth_end != -1 and (q_end == -1 or auth_end < q_end):
        authority = rest[:auth_end]; path_query = rest[auth_end:]
    else:
        authority = rest[:q_end]; path_query = rest[q_end:]
        
    at_index = authority.rfind('@')
    if at_index == -1: return url
        
    credentials = authority[:at_index]
    host_info = authority[at_index+1:]
    
    colon_index = credentials.find(':')
    if colon_index == -1:
        user = urllib.parse.quote_plus(urllib.parse.unquote_plus(credentials))
        userinfo = user
    else:
        user = urllib.parse.quote_plus(urllib.parse.unquote_plus(credentials[:colon_index]))
        pwd = urllib.parse.quote_plus(urllib.parse.unquote_plus(credentials[colon_index+1:]))
        userinfo = f"{user}:{pwd}"
        
    return f"{prefix}{userinfo}@{host_info}{path_query}"

ATLAS_MONGO_URL = escape_mongo_url(os.getenv("MONGO_URL", ""))

def seed_cluster():
    if not ATLAS_MONGO_URL or "<username>" in ATLAS_MONGO_URL:
        print("❌ Error: Please update the MONGO_URL in .env with your actual active cluster link.")
        return

    print("🔌 Connecting to your local MongoDB instance...")
    try:
        # Increase timeout just so it doesn't hang forever if local mongo is off
        local_client = pymongo.MongoClient(LOCAL_MONGO_URL, serverSelectionTimeoutMS=2000)
        local_client.admin.command('ping')
        print("✅ Successfully connected to Local MongoDB!")
    except Exception as e:
        print(f"❌ Failed to connect to Local MongoDB (is it running?): {e}")
        return

    local_db = local_client[LOCAL_DB_NAME]

    # Masking password when printing URL to console
    safe_url = ATLAS_MONGO_URL.split('@')[-1] if '@' in ATLAS_MONGO_URL else ATLAS_MONGO_URL
    print(f"\n🌍 Connecting to MongoDB Atlas cluster at: {safe_url} ...")
    
    try:
        atlas_client = pymongo.MongoClient(ATLAS_MONGO_URL, serverSelectionTimeoutMS=5000)
        atlas_client.admin.command('ping')
        print("✅ Successfully connected to MongoDB Atlas!")
    except Exception as e:
        print(f"❌ Connection to Atlas failed (Make sure Network Access IP '0.0.0.0/0' is added): {e}")
        return

    atlas_db = atlas_client[ATLAS_DB_NAME]

    collections = local_db.list_collection_names()
    print(f"\n🔍 Found {len(collections)} collections to migrate: {collections}")

    for coll_name in collections:
        docs = list(local_db[coll_name].find({}))
        if not docs:
            print(f"  ⚠️ Collection '{coll_name}' is empty locally. Skipping.")
            continue
            
        print(f"  📦 Migrating {len(docs)} documents for collection '{coll_name}'...")
        
        # Clear remote collection first to avoid duplicates if run multiple times
        atlas_db[coll_name].delete_many({})
        print(f"     Deleted old data from Atlas '{coll_name}'.")
        
        # Insert data
        atlas_db[coll_name].insert_many(docs)
        print(f"     ✅ Successfully seeded '{coll_name}'.")

    print("\n🎉 All present data seeded to the MongoDB Atlas cluster successfully!")

if __name__ == "__main__":
    seed_cluster()

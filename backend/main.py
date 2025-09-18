from fastapi import FastAPI
from supabase import create_client, Client
import os
from dotenv import load_dotenv

load_dotenv()

app = FastAPI()
supabase: Client = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))

@app.get("/")
async def root():
    return {"message": "Hello from FastAPI!"}

@app.get("/users")
async def get_users():
    response = supabase.table("users").select("*").execute()
    return response.data
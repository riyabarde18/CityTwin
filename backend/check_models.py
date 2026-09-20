from config import GEMINI_API_KEY
from google import genai

client = genai.Client(api_key=GEMINI_API_KEY)
try:
    res = client.models.generate_content(
        model="gemini-3.6-flash",
        contents="Say hello in JSON format: {'message': 'Hello from Gemini 3.6 Flash'}"
    )
    print("SUCCESS!")
    print(res.text)
except Exception as e:
    print(f"Error calling model: {e}")

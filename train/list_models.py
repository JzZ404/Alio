from google import genai
import os

client = genai.Client(api_key=os.environ["GOOGLE_API_KEY"])

for model in client.models.list():
    if "gemma" in model.name.lower():
        print(model.name)

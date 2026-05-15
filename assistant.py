from google import genai
from google.genai import types
import json
import os
from datetime import date

INFO_FILE = "my_info.json"
LOG_FILE = f"med_log_{date.today()}.txt"

client = genai.Client(api_key=os.environ["GOOGLE_API_KEY"])

def load_info():
    with open(INFO_FILE) as f:
        return json.load(f)

def load_todays_log():
    if not os.path.exists(LOG_FILE):
        return "No medications logged yet today."
    with open(LOG_FILE) as f:
        return f.read().strip() or "No medications logged yet today."

def log_entry(text):
    from datetime import datetime
    timestamp = datetime.now().strftime("%I:%M %p")
    with open(LOG_FILE, "a") as f:
        f.write(f"[{timestamp}] {text}\n")

def build_system_prompt(info):
    meds = "\n".join(
        f"  - {m['name']} at {m['time']}" + (" (with food)" if m.get("with_food") else "")
        for m in info["medications"]
    )
    appts = "\n".join(
        f"  - {a['doctor']} ({a['type']}) on {a['date']} at {a['time']}, {a['location']}"
        for a in info["appointments"]
    )
    log = load_todays_log()

    return f"""You are a warm, patient health assistant for {info['name']}, an elderly user.
Speak simply and kindly. Use short sentences. Never diagnose or give medical advice.
Today's date is {date.today().strftime("%B %d, %Y")}.

{info['name']}'s medication schedule:
{meds}

Upcoming appointments:
{appts}

Today's medication log (what has been recorded as taken today):
{log}

If the user says they took a medication, remind them you'll note it and tell them to say "log it" to save it.
If they ask if they took something, check the today's log above and answer based on that.
"""

def main():
    info = load_info()
    chat = client.chats.create(
        model="gemma-4-31b-it",
        config=types.GenerateContentConfig(
            system_instruction=build_system_prompt(info),
        )
    )

    print(f"\nHello {info['name']}! I'm your health assistant. How can I help you today?")
    print("(Type 'quit' to exit, or 'log it' after telling me you took a med to save it)\n")

    last_user_message = ""

    while True:
        user_input = input("You: ").strip()
        if not user_input:
            continue
        if user_input.lower() in ("quit", "exit", "bye"):
            print("Assistant: Take care! Don't forget your medications.")
            break

        if user_input.lower() == "log it":
            log_entry(last_user_message)
            print("Assistant: Got it, I've recorded that for today.\n")
            continue

        last_user_message = user_input
        response = chat.send_message(user_input)
        print(f"\nAssistant: {response.text}\n")

if __name__ == "__main__":
    main()

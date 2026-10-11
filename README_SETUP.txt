TEACHSENSE AI — WINDOWS SETUP

IMPORTANT
- The HTML pages are served by Flask. Do not open index.html by double-clicking it.
- The chat assistant only produces full AI-generated answers after you configure a valid OpenAI API key.
- Without a key, chat uses a limited offline demo reply.
- API usage may cost money depending on your OpenAI account and billing. Keep your key private.

1. Open Command Prompt in this folder:
   In File Explorer, open this folder, click the address bar, type cmd, press Enter.

2. Create a virtual environment (only once):
   py -m venv venv

3. Install Flask:
   venv\Scripts\python.exe -m pip install -r requirements.txt

4. Set your API key for this Command Prompt window (replace the value with your real key):
   set OPENAI_API_KEY=YOUR_REAL_API_KEY
   set OPENAI_MODEL=gpt-4o-mini

   Get a key from the OpenAI platform. Never paste your key into chat, HTML, JavaScript, or a public repository.

5. Start the server:
   venv\Scripts\python.exe app.py

6. Open this address in your browser:
   http://127.0.0.1:5000

Keep the terminal window open while using the website. Press Ctrl+C in the terminal to stop it.

TROUBLESHOOTING
- If port 5000 is busy, close the other Flask server first.
- If an AI provider error appears, check that the key is valid, your account has API access/billing, and the model name is available.
- Check the terminal for errors. Visit http://127.0.0.1:5000/api/health to confirm Flask is running.
- Assessment analysis currently uses local text-matching rules. The chat and lesson planner use the AI API when configured.

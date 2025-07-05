from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional, List
import google.generativeai as genai
import mimetypes

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

genai.configure(api_key="AIzaSyAipM4UdYlk52BmKCh2zciIbcMMVIAhTW8")  # Replace with your actual key

@app.post("/feedback/")
async def get_feedback(text: str = Form(...), files: Optional[List[UploadFile]] = File(None)):
    prompt = text

    if files:
        for file in files:
            contents = await file.read()
            file_type = mimetypes.guess_type(file.filename)[0] or ''
            if file_type.startswith("image/"):
                prompt += f"\n\n🖼️ Image file: {file.filename} attached (binary not shown here)."
            elif file_type.startswith("video/"):
                prompt += f"\n\n🎞️ Video file: {file.filename} attached (binary not shown here)."
            else:
                file_text = contents.decode("utf-8", errors="ignore")
                prompt += f"\n\n📄 File {file.filename} content:\n{file_text}"

    model = genai.GenerativeModel("gemini-1.5-flash")
    response = model.generate_content(prompt)
    return {"response": response.text}

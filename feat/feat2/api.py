import io
import json
from datetime import date

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pydub import AudioSegment

from report import (
    load_report,
    list_report_dates,
    save_report,
    summarize_report,
    transcribe_audio,
)
from prescriptions import parse_prescription, save_prescription, list_prescriptions, SIMULATED_EPIC_MEDS

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/patient")
def get_patient():
    try:
        with open("my_info.json", encoding="utf-8") as f:
            return {"name": json.load(f)["name"]}
    except (FileNotFoundError, KeyError) as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/transcribe")
async def transcribe(request: Request):
    audio_bytes = await request.body()
    if not audio_bytes:
        raise HTTPException(status_code=422, detail="No audio data received")
    try:
        segment = AudioSegment.from_file(io.BytesIO(audio_bytes))
        wav_buffer = io.BytesIO()
        segment.export(wav_buffer, format="wav")
        transcript = transcribe_audio(wav_buffer.getvalue())
        return {"transcript": transcript}
    except Exception as e:
        raise HTTPException(status_code=422, detail=str(e))


class SummarizeRequest(BaseModel):
    patient_name: str
    transcript: str
    notes: str


@app.post("/summarize")
def summarize(req: SummarizeRequest):
    try:
        return summarize_report(req.patient_name, req.transcript, req.notes)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class ReportBody(BaseModel):
    summary: str
    mood: str
    medications_noted: list[str]
    urgent: bool


@app.post("/reports")
def create_report(body: ReportBody):
    try:
        save_report(body.model_dump())
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    return {"date": date.today().isoformat()}


@app.get("/reports")
def get_reports():
    return {"dates": list_report_dates()}


@app.get("/reports/{report_date}")
def get_report(report_date: str):
    report = load_report(report_date)
    if report is None:
        raise HTTPException(status_code=404, detail="No report for this date")
    return report


@app.post("/prescriptions/upload")
async def upload_prescription(request: Request):
    pdf_bytes = await request.body()
    if not pdf_bytes:
        raise HTTPException(status_code=422, detail="No PDF data received")
    try:
        medications = parse_prescription(pdf_bytes)
        row = save_prescription(medications, "upload")
        return row
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/prescriptions/sync")
def sync_prescription():
    try:
        return save_prescription(SIMULATED_EPIC_MEDS, "simulated_epic")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/prescriptions")
def get_prescriptions():
    try:
        return {"prescriptions": list_prescriptions()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

import io
import json
from datetime import date, datetime

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
from medical_ai import (
    triage_conversation,
    explain_report_question,
    save_symptom_check,
    compile_caregiver_logs,
    compile_structured_report,
    format_report_for_family,
)
import os
from supabase import create_client

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


class TriageRequest(BaseModel):
    conversation: list[dict]


def _load_profile() -> dict:
    with open("my_info.json", encoding="utf-8") as f:
        return json.load(f)


def _load_recent_reports(n: int = 7) -> list[dict]:
    dates = list_report_dates()[:n]
    reports = [load_report(d) for d in dates]
    return [r for r in reports if r is not None]


@app.post("/symptom-check/triage")
def symptom_check_triage(req: TriageRequest):
    if not req.conversation:
        raise HTTPException(status_code=422, detail="conversation must not be empty")
    try:
        profile = _load_profile()
    except (FileNotFoundError, KeyError) as e:
        raise HTTPException(status_code=500, detail=str(e))
    reports = _load_recent_reports()
    started_at = datetime.now().isoformat(timespec="seconds")
    try:
        result = triage_conversation(profile, reports, req.conversation)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    if not result.get("needs_followup"):
        save_symptom_check(
            started_at=started_at,
            conversation=req.conversation,
            result=result,
        )
    return result


class ExplainRequest(BaseModel):
    report_date: str
    question: str


@app.post("/symptom-check/explain")
def symptom_check_explain(req: ExplainRequest):
    report = load_report(req.report_date)
    if report is None:
        raise HTTPException(status_code=404, detail=f"No report for date {req.report_date}")
    try:
        profile = _load_profile()
    except (FileNotFoundError, KeyError) as e:
        raise HTTPException(status_code=500, detail=str(e))
    try:
        return explain_report_question(profile, report, req.question)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================
# Caregiver logs — compile today's voice notes into one report
# =============================================================

_supabase_client = None

def _get_supabase():
    global _supabase_client
    if _supabase_client is None:
        url = os.environ["SUPABASE_URL"]
        key = os.environ["SUPABASE_KEY"]
        _supabase_client = create_client(url, key)
    return _supabase_client


class CompileLogsRequest(BaseModel):
    caregiver_id: str
    patient_id: str
    patient_name: str


@app.post("/caregiver-logs/compile")
def compile_logs(req: CompileLogsRequest):
    """
    Compile today's caregiver_logs for {caregiver_id, patient_id} into a
    STRUCTURED VisitReport, persist it as a row in compiled_reports, and
    return the report id + structured fields. The frontend renders this as
    a tappable card in the chat that opens the full report template.
    """
    try:
        sb = _get_supabase()
        today = date.today().isoformat()
        result = (
            sb.table("caregiver_logs")
            .select("*")
            .eq("caregiver_id", req.caregiver_id)
            .eq("patient_id", req.patient_id)
            .eq("visit_date", today)
            .order("created_at")
            .execute()
        )
        logs = result.data or []
        structured = compile_structured_report(req.patient_name, logs)

        visit_time = datetime.now().strftime("%H:%M")
        insert_res = (
            sb.table("compiled_reports")
            .insert({
                "caregiver_id": req.caregiver_id,
                "patient_id": req.patient_id,
                "patient_name": req.patient_name,
                "visit_date": today,
                "visit_time": visit_time,
                "report": structured,
                "source_log_count": len(logs),
            })
            .execute()
        )
        row = (insert_res.data or [{}])[0]
        return {
            "id": row.get("id"),
            "report": structured,
            "log_count": len(logs),
            "visit_date": today,
            "visit_time": visit_time,
        }
    except KeyError as e:
        raise HTTPException(status_code=500, detail=f"Missing env var: {e}")
    except Exception as e:
        msg = str(e)
        if "INTERNAL" in msg.upper() or "UNAVAILABLE" in msg.upper():
            raise HTTPException(
                status_code=503,
                detail="AI service hiccuped. Tap Compile again — it's usually a one-off.",
            )
        raise HTTPException(status_code=500, detail=msg)


@app.get("/caregiver-logs/report/{report_id}")
def get_compiled_report(report_id: str):
    try:
        sb = _get_supabase()
        result = (
            sb.table("compiled_reports").select("*").eq("id", report_id).single().execute()
        )
        row = result.data
        if not row:
            raise HTTPException(status_code=404, detail="report not found")
        return row
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class FormatReportRequest(BaseModel):
    patient_name: str
    visit_date: str
    report: dict


@app.post("/caregiver-logs/report/format-for-family")
def format_for_family(req: FormatReportRequest):
    return {"text": format_report_for_family(req.patient_name, req.visit_date, req.report)}

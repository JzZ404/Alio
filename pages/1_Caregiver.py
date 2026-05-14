import json
import streamlit as st
from report import transcribe_audio, summarize_report, save_report


def _load_patient_name() -> str:
    try:
        with open("my_info.json", encoding="utf-8") as f:
            return json.load(f)["name"]
    except (FileNotFoundError, KeyError) as e:
        st.error(f"Could not load patient info: {e}")
        st.stop()


st.title("Caregiver Report")
patient_name = _load_patient_name()

audio = st.audio_input("Record voice notes")
notes = st.text_area("Written notes (optional)")

can_submit = audio is not None or bool(notes.strip())

if st.button("Submit Report", disabled=not can_submit):
    with st.spinner("Processing report..."):
        transcript = ""
        if audio is not None:
            try:
                transcript = transcribe_audio(audio.read())
            except Exception as exc:
                st.warning(f"Could not transcribe audio ({exc}) — using written notes only.")
        try:
            result = summarize_report(patient_name, transcript, notes.strip())
            save_report(result)
            st.success("Report submitted.")
        except Exception as e:
            st.error(f"Could not generate report: {e}")

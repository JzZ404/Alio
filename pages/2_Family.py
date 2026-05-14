import time

import streamlit as st
from report import list_report_dates, load_report

st.title("Family Report")

dates = list_report_dates()

if not dates:
    st.info("No reports have been submitted yet.")
    time.sleep(30)
    st.rerun()
    st.stop()

selected = st.selectbox("Select date", dates, index=0)
report = load_report(selected)

if report is None:
    st.info("No report submitted for this date yet.")
else:
    if report.get("urgent"):
        st.error("Urgent: Please contact the caregiver")

    st.subheader("Summary")
    st.write(report.get("summary", "No summary available."))

    col1, col2, col3 = st.columns(3)
    with col1:
        st.metric("Mood", report.get("mood", "—"))
    with col2:
        meds = report.get("medications_noted", [])
        st.metric("Medications", ", ".join(meds) if meds else "None")
    with col3:
        urgent = report.get("urgent", False)
        st.metric("Status", "Urgent" if urgent else "All Good")

    st.caption(f"Submitted: {report.get('timestamp', 'Unknown')}")

time.sleep(30)
st.rerun()

import os
import uuid
from datetime import datetime, timedelta

import pandas as pd


INPUT_FOLDER = "./synthetic_data"
OUTPUT_FOLDER = "./synthetic_data"


def ensure_output_folder():
    os.makedirs(OUTPUT_FOLDER, exist_ok=True)


def require_csv(filename):
    path = os.path.join(INPUT_FOLDER, filename)
    if not os.path.exists(path):
        raise FileNotFoundError(
            f"Required file not found: {os.path.abspath(path)}. "
            "Generate the valid CSVs first with scripts/m06_m07_synthetic_data.py."
        )
    return pd.read_csv(path)


def generate_id(prefix):
    return f"{prefix}_{uuid.uuid4().hex[:8]}"


def iso_dt(days_offset=0):
    base = datetime(2023, 6, 15, 10, 0, 0) + timedelta(days=days_offset)
    return base.strftime("%Y-%m-%dT%H:%M:%S")


def iso_date(days_offset=0):
    base = datetime(2023, 6, 15) + timedelta(days=days_offset)
    return base.strftime("%Y-%m-%d")


def write_csv(name, rows):
    pd.DataFrame(rows).to_csv(os.path.join(OUTPUT_FOLDER, name), index=False)


def generate_lead_invalid_rows(valid_leads):
    first_lead_id = str(valid_leads.iloc[0]["lead_id"])

    return [
        {
            "test_case": "missing_lead_id",
            "lead_id": "",
            "full_name": "Missing Lead ID",
            "first_name": "No",
            "last_name": "Id",
            "company": "ABC Ltd",
            "source": "ads",
            "owner": "Rep A",
            "industry": "IT",
            "region": "US",
            "lead_score": 55,
            "intent_score": 61,
            "email": "missing-id@example.com",
            "job_title": "Manager",
            "segment": "SMB",
        },
        {
            "test_case": "duplicate_lead_id",
            "lead_id": first_lead_id,
            "full_name": "Duplicate Lead",
            "first_name": "Dupe",
            "last_name": "Lead",
            "company": "XYZ Corp",
            "source": "linkedin",
            "owner": "Rep B",
            "industry": "Finance",
            "region": "UK",
            "lead_score": 72,
            "intent_score": 44,
            "email": "duplicate-lead@example.com",
            "job_title": "Director",
            "segment": "Enterprise",
        },
        {
            "test_case": "invalid_email_format",
            "lead_id": generate_id("LEAD"),
            "full_name": "Bad Email",
            "first_name": "Bad",
            "last_name": "Email",
            "company": "TechSoft",
            "source": "email",
            "owner": "Rep C",
            "industry": "Retail",
            "region": "PK",
            "lead_score": 33,
            "intent_score": 90,
            "email": "not-an-email",
            "job_title": "Engineer",
            "segment": "Mid-Market",
        },
        {
            "test_case": "lead_score_not_numeric",
            "lead_id": generate_id("LEAD"),
            "full_name": "Bad Lead Score",
            "first_name": "Bad",
            "last_name": "Score",
            "company": "DataWorks",
            "source": "webinar",
            "owner": "Rep A",
            "industry": "Healthcare",
            "region": "CA",
            "lead_score": "abc",
            "intent_score": 51,
            "email": "bad-lead-score@example.com",
            "job_title": "CEO",
            "segment": "SMB",
        },
        {
            "test_case": "intent_score_not_numeric",
            "lead_id": generate_id("LEAD"),
            "full_name": "Bad Intent Score",
            "first_name": "Bad",
            "last_name": "Intent",
            "company": "CloudAxis",
            "source": "referral",
            "owner": "Rep C",
            "industry": "Education",
            "region": "UAE",
            "lead_score": 60,
            "intent_score": "xyz",
            "email": "bad-intent-score@example.com",
            "job_title": "Marketing Lead",
            "segment": "Enterprise",
        },
    ]


def generate_campaign_invalid_rows(valid_campaigns):
    first_campaign_id = str(valid_campaigns.iloc[0]["campaign_id"])

    return [
        {
            "test_case": "missing_campaign_id",
            "campaign_id": "",
            "name": "Missing Campaign ID",
            "channel": "email",
            "description": "Bad row",
            "tags": "tag1,tag2",
            "start_date": iso_date(0),
            "end_date": iso_date(10),
            "status": "active",
            "spend": 2000,
        },
        {
            "test_case": "duplicate_campaign_id",
            "campaign_id": first_campaign_id,
            "name": "Duplicate Campaign",
            "channel": "ads",
            "description": "Bad row",
            "tags": "tag1",
            "start_date": iso_date(1),
            "end_date": iso_date(9),
            "status": "active",
            "spend": 2500,
        },
        {
            "test_case": "missing_name",
            "campaign_id": generate_id("CMP"),
            "name": "",
            "channel": "email",
            "description": "Bad row",
            "tags": "tag2",
            "start_date": iso_date(1),
            "end_date": iso_date(4),
            "status": "active",
            "spend": 1500,
        },
        {
            "test_case": "invalid_channel",
            "campaign_id": generate_id("CMP"),
            "name": "Invalid Channel",
            "channel": "tv",
            "description": "Bad row",
            "tags": "tag3",
            "start_date": iso_date(2),
            "end_date": iso_date(12),
            "status": "active",
            "spend": 5000,
        },
        {
            "test_case": "invalid_status",
            "campaign_id": generate_id("CMP"),
            "name": "Invalid Status",
            "channel": "linkedin",
            "description": "Bad row",
            "tags": "tag4",
            "start_date": iso_date(3),
            "end_date": iso_date(13),
            "status": "paused",
            "spend": 1200,
        },
        {
            "test_case": "negative_spend",
            "campaign_id": generate_id("CMP"),
            "name": "Negative Spend",
            "channel": "webinar",
            "description": "Bad row",
            "tags": "tag5",
            "start_date": iso_date(4),
            "end_date": iso_date(14),
            "status": "active",
            "spend": -1,
        },
        {
            "test_case": "end_date_before_start_date",
            "campaign_id": generate_id("CMP"),
            "name": "Bad Date Order",
            "channel": "other",
            "description": "Bad row",
            "tags": "tag6",
            "start_date": "2023-12-01",
            "end_date": "2023-01-01",
            "status": "active",
            "spend": 3200,
        },
    ]


def generate_touch_invalid_rows(valid_leads, valid_campaigns):
    lead_id = str(valid_leads.iloc[0]["lead_id"])
    campaign_id = str(valid_campaigns.iloc[0]["campaign_id"])

    return [
        {
            "test_case": "missing_lead_id",
            "lead_id": "",
            "campaign_id": campaign_id,
            "channel": "email",
            "type": "email_open",
            "touched_at": iso_dt(0),
            "status": "active",
            "metadata": "bad row",
        },
        {
            "test_case": "missing_campaign_id",
            "lead_id": lead_id,
            "campaign_id": "",
            "channel": "email",
            "type": "email_open",
            "touched_at": iso_dt(1),
            "status": "active",
            "metadata": "bad row",
        },
        {
            "test_case": "lead_fk_missing",
            "lead_id": "LEAD_DOES_NOT_EXIST",
            "campaign_id": campaign_id,
            "channel": "email",
            "type": "email_open",
            "touched_at": iso_dt(2),
            "status": "active",
            "metadata": "bad row",
        },
        {
            "test_case": "campaign_fk_missing",
            "lead_id": lead_id,
            "campaign_id": "CMP_DOES_NOT_EXIST",
            "channel": "email",
            "type": "email_open",
            "touched_at": iso_dt(3),
            "status": "active",
            "metadata": "bad row",
        },
        {
            "test_case": "invalid_channel",
            "lead_id": lead_id,
            "campaign_id": campaign_id,
            "channel": "sms",
            "type": "email_open",
            "touched_at": iso_dt(4),
            "status": "active",
            "metadata": "bad row",
        },
        {
            "test_case": "invalid_type",
            "lead_id": lead_id,
            "campaign_id": campaign_id,
            "channel": "email",
            "type": "bad_touch_type",
            "touched_at": iso_dt(5),
            "status": "active",
            "metadata": "bad row",
        },
        {
            "test_case": "invalid_status",
            "lead_id": lead_id,
            "campaign_id": campaign_id,
            "channel": "email",
            "type": "email_open",
            "touched_at": iso_dt(6),
            "status": "paused",
            "metadata": "bad row",
        },
        {
            "test_case": "invalid_touched_at",
            "lead_id": lead_id,
            "campaign_id": campaign_id,
            "channel": "email",
            "type": "email_open",
            "touched_at": "not-a-date",
            "status": "active",
            "metadata": "bad row",
        },
    ]


def generate_deal_invalid_rows(valid_leads):
    lead_id = str(valid_leads.iloc[0]["lead_id"])

    return [
        {
            "test_case": "missing_deal_id",
            "deal_id": "",
            "lead_id": lead_id,
            "revenue": 2500,
            "currency": "USD",
            "closed_won": "true",
            "closed_at": iso_dt(0),
        },
        {
            "test_case": "missing_lead_id",
            "deal_id": generate_id("DEAL"),
            "lead_id": "",
            "revenue": 2500,
            "currency": "USD",
            "closed_won": "true",
            "closed_at": iso_dt(1),
        },
        {
            "test_case": "lead_fk_missing",
            "deal_id": generate_id("DEAL"),
            "lead_id": "LEAD_DOES_NOT_EXIST",
            "revenue": 2500,
            "currency": "USD",
            "closed_won": "true",
            "closed_at": iso_dt(2),
        },
        {
            "test_case": "negative_revenue",
            "deal_id": generate_id("DEAL"),
            "lead_id": lead_id,
            "revenue": -500,
            "currency": "USD",
            "closed_won": "true",
            "closed_at": iso_dt(3),
        },
        {
            "test_case": "revenue_not_numeric",
            "deal_id": generate_id("DEAL"),
            "lead_id": lead_id,
            "revenue": "abc",
            "currency": "USD",
            "closed_won": "true",
            "closed_at": iso_dt(4),
        },
        {
            "test_case": "invalid_currency",
            "deal_id": generate_id("DEAL"),
            "lead_id": lead_id,
            "revenue": 3000,
            "currency": "AUD",
            "closed_won": "true",
            "closed_at": iso_dt(5),
        },
        {
            "test_case": "invalid_closed_won",
            "deal_id": generate_id("DEAL"),
            "lead_id": lead_id,
            "revenue": 3000,
            "currency": "USD",
            "closed_won": "maybe",
            "closed_at": "",
        },
        {
            "test_case": "closed_won_true_missing_closed_at",
            "deal_id": generate_id("DEAL"),
            "lead_id": lead_id,
            "revenue": 3000,
            "currency": "USD",
            "closed_won": "true",
            "closed_at": "",
        },
    ]


def generate_stage_invalid_rows(valid_leads):
    lead_id = str(valid_leads.iloc[0]["lead_id"])

    return [
        {
            "test_case": "missing_lead_id",
            "lead_id": "",
            "stage_name": "MQL",
            "entered_at": iso_dt(0),
            "exited_at": "",
            "stage_status": "active",
            "next_stage": "",
            "exit_reason": "",
            "notes": "bad row",
        },
        {
            "test_case": "lead_fk_missing",
            "lead_id": "LEAD_DOES_NOT_EXIST",
            "stage_name": "MQL",
            "entered_at": iso_dt(1),
            "exited_at": "",
            "stage_status": "active",
            "next_stage": "",
            "exit_reason": "",
            "notes": "bad row",
        },
        {
            "test_case": "missing_stage_name",
            "lead_id": lead_id,
            "stage_name": "",
            "entered_at": iso_dt(2),
            "exited_at": "",
            "stage_status": "active",
            "next_stage": "",
            "exit_reason": "",
            "notes": "bad row",
        },
        {
            "test_case": "missing_entered_at",
            "lead_id": lead_id,
            "stage_name": "SQL",
            "entered_at": "",
            "exited_at": "",
            "stage_status": "active",
            "next_stage": "",
            "exit_reason": "",
            "notes": "bad row",
        },
        {
            "test_case": "invalid_entered_at",
            "lead_id": lead_id,
            "stage_name": "Proposal",
            "entered_at": "not-a-date",
            "exited_at": "",
            "stage_status": "active",
            "next_stage": "",
            "exit_reason": "",
            "notes": "bad row",
        },
        {
            "test_case": "exited_before_entered",
            "lead_id": lead_id,
            "stage_name": "Negotiation",
            "entered_at": "2023-06-10T10:00:00",
            "exited_at": "2023-06-01T10:00:00",
            "stage_status": "completed",
            "next_stage": "Closed",
            "exit_reason": "",
            "notes": "bad row",
        },
        {
            "test_case": "invalid_stage_status",
            "lead_id": lead_id,
            "stage_name": "Closed",
            "entered_at": iso_dt(3),
            "exited_at": "",
            "stage_status": "paused",
            "next_stage": "",
            "exit_reason": "",
            "notes": "bad row",
        },
    ]


def generate_interaction_invalid_rows(valid_leads, valid_campaigns):
    lead_id = str(valid_leads.iloc[0]["lead_id"])
    campaign_id = str(valid_campaigns.iloc[0]["campaign_id"])

    return [
        {
            "test_case": "missing_lead_id",
            "interaction_id": generate_id("INT"),
            "lead_id": "",
            "timestamp": iso_dt(0),
            "interaction_type": "email",
            "channel": "email",
            "campaign_id": "",
            "outcome": "positive",
            "engagement_score": 8,
            "notes": "bad row",
        },
        {
            "test_case": "lead_fk_missing",
            "interaction_id": generate_id("INT"),
            "lead_id": "LEAD_DOES_NOT_EXIST",
            "timestamp": iso_dt(1),
            "interaction_type": "email",
            "channel": "email",
            "campaign_id": "",
            "outcome": "positive",
            "engagement_score": 8,
            "notes": "bad row",
        },
        {
            "test_case": "missing_timestamp",
            "interaction_id": generate_id("INT"),
            "lead_id": lead_id,
            "timestamp": "",
            "interaction_type": "call",
            "channel": "phone",
            "campaign_id": "",
            "outcome": "positive",
            "engagement_score": 7,
            "notes": "bad row",
        },
        {
            "test_case": "invalid_timestamp",
            "interaction_id": generate_id("INT"),
            "lead_id": lead_id,
            "timestamp": "not-a-date",
            "interaction_type": "meeting",
            "channel": "zoom",
            "campaign_id": "",
            "outcome": "positive",
            "engagement_score": 6,
            "notes": "bad row",
        },
        {
            "test_case": "missing_interaction_type",
            "interaction_id": generate_id("INT"),
            "lead_id": lead_id,
            "timestamp": iso_dt(2),
            "interaction_type": "",
            "channel": "email",
            "campaign_id": "",
            "outcome": "positive",
            "engagement_score": 5,
            "notes": "bad row",
        },
        {
            "test_case": "invalid_interaction_type",
            "interaction_id": generate_id("INT"),
            "lead_id": lead_id,
            "timestamp": iso_dt(3),
            "interaction_type": "sms",
            "channel": "email",
            "campaign_id": "",
            "outcome": "positive",
            "engagement_score": 4,
            "notes": "bad row",
        },
        {
            "test_case": "campaign_fk_missing",
            "interaction_id": generate_id("INT"),
            "lead_id": lead_id,
            "timestamp": iso_dt(4),
            "interaction_type": "email",
            "channel": "email",
            "campaign_id": "CMP_DOES_NOT_EXIST",
            "outcome": "positive",
            "engagement_score": 5,
            "notes": "bad row",
        },
        {
            "test_case": "engagement_score_too_high",
            "interaction_id": generate_id("INT"),
            "lead_id": lead_id,
            "timestamp": iso_dt(5),
            "interaction_type": "demo",
            "channel": "zoom",
            "campaign_id": campaign_id,
            "outcome": "positive",
            "engagement_score": 99,
            "notes": "bad row",
        },
        {
            "test_case": "engagement_score_not_numeric",
            "interaction_id": generate_id("INT"),
            "lead_id": lead_id,
            "timestamp": iso_dt(6),
            "interaction_type": "email",
            "channel": "email",
            "campaign_id": "",
            "outcome": "positive",
            "engagement_score": "abc",
            "notes": "bad row",
        },
    ]


def main():
    ensure_output_folder()

    valid_leads = require_csv("leads_valid.csv")
    valid_campaigns = require_csv("campaigns_valid.csv")

    write_csv("leads_invalid_cases.csv", generate_lead_invalid_rows(valid_leads))
    write_csv("campaigns_invalid_cases.csv", generate_campaign_invalid_rows(valid_campaigns))
    write_csv("touches_invalid_cases.csv", generate_touch_invalid_rows(valid_leads, valid_campaigns))
    write_csv("deals_invalid_cases.csv", generate_deal_invalid_rows(valid_leads))
    write_csv("stage_history_invalid_cases.csv", generate_stage_invalid_rows(valid_leads))
    write_csv("interactions_invalid_cases.csv", generate_interaction_invalid_rows(valid_leads, valid_campaigns))

    print(f"Invalid case CSVs saved in {os.path.abspath(OUTPUT_FOLDER)}")


if __name__ == "__main__":
    main()

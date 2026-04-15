import os
import random
import uuid
from datetime import datetime, timedelta

import pandas as pd


def get_env_int(name, default):
    raw = os.getenv(name)
    if raw is None or raw == "":
        return default
    return int(raw)


def get_env_float(name, default):
    raw = os.getenv(name)
    if raw is None or raw == "":
        return default
    return float(raw)


NUM_LEADS = get_env_int("NUM_LEADS", 5000)
NUM_CAMPAIGNS = get_env_int("NUM_CAMPAIGNS", 300)
TOUCHES_PER_LEAD = (
    get_env_int("TOUCHES_MIN", 2),
    get_env_int("TOUCHES_MAX", 8),
)
INTERACTIONS_PER_LEAD = (
    get_env_int("INTERACTIONS_MIN", 2),
    get_env_int("INTERACTIONS_MAX", 6),
)
STAGES_PER_LEAD = (
    get_env_int("STAGES_MIN", 1),
    get_env_int("STAGES_MAX", 5),
)
DEAL_PROBABILITY = get_env_float("DEAL_PROBABILITY", 0.45)

OUTPUT_FOLDER = "./synthetic_data"

FIRST_NAMES = ["Ali", "Sara", "John", "Ayesha", "David", "Fatima", "Omar", "Emma", "Noah", "Zara"]
LAST_NAMES = ["Khan", "Ahmed", "Smith", "Malik", "Lee", "Brown", "Wilson", "Iqbal", "Shah", "Ali"]
COMPANIES = ["ABC Ltd", "XYZ Corp", "TechSoft", "DataWorks", "MarketGuru", "Nova AI", "Pixel Labs", "CloudAxis"]
SOURCES = ["ads", "linkedin", "email", "referral", "webinar"]
OWNERS = ["Rep A", "Rep B", "Rep C"]
INDUSTRIES = ["IT", "Finance", "Healthcare", "Retail", "Education"]
REGIONS = ["US", "UK", "UAE", "PK", "CA"]
SEGMENTS = ["SMB", "Mid-Market", "Enterprise"]
JOB_TITLES = ["Manager", "Director", "Engineer", "CEO", "VP Sales", "Marketing Lead"]

CAMPAIGN_CHANNELS = ["email", "ads", "linkedin", "webinar", "other"]
CAMPAIGN_STATUSES = ["active", "archived"]

TOUCH_TYPES = ["email_open", "ad_click", "webinar", "email_click", "form_submit", "other"]
TOUCH_CHANNELS = ["email", "ads", "linkedin", "webinar", "other"]
TOUCH_STATUSES = ["active", "archived"]

DEAL_CURRENCIES = ["USD", "PKR", "EUR"]

STAGE_SEQUENCE = ["MQL", "SQL", "Proposal", "Negotiation", "Closed"]
STAGE_STATUSES = ["active", "completed", "dropped"]

INTERACTION_TYPES = ["call", "email", "meeting", "demo"]
INTERACTION_CHANNELS = ["phone", "email", "zoom", "linkedin"]
INTERACTION_OUTCOMES = ["positive", "negative", "no response", "follow-up needed"]

DATE_START = datetime(2023, 1, 1)
DATE_END = datetime(2023, 12, 31)


def ensure_output_folder():
    os.makedirs(OUTPUT_FOLDER, exist_ok=True)


def random_date(start, end):
    return start + timedelta(seconds=random.randint(0, int((end - start).total_seconds())))


def iso_dt(value):
    if value is None:
        return ""
    return value.strftime("%Y-%m-%dT%H:%M:%S")


def iso_date(value):
    if value is None:
        return ""
    return value.strftime("%Y-%m-%d")


def generate_id(prefix):
    return f"{prefix}_{uuid.uuid4().hex[:8]}"


def random_name():
    first = random.choice(FIRST_NAMES)
    last = random.choice(LAST_NAMES)
    return first, last, f"{first} {last}"


def maybe_blank(value, probability=0.2):
    return "" if random.random() < probability else value


def write_csv(name, dataframe):
    dataframe.to_csv(os.path.join(OUTPUT_FOLDER, name), index=False)


def generate_leads(count):
    rows = []

    for index in range(count):
        first, last, full = random_name()
        rows.append(
            {
                "lead_id": generate_id("LEAD"),
                "full_name": full,
                "first_name": first,
                "last_name": last,
                "company": random.choice(COMPANIES),
                "source": random.choice(SOURCES),
                "owner": random.choice(OWNERS),
                "industry": random.choice(INDUSTRIES),
                "region": random.choice(REGIONS),
                "lead_score": random.randint(0, 100),
                "intent_score": random.randint(0, 100),
                "email": f"user{index}@example.com",
                "job_title": random.choice(JOB_TITLES),
                "segment": random.choice(SEGMENTS),
            }
        )

    valid_df = pd.DataFrame(rows)
    first_lead_id = valid_df.iloc[0]["lead_id"]

    invalid_rows = [
        {
            "lead_id": "",
            "full_name": "Missing Lead ID",
            "email": "missing@example.com",
        },
        {
            "lead_id": first_lead_id,
            "full_name": "Duplicate Lead",
            "email": "duplicate@example.com",
        },
        {
            "lead_id": generate_id("LEAD"),
            "full_name": "Bad Email Lead",
            "email": "not-an-email",
        },
        {
            "lead_id": generate_id("LEAD"),
            "full_name": "Bad Score Lead",
            "lead_score": "abc",
            "intent_score": 50,
            "email": "badscore@example.com",
        },
    ]

    return valid_df, pd.DataFrame(invalid_rows)


def generate_campaigns(count):
    rows = []

    for index in range(count):
        start_dt = random_date(datetime(2023, 1, 1), datetime(2023, 9, 1))
        end_dt = start_dt + timedelta(days=random.randint(7, 90))
        rows.append(
            {
                "campaign_id": generate_id("CMP"),
                "name": f"Campaign {index + 1}",
                "channel": random.choice(CAMPAIGN_CHANNELS),
                "description": "Marketing campaign",
                "tags": "tag1,tag2",
                "start_date": iso_date(start_dt),
                "end_date": iso_date(end_dt),
                "status": random.choice(CAMPAIGN_STATUSES),
                "spend": random.randint(1000, 10000),
            }
        )

    invalid_rows = [
        {
            "campaign_id": "",
            "name": "Missing Campaign ID",
            "channel": "email",
            "spend": 2000,
        },
        {
            "campaign_id": generate_id("CMP"),
            "name": "",
            "channel": "email",
            "spend": 2000,
        },
        {
            "campaign_id": generate_id("CMP"),
            "name": "Bad Channel",
            "channel": "invalid_channel",
            "spend": 1500,
        },
        {
            "campaign_id": generate_id("CMP"),
            "name": "Bad Date Range",
            "channel": "ads",
            "start_date": "2023-12-01",
            "end_date": "2023-01-01",
            "spend": 3000,
        },
        {
            "campaign_id": generate_id("CMP"),
            "name": "Negative Spend",
            "channel": "linkedin",
            "spend": -100,
        },
    ]

    return pd.DataFrame(rows), pd.DataFrame(invalid_rows)


def generate_touches(leads_df, campaigns_df):
    rows = []
    lead_ids = list(leads_df["lead_id"])

    for lead_id in lead_ids:
        for _ in range(random.randint(*TOUCHES_PER_LEAD)):
            campaign = campaigns_df.sample(1).iloc[0]
            rows.append(
                {
                    "lead_id": lead_id,
                    "campaign_id": campaign["campaign_id"],
                    "channel": random.choice(TOUCH_CHANNELS),
                    "type": random.choice(TOUCH_TYPES),
                    "touched_at": iso_dt(random_date(DATE_START, DATE_END)),
                    "status": random.choice(TOUCH_STATUSES),
                    "metadata": maybe_blank("Imported from generator", probability=0.5),
                }
            )

    invalid_rows = [
        {
            "lead_id": "LEAD_DOES_NOT_EXIST",
            "campaign_id": campaigns_df.iloc[0]["campaign_id"],
            "channel": "email",
            "type": "email_open",
            "touched_at": iso_dt(random_date(DATE_START, DATE_END)),
            "status": "active",
            "metadata": "",
        },
        {
            "lead_id": lead_ids[0],
            "campaign_id": "CMP_DOES_NOT_EXIST",
            "channel": "email",
            "type": "email_open",
            "touched_at": iso_dt(random_date(DATE_START, DATE_END)),
            "status": "active",
            "metadata": "",
        },
        {
            "lead_id": lead_ids[0],
            "campaign_id": campaigns_df.iloc[0]["campaign_id"],
            "channel": "email",
            "type": "bad_touch_type",
            "touched_at": iso_dt(random_date(DATE_START, DATE_END)),
            "status": "active",
            "metadata": "",
        },
        {
            "lead_id": lead_ids[0],
            "campaign_id": campaigns_df.iloc[0]["campaign_id"],
            "channel": "email",
            "type": "email_open",
            "touched_at": "not-a-date",
            "status": "active",
            "metadata": "",
        },
        {
            "lead_id": "",
            "campaign_id": campaigns_df.iloc[0]["campaign_id"],
            "channel": "email",
            "type": "email_open",
            "touched_at": iso_dt(random_date(DATE_START, DATE_END)),
            "status": "active",
            "metadata": "",
        },
    ]

    return pd.DataFrame(rows), pd.DataFrame(invalid_rows)


def generate_deals(leads_df):
    rows = []
    lead_ids = list(leads_df["lead_id"])

    for lead_id in lead_ids:
        if random.random() >= DEAL_PROBABILITY:
            continue

        closed_won = random.choice(["true", "false"])
        closed_at = random_date(datetime(2023, 6, 1), datetime(2023, 12, 31)) if closed_won == "true" else None
        rows.append(
            {
                "deal_id": generate_id("DEAL"),
                "lead_id": lead_id,
                "revenue": round(random.uniform(1000, 50000), 2),
                "currency": random.choice(DEAL_CURRENCIES),
                "closed_won": closed_won,
                "closed_at": iso_dt(closed_at),
            }
        )

    invalid_rows = [
        {
            "deal_id": "",
            "lead_id": lead_ids[0],
            "revenue": 2500,
            "currency": "USD",
            "closed_won": "true",
            "closed_at": iso_dt(random_date(DATE_START, DATE_END)),
        },
        {
            "deal_id": generate_id("DEAL"),
            "lead_id": "LEAD_DOES_NOT_EXIST",
            "revenue": 2500,
            "currency": "USD",
            "closed_won": "true",
            "closed_at": iso_dt(random_date(DATE_START, DATE_END)),
        },
        {
            "deal_id": generate_id("DEAL"),
            "lead_id": lead_ids[0],
            "revenue": -500,
            "currency": "USD",
            "closed_won": "true",
            "closed_at": iso_dt(random_date(DATE_START, DATE_END)),
        },
        {
            "deal_id": generate_id("DEAL"),
            "lead_id": lead_ids[0],
            "revenue": 3000,
            "currency": "AUD",
            "closed_won": "true",
            "closed_at": iso_dt(random_date(DATE_START, DATE_END)),
        },
        {
            "deal_id": generate_id("DEAL"),
            "lead_id": lead_ids[0],
            "revenue": 3000,
            "currency": "USD",
            "closed_won": "maybe",
            "closed_at": "",
        },
        {
            "deal_id": generate_id("DEAL"),
            "lead_id": lead_ids[0],
            "revenue": 3000,
            "currency": "USD",
            "closed_won": "true",
            "closed_at": "",
        },
    ]

    return pd.DataFrame(rows), pd.DataFrame(invalid_rows)


def generate_stages(leads_df):
    rows = []
    lead_ids = list(leads_df["lead_id"])

    for lead_id in lead_ids:
        stage_count = random.randint(*STAGES_PER_LEAD)
        selected_stages = STAGE_SEQUENCE[:stage_count]
        current_date = random_date(datetime(2023, 1, 1), datetime(2023, 8, 1))
        dropped = random.random() < 0.15 and stage_count > 1
        drop_index = random.randint(0, stage_count - 1) if dropped else None

        for index, stage_name in enumerate(selected_stages):
            entered_at = current_date
            is_last = index == len(selected_stages) - 1
            is_dropped = dropped and index == drop_index

            if is_last and not is_dropped and random.random() < 0.5:
                exited_at = None
                stage_status = "active"
                next_stage = ""
            else:
                exited_at = entered_at + timedelta(days=random.randint(5, 30))
                current_date = exited_at + timedelta(days=random.randint(1, 5))
                stage_status = "dropped" if is_dropped else "completed"
                next_stage = "" if is_last or is_dropped else selected_stages[index + 1]

            rows.append(
                {
                    "lead_id": lead_id,
                    "stage_name": stage_name,
                    "entered_at": iso_dt(entered_at),
                    "exited_at": iso_dt(exited_at),
                    "stage_status": stage_status,
                    "next_stage": next_stage,
                    "exit_reason": random.choice(["No budget", "Lost to competitor", "No response", ""]) if stage_status == "dropped" else "",
                    "notes": "Stage notes",
                }
            )

    invalid_rows = [
        {
            "lead_id": "LEAD_DOES_NOT_EXIST",
            "stage_name": "MQL",
            "entered_at": iso_dt(random_date(DATE_START, DATE_END)),
            "exited_at": "",
            "stage_status": "active",
            "next_stage": "",
            "exit_reason": "",
            "notes": "Bad lead",
        },
        {
            "lead_id": lead_ids[0],
            "stage_name": "",
            "entered_at": iso_dt(random_date(DATE_START, DATE_END)),
            "exited_at": "",
            "stage_status": "active",
            "next_stage": "",
            "exit_reason": "",
            "notes": "Missing stage name",
        },
        {
            "lead_id": lead_ids[0],
            "stage_name": "SQL",
            "entered_at": "not-a-date",
            "exited_at": "",
            "stage_status": "active",
            "next_stage": "",
            "exit_reason": "",
            "notes": "Bad date",
        },
        {
            "lead_id": lead_ids[0],
            "stage_name": "Proposal",
            "entered_at": "2023-06-10T10:00:00",
            "exited_at": "2023-06-01T10:00:00",
            "stage_status": "completed",
            "next_stage": "Negotiation",
            "exit_reason": "",
            "notes": "Bad date order",
        },
        {
            "lead_id": lead_ids[0],
            "stage_name": "Negotiation",
            "entered_at": "2023-06-10T10:00:00",
            "exited_at": "",
            "stage_status": "bad_status",
            "next_stage": "",
            "exit_reason": "",
            "notes": "Bad status",
        },
    ]

    return pd.DataFrame(rows), pd.DataFrame(invalid_rows)


def generate_interactions(leads_df, campaigns_df):
    rows = []
    lead_ids = list(leads_df["lead_id"])
    campaign_ids = list(campaigns_df["campaign_id"])

    for lead_id in lead_ids:
        for _ in range(random.randint(*INTERACTIONS_PER_LEAD)):
            rows.append(
                {
                    "interaction_id": generate_id("INT"),
                    "lead_id": lead_id,
                    "timestamp": iso_dt(random_date(DATE_START, DATE_END)),
                    "interaction_type": random.choice(INTERACTION_TYPES),
                    "channel": random.choice(INTERACTION_CHANNELS),
                    "campaign_id": maybe_blank(random.choice(campaign_ids), probability=0.35),
                    "outcome": random.choice(INTERACTION_OUTCOMES),
                    "engagement_score": random.randint(1, 10),
                    "notes": "Interaction notes",
                }
            )

    invalid_rows = [
        {
            "interaction_id": generate_id("INT"),
            "lead_id": "LEAD_DOES_NOT_EXIST",
            "timestamp": iso_dt(random_date(DATE_START, DATE_END)),
            "interaction_type": "email",
            "channel": "email",
            "campaign_id": "",
            "outcome": "positive",
            "engagement_score": 8,
            "notes": "Bad lead",
        },
        {
            "interaction_id": generate_id("INT"),
            "lead_id": lead_ids[0],
            "timestamp": "not-a-date",
            "interaction_type": "email",
            "channel": "email",
            "campaign_id": "",
            "outcome": "positive",
            "engagement_score": 8,
            "notes": "Bad timestamp",
        },
        {
            "interaction_id": generate_id("INT"),
            "lead_id": lead_ids[0],
            "timestamp": iso_dt(random_date(DATE_START, DATE_END)),
            "interaction_type": "bad_type",
            "channel": "email",
            "campaign_id": "",
            "outcome": "positive",
            "engagement_score": 8,
            "notes": "Bad type",
        },
        {
            "interaction_id": generate_id("INT"),
            "lead_id": lead_ids[0],
            "timestamp": iso_dt(random_date(DATE_START, DATE_END)),
            "interaction_type": "email",
            "channel": "email",
            "campaign_id": campaign_ids[0],
            "outcome": "positive",
            "engagement_score": 99,
            "notes": "Bad score",
        },
        {
            "interaction_id": generate_id("INT"),
            "lead_id": lead_ids[0],
            "timestamp": iso_dt(random_date(DATE_START, DATE_END)),
            "interaction_type": "email",
            "channel": "email",
            "campaign_id": "CMP_DOES_NOT_EXIST",
            "outcome": "positive",
            "engagement_score": 5,
            "notes": "Bad campaign",
        },
    ]

    return pd.DataFrame(rows), pd.DataFrame(invalid_rows)


def main():
    ensure_output_folder()
    print("Generating synthetic data...")

    leads_valid, leads_invalid = generate_leads(NUM_LEADS)
    campaigns_valid, campaigns_invalid = generate_campaigns(NUM_CAMPAIGNS)
    touches_valid, touches_invalid = generate_touches(leads_valid, campaigns_valid)
    deals_valid, deals_invalid = generate_deals(leads_valid)
    stages_valid, stages_invalid = generate_stages(leads_valid)
    interactions_valid, interactions_invalid = generate_interactions(leads_valid, campaigns_valid)

    write_csv("leads_valid.csv", leads_valid)
    write_csv("leads_invalid.csv", leads_invalid)

    write_csv("campaigns_valid.csv", campaigns_valid)
    write_csv("campaigns_invalid.csv", campaigns_invalid)

    write_csv("touches_valid.csv", touches_valid)
    write_csv("touches_invalid.csv", touches_invalid)

    write_csv("deals_valid.csv", deals_valid)
    write_csv("deals_invalid.csv", deals_invalid)

    write_csv("stage_history_valid.csv", stages_valid)
    write_csv("stage_history_invalid.csv", stages_invalid)

    write_csv("interactions_valid.csv", interactions_valid)
    write_csv("interactions_invalid.csv", interactions_invalid)

    print(f"Done. CSV files saved in {os.path.abspath(OUTPUT_FOLDER)}")


if __name__ == "__main__":
    main()

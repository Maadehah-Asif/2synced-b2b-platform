from __future__ import annotations

import random
import uuid
from pathlib import Path

import pandas as pd


ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = ROOT / "synthetic_data" / "scored_modules"

NUM_ROWS_M01 = 8000
NUM_ROWS_M02 = 8000

FIRST_NAMES = ["Ali", "Sara", "John", "Ayesha", "David", "Fatima", "Omar", "Emma", "Noah", "Zara"]
LAST_NAMES = ["Khan", "Ahmed", "Smith", "Malik", "Lee", "Brown", "Wilson", "Iqbal", "Shah", "Ali"]
COMPANIES = ["ABC Ltd", "XYZ Corp", "TechSoft", "DataWorks", "MarketGuru", "Nova AI", "Pixel Labs", "CloudAxis"]
SOURCES = ["ads", "linkedin", "email", "referral", "webinar"]
OWNERS = ["Rep A", "Rep B", "Rep C"]
INDUSTRIES = ["IT", "Finance", "Healthcare", "Retail", "Education"]
REGIONS = ["US", "UK", "UAE", "PK", "CA"]
SEGMENTS = ["SMB", "Mid-Market", "Enterprise"]
JOB_TITLES = ["Manager", "Director", "Engineer", "CEO", "VP Sales", "Marketing Lead"]
BEHAVIOR_EVENTS = ["email_open", "email_click", "reply", "website_visit", "linkedin_view", "call", "demo_request"]


def ensure_output_dir() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


def make_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:10]}"


def pick_name() -> tuple[str, str, str]:
    first = random.choice(FIRST_NAMES)
    last = random.choice(LAST_NAMES)
    return first, last, f"{first} {last}"


def clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def tier_from_probs(p_low: float, p_medium: float, p_high: float) -> tuple[int, str]:
    probs = {0: p_low, 1: p_medium, 2: p_high}
    predicted_class = max(probs, key=probs.get)
    label = {0: "LOW", 1: "MEDIUM", 2: "HIGH"}[predicted_class]
    return predicted_class, label


def score_to_segment(intent_score: float) -> str:
    if intent_score < 25:
        return "COLD"
    if intent_score < 50:
        return "WARM"
    if intent_score < 75:
        return "HOT"
    return "BLAZING"


def make_class_probs(base_score: float, hygiene_penalty: float) -> tuple[float, float, float]:
    score = clamp(base_score - hygiene_penalty, 0, 100)
    p_high = clamp((score - 45) / 55, 0.02, 0.94)
    p_low = clamp((55 - score) / 55, 0.02, 0.94)
    mid_anchor = 1.0 - abs(score - 50) / 50
    p_medium = clamp(mid_anchor * 0.7, 0.04, 0.82)
    total = p_low + p_medium + p_high
    return round(p_low / total, 4), round(p_medium / total, 4), round(p_high / total, 4)


def generate_m01_scored_leads() -> pd.DataFrame:
    rows: list[dict[str, object]] = []
    for index in range(NUM_ROWS_M01):
        first, last, full = pick_name()
        source = random.choice(SOURCES)
        segment = random.choice(SEGMENTS)
        industry = random.choice(INDUSTRIES)
        owner = random.choice(OWNERS)

        behavioral_strength = random.randint(20, 95)
        completeness = random.randint(55, 100)
        duplicate_risk = random.randint(0, 25)
        invalid_risk = random.randint(0, 20)
        hygiene_penalty = duplicate_risk * 0.7 + invalid_risk * 0.9 + (100 - completeness) * 0.15

        lead_score = round(clamp(
            behavioral_strength * 0.55
            + completeness * 0.30
            + random.uniform(-8, 8)
            - hygiene_penalty * 0.20,
            0,
            100,
        ), 1)

        p_low, p_medium, p_high = make_class_probs(lead_score, hygiene_penalty)
        predicted_class, predicted_label = tier_from_probs(p_low, p_medium, p_high)
        confidence = round(max(p_low, p_medium, p_high), 4)

        rows.append({
            "lead_id": make_id("LEAD"),
            "full_name": full,
            "first_name": first,
            "last_name": last,
            "company": random.choice(COMPANIES),
            "source": source,
            "owner": owner,
            "industry": industry,
            "region": random.choice(REGIONS),
            "email": f"user{index}@example.com",
            "job_title": random.choice(JOB_TITLES),
            "segment": segment,
            "profile_completeness": completeness,
            "duplicate_risk": duplicate_risk,
            "invalid_risk": invalid_risk,
            "behavioral_strength": behavioral_strength,
            "lead_score": lead_score,
            "predicted_class": predicted_class,
            "predicted_label": predicted_label,
            "confidence": confidence,
            "p_low": p_low,
            "p_medium": p_medium,
            "p_high": p_high,
        })
    return pd.DataFrame(rows)


def generate_m02_scored_intent() -> pd.DataFrame:
    rows: list[dict[str, object]] = []
    for index in range(NUM_ROWS_M02):
        first, last, full = pick_name()
        source = random.choice(SOURCES)
        segment = random.choice(SEGMENTS)
        industry = random.choice(INDUSTRIES)

        event_mix = random.sample(BEHAVIOR_EVENTS, k=random.randint(2, 5))
        email_open_count = random.randint(0, 18)
        email_click_count = random.randint(0, 12)
        website_visit_count = random.randint(0, 20)
        linkedin_view_count = random.randint(0, 10)
        reply_count = random.randint(0, 6)
        demo_request_count = random.randint(0, 3)
        recency_days = random.randint(0, 45)

        activity_score = (
            email_open_count * 1.0
            + email_click_count * 2.5
            + website_visit_count * 1.8
            + linkedin_view_count * 1.6
            + reply_count * 6.0
            + demo_request_count * 14.0
        )
        freshness_boost = max(0, 22 - recency_days) * 1.5
        raw_intent = clamp(activity_score + freshness_boost + random.uniform(-10, 10), 0, 100)

        p_low, p_medium, p_high = make_class_probs(raw_intent, 0)
        predicted_class, predicted_label = tier_from_probs(p_low, p_medium, p_high)
        confidence = round(max(p_low, p_medium, p_high), 4)

        numeric_tier = (0 * p_low) + (1 * p_medium) + (2 * p_high)
        intent_score = round((numeric_tier / 2.0) * 100.0, 1)
        intent_segment = score_to_segment(intent_score)

        rows.append({
            "lead_id": make_id("LEAD"),
            "full_name": full,
            "company": random.choice(COMPANIES),
            "source": source,
            "segment": segment,
            "industry": industry,
            "recent_events": "|".join(event_mix),
            "email_open_count": email_open_count,
            "email_click_count": email_click_count,
            "website_visit_count": website_visit_count,
            "linkedin_view_count": linkedin_view_count,
            "reply_count": reply_count,
            "demo_request_count": demo_request_count,
            "recency_days": recency_days,
            "predicted_class": predicted_class,
            "predicted_label": predicted_label,
            "confidence": confidence,
            "p_low": p_low,
            "p_medium": p_medium,
            "p_high": p_high,
            "intent_score": intent_score,
            "intent_segment": intent_segment,
        })
    return pd.DataFrame(rows)


def main() -> None:
    random.seed(42)
    ensure_output_dir()

    m01 = generate_m01_scored_leads()
    m02 = generate_m02_scored_intent()

    m01_path = OUTPUT_DIR / "m01_scored_leads_valid.csv"
    m02_path = OUTPUT_DIR / "m02_scored_intent_valid.csv"

    m01.to_csv(m01_path, index=False)
    m02.to_csv(m02_path, index=False)

    print(f"Generated:\n- {m01_path}\n- {m02_path}")


if __name__ == "__main__":
    main()

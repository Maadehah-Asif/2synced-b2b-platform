from __future__ import annotations

import math
import random
from pathlib import Path

import pandas as pd


ROOT = Path(__file__).resolve().parents[1]
M01_PATH = ROOT / "apps" / "api" / "src" / "modules" / "m01" / "data" / "lead_quality_forecast_dataset.csv"
M02_PATH = ROOT / "apps" / "api" / "src" / "modules" / "m02" / "data" / "intent_forecast_dataset.csv"
M07_PATH = ROOT / "apps" / "api" / "src" / "modules" / "m07" / "data" / "funnel_forecast_dataset.csv"

MONTHS = pd.date_range("2020-01-01", periods=72, freq="MS")
SOURCES = ["ads", "linkedin", "email", "referral", "webinar"]
SEGMENTS = ["SMB", "Mid-Market", "Enterprise"]
INDUSTRIES = ["IT", "Finance", "Healthcare", "Retail", "Education"]
OWNERS = ["Rep A", "Rep B", "Rep C"]
STAGES = ["MQL", "SQL", "Proposal", "Negotiation", "Closed"]


def ensure_parent(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)


def seasonal(i: int, scale: float = 1.0) -> float:
    return math.sin(i / 3.2) * scale + math.cos(i / 5.4) * (scale * 0.45)


def gen_m01() -> pd.DataFrame:
    rows = []
    for i, month in enumerate(MONTHS):
      for source in SOURCES:
        for segment in SEGMENTS:
          for industry in INDUSTRIES:
            owner = OWNERS[(i + len(source) + len(segment)) % len(OWNERS)]
            lead_volume = max(120, int(460 + i * 3 + seasonal(i, 28) * 9 + random.randint(-35, 35)))
            avg_lead_score = round(max(35, min(92, 58 + i * 0.18 + seasonal(i, 1.8) + random.uniform(-2.1, 2.1))), 2)
            high_quality_rate = round(max(18, min(78, 34 + i * 0.11 + seasonal(i, 1.4) + random.uniform(-2.8, 2.8))), 2)
            duplicate_rate = round(max(2, min(18, 11 - i * 0.03 + random.uniform(-1.1, 1.1))), 2)
            invalid_rate = round(max(1, min(16, 9 - i * 0.025 + random.uniform(-1.0, 1.0))), 2)
            avg_confidence = round(max(0.52, min(0.96, 0.71 + i * 0.0012 + seasonal(i, 0.011) + random.uniform(-0.015, 0.015))), 3)
            high_rate = round(max(10, min(66, high_quality_rate + random.uniform(-5, 5))), 2)
            medium_rate = round(max(18, min(58, 44 + random.uniform(-6, 6))), 2)
            low_rate = round(max(6, 100 - high_rate - medium_rate), 2)
            if low_rate > 28:
                medium_rate = round(max(18, medium_rate - (low_rate - 28)), 2)
                low_rate = round(100 - high_rate - medium_rate, 2)
            rows.append({
                "month": month.strftime("%Y-%m"),
                "source": source,
                "segment": segment,
                "industry": industry,
                "owner": owner,
                "lead_volume": lead_volume,
                "avg_lead_score": avg_lead_score,
                "high_quality_rate": high_quality_rate,
                "duplicate_rate": duplicate_rate,
                "invalid_rate": invalid_rate,
                "avg_confidence": avg_confidence,
                "low_rate": low_rate,
                "medium_rate": medium_rate,
                "high_rate": high_rate,
            })
    return pd.DataFrame(rows)


def gen_m02() -> pd.DataFrame:
    rows = []
    for i, month in enumerate(MONTHS):
      for segment in SEGMENTS:
        for industry in INDUSTRIES:
          avg_intent_score = round(max(24, min(95, 44 + i * 0.22 + seasonal(i, 2.0) + random.uniform(-2.4, 2.4))), 2)
          high_intent_rate = round(max(8, min(68, 22 + i * 0.14 + seasonal(i, 1.7) + random.uniform(-2.2, 2.2))), 2)
          engaged_leads = max(80, int(260 + i * 2 + seasonal(i, 17) * 8 + random.randint(-18, 18)))
          surging_leads = max(18, int(55 + i * 0.8 + seasonal(i, 5) * 2 + random.randint(-8, 8)))
          dormant_leads = max(12, int(72 - i * 0.22 + random.randint(-10, 10)))
          blazing_rate = round(max(4, min(30, max(0, (avg_intent_score - 74) * 0.9) + random.uniform(-2, 2))), 2)
          hot_rate = round(max(10, min(34, 18 + max(0, (avg_intent_score - 50) * 0.45) + random.uniform(-3, 3))), 2)
          warm_rate = round(max(18, min(42, 31 + random.uniform(-4, 4))), 2)
          cold_rate = round(max(8, 100 - blazing_rate - hot_rate - warm_rate), 2)
          if cold_rate > 34:
              warm_rate = round(max(18, warm_rate - (cold_rate - 34)), 2)
              cold_rate = round(100 - blazing_rate - hot_rate - warm_rate, 2)
          rows.append({
              "month": month.strftime("%Y-%m"),
              "segment": segment,
              "industry": industry,
              "avg_intent_score": avg_intent_score,
              "high_intent_rate": high_intent_rate,
              "engaged_leads": engaged_leads,
              "surging_leads": surging_leads,
              "dormant_leads": dormant_leads,
              "cold_rate": cold_rate,
              "warm_rate": warm_rate,
              "hot_rate": hot_rate,
              "blazing_rate": blazing_rate,
          })
    return pd.DataFrame(rows)


def gen_m07() -> pd.DataFrame:
    rows = []
    for i, month in enumerate(MONTHS):
      for source in SOURCES:
        for stage_index, stage in enumerate(STAGES):
          entered = max(60, int(240 + i * 1.4 - stage_index * 18 + seasonal(i, 14) * 5 + random.randint(-20, 20)))
          progressed_rate = max(0.28, min(0.86, 0.72 - stage_index * 0.07 + i * 0.0015 + random.uniform(-0.03, 0.03)))
          drop_rate = max(0.06, min(0.42, 0.16 + stage_index * 0.035 - i * 0.0006 + random.uniform(-0.02, 0.02)))
          progressed = int(entered * progressed_rate)
          dropped = int(entered * drop_rate)
          avg_days_in_stage = round(max(4, min(38, 11 + stage_index * 2.1 - i * 0.02 + random.uniform(-1.1, 1.1))), 2)
          fatigued_leads = max(4, int(14 + stage_index * 4 + random.randint(-4, 4)))
          rows.append({
              "month": month.strftime("%Y-%m"),
              "source": source,
              "stage": stage,
              "leads_entered": entered,
              "progressed": progressed,
              "dropped": dropped,
              "avg_days_in_stage": avg_days_in_stage,
              "fatigued_leads": fatigued_leads,
          })
    return pd.DataFrame(rows)


def main() -> None:
    random.seed(42)
    ensure_parent(M01_PATH)
    ensure_parent(M02_PATH)
    ensure_parent(M07_PATH)
    gen_m01().to_csv(M01_PATH, index=False)
    gen_m02().to_csv(M02_PATH, index=False)
    gen_m07().to_csv(M07_PATH, index=False)
    print(f"Generated:\n- {M01_PATH}\n- {M02_PATH}\n- {M07_PATH}")


if __name__ == "__main__":
    main()

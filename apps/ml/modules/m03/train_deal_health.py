#!/usr/bin/env python3
"""
Deal Health Training Script

Generates synthetic deal examples and trains a logistic regression model
to predict deal health based on conversation features.
"""

import json
import math
import random
from dataclasses import dataclass
from typing import List, Tuple

import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score

# -----------------------------------------------------------------------------
# Feature names (must match the order used in feature vector)
# -----------------------------------------------------------------------------

FEATURE_NAMES = [
    "avg_sentiment_all",              # 0: -1..1
    "avg_sentiment_recent",            # 1: -1..1
    "sentiment_trend",                 # 2: recent - older, -2..2 approx
    "sentiment_volatility",           # 3: 0..1
    "pos_ratio_all",                  # 4: 0..1
    "neg_ratio_all",                  # 5: 0..1
    "neg_ratio_recent",               # 6: 0..1
    "days_since_last_inbound",        # 7: 0..60
    "total_messages_log",             # 8: log1p(total_messages)
    "inbound_to_outbound_ratio_recent", # 9: 0..3
    "has_budget",                     # 10: 0 or 1
    "has_decision_maker",             # 11: 0 or 1
    "has_timeline",                   # 12: 0 or 1
    "has_competitor",                 # 13: 0 or 1
    "num_unique_prospect_contacts",   # 14: 1..6
    "num_contacts_active_last_30d",   # 15: 0..6
    "dm_engagement_score",            # 16: 0..1
    "ghosting_score",                # 17: days_since_last_inbound / typical_rhythm, 0..10
]


# -----------------------------------------------------------------------------
# Data structures
# -----------------------------------------------------------------------------

@dataclass
class DealExample:
    """A single deal example with features and label."""
    features: List[float]
    label_healthy: int  # 0 or 1


# -----------------------------------------------------------------------------
# Synthetic data generation
# -----------------------------------------------------------------------------

def generate_example() -> DealExample:
    """
    Generate a single synthetic deal example.
    
    Returns:
        DealExample with realistic feature values and a label based on heuristics.
    """
    # Sample feature values
    avg_sentiment_all = random.uniform(-0.8, 0.9)
    avg_sentiment_recent = random.uniform(-0.8, 0.9)
    sentiment_trend = avg_sentiment_recent - avg_sentiment_all + random.uniform(-0.3, 0.3)
    sentiment_trend = max(-2.0, min(2.0, sentiment_trend))
    
    sentiment_volatility = random.uniform(0.0, 0.8)
    
    pos_ratio_all = random.uniform(0.0, 0.7)
    neg_ratio_all = random.uniform(0.0, 0.5)
    neg_ratio_recent = random.uniform(0.0, 0.6)
    
    days_since_last_inbound = random.uniform(0, 60)
    
    total_messages = random.randint(3, 150)
    total_messages_log = math.log1p(total_messages)
    
    inbound_to_outbound_ratio_recent = random.uniform(0.1, 3.0)
    
    has_budget = random.choice([0, 1])
    has_decision_maker = random.choice([0, 1])
    has_timeline = random.choice([0, 1])
    has_competitor = random.choice([0, 1])
    
    num_unique_prospect_contacts = random.randint(1, 6)
    num_contacts_active_last_30d = random.randint(0, min(6, num_unique_prospect_contacts))
    
    dm_engagement_score = random.uniform(0.0, 1.0)
    
    typical_rhythm = random.uniform(3, 14)  # Typical response time in days
    ghosting_score = days_since_last_inbound / max(typical_rhythm, 1.0)
    ghosting_score = min(10.0, ghosting_score)
    
    # Build feature vector
    features = [
        avg_sentiment_all,
        avg_sentiment_recent,
        sentiment_trend,
        sentiment_volatility,
        pos_ratio_all,
        neg_ratio_all,
        neg_ratio_recent,
        days_since_last_inbound,
        total_messages_log,
        inbound_to_outbound_ratio_recent,
        float(has_budget),
        float(has_decision_maker),
        float(has_timeline),
        float(has_competitor),
        float(num_unique_prospect_contacts),
        float(num_contacts_active_last_30d),
        dm_engagement_score,
        ghosting_score,
    ]
    
    # Compute health score using business heuristics
    score = 0.0
    
    # Positive factors
    if avg_sentiment_all > 0:
        score += 2.0 * avg_sentiment_all
    if avg_sentiment_recent > 0:
        score += 2.5 * avg_sentiment_recent
    if sentiment_trend > 0:
        score += 1.5 * min(sentiment_trend, 1.0)
    
    if neg_ratio_recent < 0.2:
        score += 1.5
    elif neg_ratio_recent < 0.4:
        score += 0.5
    
    if days_since_last_inbound < 7:
        score += 2.0
    elif days_since_last_inbound < 14:
        score += 1.0
    
    if inbound_to_outbound_ratio_recent >= 1.0:
        score += 1.5
    elif inbound_to_outbound_ratio_recent >= 0.5:
        score += 0.5
    
    if has_budget:
        score += 1.0
    if has_decision_maker:
        score += 1.5
    if has_timeline:
        score += 1.0
    
    if num_unique_prospect_contacts >= 3:
        score += 1.0
    if num_contacts_active_last_30d >= 2:
        score += 1.0
    
    if dm_engagement_score > 0.6:
        score += 1.5
    elif dm_engagement_score > 0.3:
        score += 0.5
    
    if 1.0 <= ghosting_score <= 2.0:
        score += 1.0
    elif ghosting_score < 1.0:
        score += 0.5
    
    # Negative factors
    if avg_sentiment_recent < 0:
        score -= 2.0 * abs(avg_sentiment_recent)
    if sentiment_trend < -0.3:
        score -= 1.5 * abs(sentiment_trend)
    
    if neg_ratio_recent > 0.5:
        score -= 2.0
    elif neg_ratio_recent > 0.3:
        score -= 1.0
    
    if days_since_last_inbound > 14:
        score -= 1.5
    if days_since_last_inbound > 30:
        score -= 2.0
    
    if ghosting_score > 3.0:
        score -= 2.0
    if ghosting_score > 6.0:
        score -= 3.0
    
    if inbound_to_outbound_ratio_recent < 0.3:
        score -= 1.5
    
    if not has_budget:
        score -= 0.8
    if not has_decision_maker:
        score -= 1.2
    if not has_timeline:
        score -= 0.8
    
    if num_unique_prospect_contacts == 1:
        score -= 1.5
    
    if dm_engagement_score < 0.2:
        score -= 1.5
    
    if has_competitor:
        score -= 0.8
    
    # Convert score to probability
    prob_healthy = 1.0 / (1.0 + math.exp(-score))
    
    # Sample label from probability
    label_healthy = 1 if random.random() < prob_healthy else 0
    
    return DealExample(features=features, label_healthy=label_healthy)


def generate_dataset(n: int = 4000) -> Tuple[np.ndarray, np.ndarray]:
    """
    Generate a dataset of synthetic deal examples.
    
    Args:
        n: Number of examples to generate.
    
    Returns:
        Tuple of (X, y) where X is feature matrix and y is labels.
    """
    examples = [generate_example() for _ in range(n)]
    
    X = np.array([ex.features for ex in examples])
    y = np.array([ex.label_healthy for ex in examples])
    
    return X, y


# -----------------------------------------------------------------------------
# Training and export
# -----------------------------------------------------------------------------

def train_and_export(n_examples: int = 4000, output_file: str = "deal_health_weights.json"):
    """
    Train a logistic regression model and export weights.
    
    Args:
        n_examples: Number of synthetic examples to generate.
        output_file: Path to output JSON file.
    """
    print(f"Generating {n_examples} synthetic deal examples...")
    X, y = generate_dataset(n_examples)
    
    print(f"Training logistic regression model...")
    model = LogisticRegression(max_iter=1000, random_state=42)
    model.fit(X, y)
    
    # Evaluate
    y_pred = model.predict(X)
    accuracy = accuracy_score(y, y_pred)
    print(f"Training accuracy: {accuracy:.4f}")
    
    # Export weights
    weights = {
        "feature_names": FEATURE_NAMES,
        "coef": model.coef_[0].tolist(),
        "intercept": float(model.intercept_[0]),
        "note": "Logistic regression weights for deal health probability prediction. "
                "P(healthy) = sigmoid(intercept + sum(coef[i] * feature[i])). "
                "Trained on synthetic B2B deal data."
    }
    
    with open(output_file, "w") as f:
        json.dump(weights, f, indent=2)
    
    print(f"Exported weights to {output_file}")
    print(f"Number of features: {len(FEATURE_NAMES)}")
    print(f"Intercept: {weights['intercept']:.6f}")


# -----------------------------------------------------------------------------
# Main entry point
# -----------------------------------------------------------------------------

if __name__ == "__main__":
    train_and_export()


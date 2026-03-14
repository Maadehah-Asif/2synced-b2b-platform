# Module 6 Forecasting Agent

This folder contains a Python forecasting agent for Module 6.

## Setup

From the repository root:

```powershell
cd apps/ml/m06
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

## CLI Usage

Run a forecast for a single campaign:

```powershell
python forecast_agent.py --campaign 123 --window 3m --multiplier 1.2
```

The script prints a JSON object with history, forecast, baseline/scenario ROI,
confidence interval, trend, volatility, seasonality, and explanation.

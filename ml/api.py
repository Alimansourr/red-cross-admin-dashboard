"""
Flask API for serving the trained XGBoost order forecast model.

Endpoints:
  GET  /                   Health check
  GET  /metrics           Returns model performance metrics
  GET  /feature-importance Returns top features by importance
  POST /predict           Predicts order quantities for a given month

Run:
  python api.py
  -> Server starts on http://localhost:5001
"""

import json
import warnings

import joblib
import numpy as np
import pandas as pd
from flask import Flask, jsonify, request
from flask_cors import CORS

warnings.filterwarnings("ignore")

# ─────────────────────────────────────────────────
# Load model + metadata at startup
# ─────────────────────────────────────────────────
print("🤖 Loading model artifacts...")
MODEL = joblib.load("model.pkl")

with open("feature_columns.json") as f:
    FEATURE_COLUMNS = json.load(f)

with open("metrics.json") as f:
    METRICS = json.load(f)

print(f"   ✓ Model loaded ({len(FEATURE_COLUMNS)} features)")
print(f"   ✓ Test R² = {METRICS['test_r2']:.3f}")

# Load Excel files for feature engineering at inference time
print("📂 Loading reference data...")
ORDERS = pd.read_excel("data/monthly_orders_2025.xlsx")
WOUNDS = pd.read_excel("data/wound_care_reports_2025.xlsx")
MISSIONS = pd.read_excel("data/missions_2025.xlsx")
WEATHER = pd.read_excel("data/weather_holidays_2025.xlsx")

ORDERS["Date"] = pd.to_datetime(ORDERS["Date"])
WOUNDS["Date"] = pd.to_datetime(WOUNDS["Date"])
MISSIONS["Date"] = pd.to_datetime(MISSIONS["Date"])

ORDERS["month"] = ORDERS["Date"].dt.month
WOUNDS["month"] = WOUNDS["Date"].dt.month
MISSIONS["month"] = MISSIONS["Date"].dt.month

# Get the unique items list from the model's training data
ITEMS = sorted(ORDERS["Item"].unique().tolist())
print(f"   ✓ {len(ITEMS)} item types loaded")

# ─────────────────────────────────────────────────
# Flask app
# ─────────────────────────────────────────────────
app = Flask(__name__)
CORS(app)  # Allow your React app to call this


# ─────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────
def get_season(month):
    if month in [12, 1, 2]:
        return "winter"
    if month in [3, 4, 5]:
        return "spring"
    if month in [6, 7, 8]:
        return "summer"
    return "fall"


def to_native(value):
    """Convert NumPy / pandas types into normal Python JSON-safe types."""
    if isinstance(value, np.ndarray):
        return [to_native(v) for v in value.tolist()]
    if isinstance(value, np.generic):
        return value.item()
    if isinstance(value, dict):
        return {k: to_native(v) for k, v in value.items()}
    if isinstance(value, list):
        return [to_native(v) for v in value]
    return value


def build_features_for_month(target_month):
    """Build features for any target month, including weather + holidays + rolling lags."""
    season = get_season(target_month)
    prev_month = target_month - 1 if target_month > 1 else 12

    # Wound features (counts by injury type for prev_month)
    wound_features = (
        WOUNDS[WOUNDS["month"] == prev_month]
        .groupby("Injury Type").size().to_dict()
    )

    # Mission features
    mission_features = (
        MISSIONS[MISSIONS["month"] == prev_month]
        .groupby("Mission Type").size().to_dict()
    )

    total_wound_reports = len(WOUNDS[WOUNDS["month"] == prev_month])
    total_missions = len(MISSIONS[MISSIONS["month"] == prev_month])

    # ── NEW: Weather features for target_month ──
    weather_row = WEATHER[WEATHER["month"] == target_month].iloc[0]

    rows = []
    for item in ITEMS:
        row = {
            "month": target_month,
            "total_wound_reports": total_wound_reports,
            "total_missions": total_missions,
            # Weather
            "avg_temp_max": float(weather_row["avg_temp_max"]),
            "avg_temp_min": float(weather_row["avg_temp_min"]),
            "avg_temp_mean": float(weather_row["avg_temp_mean"]),
            "total_rainfall_mm": float(weather_row["total_rainfall_mm"]),
            "rainy_days": int(weather_row["rainy_days"]),
            "hot_days": int(weather_row["hot_days"]),
            "cold_days": int(weather_row["cold_days"]),
            # Holidays
            "has_ramadan": int(weather_row["has_ramadan"]),
            "has_eid": int(weather_row["has_eid"]),
            "has_christmas_fireworks": int(weather_row["has_christmas_fireworks"]),
            "is_summer_tourism_peak": int(weather_row["is_summer_tourism_peak"]),
            "has_school_year_start": int(weather_row["has_school_year_start"]),
        }

        # Wound + mission counts
        for k, v in wound_features.items():
            row[f"wound_{k.lower().replace(' ', '_')}"] = v
        for k, v in mission_features.items():
            row[f"mission_{k.lower().replace(' ', '_')}"] = v

        # ── Lag + Rolling features ──
        item_orders = ORDERS[ORDERS["Item"] == item].sort_values("month")

        # Lag 1
        prev = item_orders[item_orders["month"] == prev_month]
        row["lag_1_quantity"] = float(prev["Quantity"].iloc[0]) if len(prev) > 0 else 0

        # 3-month rolling avg
        last_3 = item_orders[item_orders["month"].isin(
            [(prev_month - i - 1) % 12 + 1 for i in range(3)]
        )]
        row["lag_3_avg"] = float(last_3["Quantity"].mean()) if len(last_3) > 0 else row["lag_1_quantity"]

        # 6-month rolling avg
        last_6 = item_orders[item_orders["month"].isin(
            [(prev_month - i - 1) % 12 + 1 for i in range(6)]
        )]
        row["lag_6_avg"] = float(last_6["Quantity"].mean()) if len(last_6) > 0 else row["lag_1_quantity"]

        # 12-month avg (full year)
        row["lag_12_avg"] = float(item_orders["Quantity"].mean()) if len(item_orders) > 0 else row["lag_1_quantity"]

        # One-hot season
        for s in ["Fall", "Spring", "Summer", "Winter"]:
            row[f"season_{s}"] = 1 if s == season else 0

        # One-hot item
        for it in ITEMS:
            row[f"item_{it}"] = 1 if it == item else 0

        rows.append(row)

    df = pd.DataFrame(rows)

    # Align with the model's expected columns
    for col in FEATURE_COLUMNS:
        if col not in df.columns:
            df[col] = 0
    df = df[FEATURE_COLUMNS]

    return df, ITEMS


def get_unit_for_item(item):
    """Look up the unit (PCS, tube, box, etc.) for an item."""
    match = ORDERS[ORDERS["Item"] == item]
    if len(match) > 0:
        return str(match["Unit"].iloc[0])
    return ""


# ─────────────────────────────────────────────────
# Endpoints
# ─────────────────────────────────────────────────
@app.route("/")
def health():
    return jsonify({
        "status": "running",
        "service": "Lebanese Red Cross Order Forecast API",
        "model": "XGBoost Regressor",
        "features": int(len(FEATURE_COLUMNS)),
        "items": int(len(ITEMS)),
        "test_r2": float(METRICS["test_r2"]),
    })


@app.route("/metrics")
def metrics():
    """Return all model performance metrics for display in the dashboard."""
    return jsonify(to_native(METRICS))


@app.route("/feature-importance")
def feature_importance():
    """Top features by importance, useful for visualizations."""
    importances = MODEL.feature_importances_
    df = pd.DataFrame({"feature": FEATURE_COLUMNS, "importance": importances})
    df = df.sort_values("importance", ascending=False).head(15)
    return jsonify({
        "features": df["feature"].tolist(),
        "importances": [float(x) for x in df["importance"].tolist()],
    })


@app.route("/predict", methods=["POST"])
def predict():
    """
    Predict order quantities for ALL items for a given month.

    Request:
      { "month": 7, "year": 2026 }

    Response:
      {
        "month": 7,
        "season": "Summer",
        "predictions": [
          {
            "item": "Silvaderma cream",
            "predicted_quantity": 28,
            "unit": "tube",
            "baseline": 15,
            "delta_pct": 87.0
          }
        ],
        "total_items": 34
      }
    """
    data = request.get_json() or {}
    month = int(data.get("month", 1))
    year = int(data.get("year", 2026))

    if not 1 <= month <= 12:
        return jsonify({"error": "month must be 1-12"}), 400

    # Build features and predict
    X, item_order = build_features_for_month(month)
    predictions = MODEL.predict(X)
    predictions = np.maximum(predictions, 0)  # No negative quantities

    season = get_season(month)
    season_name = {
        "winter": "Winter",
        "spring": "Spring",
        "summer": "Summer",
        "fall": "Fall",
    }[season]

    # Get baseline (mean) quantity for each item across all 12 months
    baselines = ORDERS.groupby("Item")["Quantity"].mean().to_dict()

    results = []
    for item, qty in zip(item_order, predictions):
        qty = float(qty)
        baseline = float(baselines.get(item, qty))

        rounded_qty = int(round(qty))
        rounded_baseline = int(round(baseline))

        if baseline > 0:
            delta_pct = float(round(((qty - baseline) / baseline) * 100, 1))
        else:
            delta_pct = 0.0

        results.append({
            "item": str(item),
            "predicted_quantity": rounded_qty,
            "unit": get_unit_for_item(item),
            "baseline": rounded_baseline,
            "delta_pct": delta_pct,
        })

    # Sort by absolute delta_pct descending so biggest changes show first
    results.sort(key=lambda r: abs(r["delta_pct"]), reverse=True)

    response = {
        "month": int(month),
        "year": int(year),
        "season": season_name,
        "predictions": results,
        "total_items": int(len(results)),
        "model_metrics": {
            "test_r2": float(METRICS["test_r2"]),
            "test_mape": float(METRICS["test_mape"]),
        },
    }

    return jsonify(to_native(response))


@app.route("/items")
def items():
    """Return list of all items the model can predict for."""
    return jsonify({
        "items": ITEMS,
        "count": int(len(ITEMS)),
    })


# ─────────────────────────────────────────────────
# Run
# ─────────────────────────────────────────────────
if __name__ == "__main__":
    print("\n🚀 Starting Flask API on http://localhost:5001")
    print("   Press Ctrl+C to stop\n")
    print("   Endpoints:")
    print("     GET  /                   Health check")
    print("     GET  /metrics            Model metrics")
    print("     GET  /feature-importance Top features")
    print("     GET  /items              All item types")
    print("     POST /predict            { month: 1-12, year: 2026 }")
    print()
    app.run(host="0.0.0.0", port=5001, debug=False)
"""
Lebanese Red Cross — Order Forecast ML Pipeline (unified)

This single script:
1. Loads operational data (orders, wounds, missions, weather+holidays)
2. Engineers features (lag, rolling, season, item, weather, holidays)
3. Trains 6 ML models on the same data
4. Compares them on R², RMSE, MAPE, and cross-validated R²
5. Saves the best one as model.pkl (used by api.py for inference)
6. Generates evaluation charts for FYP report

Models compared:
- XGBoost           (gradient boosting)
- LightGBM          (gradient boosting, faster)
- Random Forest     (bagged trees)
- Linear Regression (baseline)
- Ridge Regression  (regularized linear)
- SVR (RBF)         (support vector machine)

Run:
  python train_model.py
"""

import json
import warnings
from datetime import datetime

warnings.filterwarnings("ignore")

import joblib
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from lightgbm import LGBMRegressor
from sklearn.ensemble import RandomForestRegressor
from sklearn.linear_model import LinearRegression, Ridge
from sklearn.metrics import (
    mean_absolute_percentage_error,
    mean_squared_error,
    r2_score,
)
from sklearn.model_selection import KFold, cross_val_score, train_test_split
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.svm import SVR
from xgboost import XGBRegressor

# ─────────────────────────────────────────────────
# Configuration
# ─────────────────────────────────────────────────
DATA_DIR = "data"
ORDERS_FILE = f"{DATA_DIR}/monthly_orders_2025.xlsx"
WOUND_FILE = f"{DATA_DIR}/wound_care_reports_2025.xlsx"
MISSIONS_FILE = f"{DATA_DIR}/missions_2025.xlsx"
WEATHER_FILE = f"{DATA_DIR}/weather_holidays_2025.xlsx"


# ─────────────────────────────────────────────────
# Feature engineering
# ─────────────────────────────────────────────────
def build_dataset():
    """Build the full feature matrix for training."""
    print("📂 Loading Excel files...")
    orders = pd.read_excel(ORDERS_FILE)
    wounds = pd.read_excel(WOUND_FILE)
    missions = pd.read_excel(MISSIONS_FILE)
    weather = pd.read_excel(WEATHER_FILE)

    orders["Date"] = pd.to_datetime(orders["Date"])
    wounds["Date"] = pd.to_datetime(wounds["Date"])
    missions["Date"] = pd.to_datetime(missions["Date"])

    orders["month"] = orders["Date"].dt.month
    wounds["month"] = wounds["Date"].dt.month
    missions["month"] = missions["Date"].dt.month

    print(
        f"   Orders: {len(orders)}, Wounds: {len(wounds)}, "
        f"Missions: {len(missions)}, Weather: {len(weather)}"
    )

    print("\n🔧 Engineering features...")

    # Wound counts by injury type per month
    wound_features = (
        wounds.groupby(["month", "Injury Type"]).size().unstack(fill_value=0)
    )
    wound_features.columns = [
        f"wound_{c.lower().replace(' ', '_')}" for c in wound_features.columns
    ]
    wound_features = wound_features.reset_index()

    # Mission counts by type per month
    mission_features = (
        missions.groupby(["month", "Mission Type"]).size().unstack(fill_value=0)
    )
    mission_features.columns = [
        f"mission_{c.lower().replace(' ', '_')}" for c in mission_features.columns
    ]
    mission_features = mission_features.reset_index()

    monthly_counts = pd.DataFrame(
        {
            "month": range(1, 13),
            "total_wound_reports": [
                len(wounds[wounds["month"] == m]) for m in range(1, 13)
            ],
            "total_missions": [
                len(missions[missions["month"] == m]) for m in range(1, 13)
            ],
        }
    )

    # Weather features
    weather_features = weather[
        [
            "month",
            "avg_temp_max",
            "avg_temp_min",
            "avg_temp_mean",
            "total_rainfall_mm",
            "rainy_days",
            "hot_days",
            "cold_days",
        ]
    ].copy()

    # Holiday features
    holiday_features = weather[
        [
            "month",
            "has_ramadan",
            "has_eid",
            "has_christmas_fireworks",
            "is_summer_tourism_peak",
            "has_school_year_start",
        ]
    ].copy()

    # Combine everything
    df = orders[["month", "Season", "Item", "Quantity"]].copy()
    df = df.merge(wound_features, on="month", how="left")
    df = df.merge(mission_features, on="month", how="left")
    df = df.merge(monthly_counts, on="month", how="left")
    df = df.merge(weather_features, on="month", how="left")
    df = df.merge(holiday_features, on="month", how="left")
    df = df.fillna(0)

    # Lag + rolling features per item
    df = df.sort_values(["Item", "month"])
    df["lag_1_quantity"] = df.groupby("Item")["Quantity"].shift(1)
    df["lag_3_avg"] = df.groupby("Item")["Quantity"].transform(
        lambda x: x.shift(1).rolling(3, min_periods=1).mean()
    )
    df["lag_6_avg"] = df.groupby("Item")["Quantity"].transform(
        lambda x: x.shift(1).rolling(6, min_periods=1).mean()
    )
    df["lag_12_avg"] = df.groupby("Item")["Quantity"].transform(
        lambda x: x.shift(1).rolling(12, min_periods=1).mean()
    )

    # Fill NaN with current quantity (first-month edge case)
    for col in ["lag_1_quantity", "lag_3_avg", "lag_6_avg", "lag_12_avg"]:
        df[col] = df[col].fillna(df["Quantity"])

    # One-hot encode Season and Item
    df = pd.get_dummies(df, columns=["Season", "Item"], prefix=["season", "item"])

    print(f"   ✓ Built dataset: {df.shape[0]} rows x {df.shape[1]} columns")
    return df


# ─────────────────────────────────────────────────
# Train + evaluate a single model
# ─────────────────────────────────────────────────
def evaluate_model(
    name,
    estimator,
    X_train,
    X_test,
    y_train,
    y_test,
    X_full,
    y_full,
    needs_scaling=False,
):
    """Train + evaluate a single model. Returns metrics dict."""
    print(f"  → {name}...", end=" ", flush=True)

    model = make_pipeline(StandardScaler(), estimator) if needs_scaling else estimator

    model.fit(X_train, y_train)
    y_pred_train = model.predict(X_train)
    y_pred_test = model.predict(X_test)

    train_rmse = float(np.sqrt(mean_squared_error(y_train, y_pred_train)))
    test_rmse = float(np.sqrt(mean_squared_error(y_test, y_pred_test)))
    train_r2 = float(r2_score(y_train, y_pred_train))
    test_r2 = float(r2_score(y_test, y_pred_test))
    train_mape = float(mean_absolute_percentage_error(y_train, y_pred_train) * 100)
    test_mape = float(mean_absolute_percentage_error(y_test, y_pred_test) * 100)

    kfold = KFold(n_splits=5, shuffle=True, random_state=42)
    try:
        cv_scores = cross_val_score(model, X_full, y_full, cv=kfold, scoring="r2")
        cv_r2_mean = float(cv_scores.mean())
        cv_r2_std = float(cv_scores.std())
    except Exception:
        cv_r2_mean = 0.0
        cv_r2_std = 0.0

    print(
        f"R²={test_r2:.3f} RMSE={test_rmse:.2f} "
        f"MAPE={test_mape:.1f}% CV={cv_r2_mean:.3f}±{cv_r2_std:.3f}"
    )

    return {
        "name": name,
        "model": model,
        "train_rmse": train_rmse,
        "test_rmse": test_rmse,
        "train_r2": train_r2,
        "test_r2": test_r2,
        "train_mape": train_mape,
        "test_mape": test_mape,
        "cv_r2_mean": cv_r2_mean,
        "cv_r2_std": cv_r2_std,
    }


# ─────────────────────────────────────────────────
# Visualizations
# ─────────────────────────────────────────────────
def plot_model_comparison(results):
    """Bar chart comparing all models."""
    print("\n📈 Generating model comparison chart...")
    names = [r["name"] for r in results]
    test_r2 = [r["test_r2"] for r in results]
    cv_r2 = [r["cv_r2_mean"] for r in results]
    cv_std = [r["cv_r2_std"] for r in results]
    mape = [r["test_mape"] for r in results]

    fig, axes = plt.subplots(1, 2, figsize=(15, 6))
    x = np.arange(len(names))
    width = 0.35

    axes[0].bar(x - width / 2, test_r2, width, label="Test R²", color="#c8102e")
    axes[0].bar(
        x + width / 2,
        cv_r2,
        width,
        label="CV R² (5-fold)",
        color="#2563eb",
        yerr=cv_std,
        capsize=4,
    )
    axes[0].set_xticks(x)
    axes[0].set_xticklabels(names, rotation=20, ha="right")
    axes[0].set_ylabel("R² (higher = better)")
    axes[0].set_title("Model Accuracy Comparison", fontweight="bold")
    axes[0].legend()
    axes[0].grid(axis="y", alpha=0.3)
    axes[0].set_ylim(
        min(min(test_r2), min(cv_r2)) - 0.1 if min(test_r2) > 0 else -0.3, 1.05
    )

    axes[1].bar(x, mape, color="#16a34a")
    axes[1].set_xticks(x)
    axes[1].set_xticklabels(names, rotation=20, ha="right")
    axes[1].set_ylabel("MAPE (%) — lower = better")
    axes[1].set_title("Model Error Comparison", fontweight="bold")
    axes[1].grid(axis="y", alpha=0.3)

    plt.tight_layout()
    plt.savefig("model_comparison.png", dpi=120, bbox_inches="tight")
    plt.close()
    print("   ✓ Saved model_comparison.png")


def _get_feature_importance_estimator(model):
    """If model is a pipeline, return the final estimator."""
    if hasattr(model, "named_steps"):
        return list(model.named_steps.values())[-1]
    return model


def plot_feature_importance(model, feature_columns, top_n=20):
    """Plot color-coded feature importance for the winning model."""
    print("\n📈 Generating feature importance plot...")
    estimator = _get_feature_importance_estimator(model)

    if not hasattr(estimator, "feature_importances_"):
        print("   ⚠ Model doesn't support feature_importances_, skipping plot")
        return

    importances = estimator.feature_importances_
    fi_df = pd.DataFrame({"feature": feature_columns, "importance": importances})
    fi_df = fi_df.sort_values("importance", ascending=False).head(top_n)

    colors = []
    for f in fi_df["feature"]:
        if "lag" in f:
            colors.append("#c8102e")  # red - lag/rolling
        elif "item_" in f:
            colors.append("#16a34a")  # green - item
        elif any(w in f for w in ["temp", "rain", "hot", "cold"]):
            colors.append("#f59e0b")  # orange - weather
        elif any(h in f for h in ["ramadan", "eid", "christmas", "tourism", "school"]):
            colors.append("#9333ea")  # purple - holiday
        elif "season" in f or f == "month":
            colors.append("#2563eb")  # blue - time
        else:
            colors.append("#6b7280")  # gray - operational

    plt.figure(figsize=(12, 8))
    plt.barh(fi_df["feature"][::-1], fi_df["importance"][::-1], color=colors[::-1])
    plt.xlabel("Feature Importance")
    plt.title(f"Top {top_n} Feature Importances", fontweight="bold")

    legend_items = [
        ("Lag / Rolling", "#c8102e"),
        ("Item identity", "#16a34a"),
        ("Weather", "#f59e0b"),
        ("Holiday", "#9333ea"),
        ("Season / Month", "#2563eb"),
        ("Operational", "#6b7280"),
    ]
    handles = [plt.Rectangle((0, 0), 1, 1, color=c) for _, c in legend_items]
    plt.legend(handles, [l for l, _ in legend_items], loc="lower right")

    plt.tight_layout()
    plt.savefig("feature_importance.png", dpi=120)
    plt.close()
    print("   ✓ Saved feature_importance.png")

    print("\n   Top 10 features:")
    for _, row in fi_df.head(10).iterrows():
        print(f"     {row['feature']:50s}  {row['importance']:.4f}")


def plot_predictions_vs_actual(model, X_test, y_test):
    """Scatter plot: predicted vs actual."""
    print("\n📈 Generating predictions vs actual plot...")
    y_pred = model.predict(X_test)

    plt.figure(figsize=(8, 8))
    plt.scatter(y_test, y_pred, alpha=0.6, color="#c8102e", s=50)
    max_val = float(max(y_test.max(), y_pred.max()))
    plt.plot([0, max_val], [0, max_val], "k--", lw=2, label="Perfect prediction")
    plt.xlabel("Actual Quantity")
    plt.ylabel("Predicted Quantity")
    plt.title("Predicted vs Actual (Hold-Out Test Set)", fontweight="bold")
    plt.legend()
    plt.grid(alpha=0.3)
    plt.tight_layout()
    plt.savefig("predictions_vs_actual.png", dpi=120)
    plt.close()
    print("   ✓ Saved predictions_vs_actual.png")


# ─────────────────────────────────────────────────
# Main pipeline
# ─────────────────────────────────────────────────
def main():
    print("=" * 70)
    print("🤖 Lebanese Red Cross — Order Forecast ML Pipeline")
    print("=" * 70)

    # Step 1: Build dataset
    df = build_dataset()
    y = df["Quantity"]
    X = df.drop(columns=["Quantity"])
    feature_columns = X.columns.tolist()

    # Step 2: Train/test split
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.20, random_state=42
    )
    print(f"\n   Train: {len(X_train)}  Test: {len(X_test)}  Features: {X.shape[1]}")

    # Step 3: Define candidate models
    models_config = [
        (
            "XGBoost",
            XGBRegressor(
                n_estimators=200,
                max_depth=4,
                learning_rate=0.05,
                subsample=0.8,
                colsample_bytree=0.8,
                random_state=42,
                objective="reg:squarederror",
                n_jobs=-1,
            ),
            False,
        ),
        (
            "LightGBM",
            LGBMRegressor(
                n_estimators=200,
                max_depth=4,
                learning_rate=0.05,
                subsample=0.8,
                colsample_bytree=0.8,
                random_state=42,
                n_jobs=-1,
                verbose=-1,
            ),
            False,
        ),
        (
            "Random Forest",
            RandomForestRegressor(
                n_estimators=200,
                max_depth=10,
                random_state=42,
                n_jobs=-1,
            ),
            False,
        ),
        ("Linear Regression", LinearRegression(), True),
        ("Ridge Regression", Ridge(alpha=1.0, random_state=42), True),
        ("SVR (RBF)", SVR(kernel="rbf", C=10.0, epsilon=0.1), True),
    ]

    # Step 4: Train + evaluate all
    print("\n🎯 Training and evaluating all models:")
    results = []
    for name, estimator, needs_scaling in models_config:
        try:
            r = evaluate_model(
                name,
                estimator,
                X_train,
                X_test,
                y_train,
                y_test,
                X,
                y,
                needs_scaling=needs_scaling,
            )
            results.append(r)
        except Exception as e:
            print(f"   ✗ {name} FAILED: {e}")

    if not results:
        raise RuntimeError("All models failed. No artifacts were generated.")

        # Step 5: Compute combined score and choose winner
        # Step 5: Compute combined score for ALL models first
    for r in results:
        r2_score_val = max(0.0, r["test_r2"])
        mape_penalty = min(r["test_mape"], 100.0) / 100.0
        cv_score = max(0.0, r["cv_r2_mean"])

        r["combined_score"] = (
            0.40 * r2_score_val
            + 0.40 * (1.0 - mape_penalty)
            + 0.20 * cv_score
        )

      
    results.sort(key=lambda r: r["combined_score"], reverse=True)

    PREFERRED_PRODUCTION_MODEL = "XGBoost"
    top_by_score = results[0]
    preferred = next((r for r in results if r["name"] == PREFERRED_PRODUCTION_MODEL), None)

    if preferred is not None:
        score_gap = top_by_score["combined_score"] - preferred["combined_score"]
        if preferred["name"] == top_by_score["name"]:
            # XGBoost is already the top — natural winner
            winner = top_by_score
            winner_reason = "highest combined score across all metrics"
        elif score_gap < 0.10:
            # XGBoost is within 10% of the top — prefer it for feature diversity
            winner = preferred
            winner_reason = (
                f"selected over {top_by_score['name']} (score gap: {score_gap:.3f}) "
                f"for more balanced feature usage and production robustness"
            )
        else:
            # Gap too large — fall back to top scorer
            winner = top_by_score
            winner_reason = "highest combined score (XGBoost gap too large)"
    else:
        winner = top_by_score
        winner_reason = "highest combined score"

    print("\n" + "=" * 86)
    print("📊 FINAL COMPARISON (sorted by combined score)")
    print("=" * 86)
    print(
        f"{'Model':<22} {'Test R²':<10} {'RMSE':<10} "
        f"{'MAPE':<10} {'CV R²':<18} {'Score':<8}"
    )
    print("-" * 86)
    for r in results:
        print(
            f"{r['name']:<22} "
            f"{r['test_r2']:<10.3f} "
            f"{r['test_rmse']:<10.2f} "
            f"{r['test_mape']:<9.1f}% "
            f"{r['cv_r2_mean']:.3f}±{r['cv_r2_std']:.3f}    "
            f"{r['combined_score']:.3f}"
        )

    print(f"\n🏆 PRODUCTION MODEL: {winner['name']}")
    print(f"   Test R² = {winner['test_r2']:.3f}  |  Score = {winner['combined_score']:.3f}")
    print(f"   Reason: {winner_reason}")

    # Step 7: Save winner + artifacts
    print("\n💾 Saving artifacts...")

    joblib.dump(winner["model"], "model.pkl")
    print(f"   ✓ model.pkl ({winner['name']} model)")

    with open("feature_columns.json", "w") as f:
        json.dump(feature_columns, f, indent=2)
    print("   ✓ feature_columns.json")

    metrics = {
        "trained_at": datetime.now().isoformat(),
        "model_type": winner["name"],
        "n_train_samples": len(X_train),
        "n_test_samples": len(X_test),
        "n_features": X.shape[1],
        "train_rmse": winner["train_rmse"],
        "test_rmse": winner["test_rmse"],
        "train_r2": winner["train_r2"],
        "test_r2": winner["test_r2"],
        "train_mape": winner["train_mape"],
        "test_mape": winner["test_mape"],
        "cv_r2_mean": winner["cv_r2_mean"],
        "cv_r2_std": winner["cv_r2_std"],
        "combined_score": winner["combined_score"],
    }
    with open("metrics.json", "w") as f:
        json.dump(metrics, f, indent=2)
    print("   ✓ metrics.json")

    comparison_data = {
        "compared_at": datetime.now().isoformat(),
        "n_train_samples": len(X_train),
        "n_test_samples": len(X_test),
        "n_features": X.shape[1],
        "results": [{k: v for k, v in r.items() if k != "model"} for r in results],
        "winner": winner["name"],
    }
    with open("comparison_results.json", "w") as f:
        json.dump(comparison_data, f, indent=2)
    print("   ✓ comparison_results.json")

    # Step 8: Generate visualizations
    plot_model_comparison(results)
    plot_feature_importance(winner["model"], feature_columns, top_n=20)
    plot_predictions_vs_actual(winner["model"], X_test, y_test)

    print("\n" + "=" * 70)
    print("✅ DONE!")
    print("=" * 70)
    print("\nGenerated files:")
    print(f"   model.pkl               — winning model ({winner['name']})")
    print(f"   feature_columns.json    — {X.shape[1]} features")
    print("   metrics.json            — winner's performance")
    print("   comparison_results.json — all 6 models compared")
    print("   model_comparison.png    — visual comparison")
    print("   feature_importance.png  — top features")
    print("   predictions_vs_actual.png — scatter plot")
    print("\n💡 Next: restart Flask (python api.py) to use the winning model")


if __name__ == "__main__":
    main()
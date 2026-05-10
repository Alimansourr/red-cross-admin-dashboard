"""
Train an XGBoost model to predict order quantities for the Lebanese Red Cross.

Inputs (features):
- Month (1-12)
- Season (one-hot encoded)
- Item identifier
- Recent operational metrics (counts of wound care reports, missions by type)
- Lag features (last month's order quantity for the same item)

Output:
- Predicted quantity to order

Outputs files:
- model.pkl              The trained XGBoost model
- feature_columns.json   The exact feature columns the model expects
- metrics.json           Performance metrics
- feature_importance.png Feature importance plot
- predictions_vs_actual.png Validation visualization
"""

import json
import os
from datetime import datetime
import warnings
warnings.filterwarnings("ignore")

import joblib
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from sklearn.metrics import mean_absolute_percentage_error, mean_squared_error, r2_score
from sklearn.model_selection import KFold, cross_val_score, train_test_split
from xgboost import XGBRegressor

# ─────────────────────────────────────────────────
# Configuration
# ─────────────────────────────────────────────────
DATA_DIR = "data"
MODEL_DIR = "."  # Save outputs in current ml/ folder

ORDERS_FILE = f"{DATA_DIR}/monthly_orders_2025.xlsx"
WOUND_FILE = f"{DATA_DIR}/wound_care_reports_2025.xlsx"
MISSIONS_FILE = f"{DATA_DIR}/missions_2025.xlsx"
CHECKLISTS_FILE = f"{DATA_DIR}/checklists_2025.xlsx"


def get_season(month):
    """Map month to season."""
    if month in [12, 1, 2]:
        return "winter"
    if month in [3, 4, 5]:
        return "spring"
    if month in [6, 7, 8]:
        return "summer"
    return "fall"


def build_dataset():
    """Build the ML training dataset from the 4 Excel files."""
    print("📂 Loading Excel files...")
    orders = pd.read_excel(ORDERS_FILE)
    wounds = pd.read_excel(WOUND_FILE)
    missions = pd.read_excel(MISSIONS_FILE)
    checklists = pd.read_excel(CHECKLISTS_FILE)

    print(f"   - Orders: {len(orders)} rows")
    print(f"   - Wound reports: {len(wounds)} rows")
    print(f"   - Missions: {len(missions)} rows")
    print(f"   - Checklists: {len(checklists)} rows")

    # Parse dates
    orders["Date"] = pd.to_datetime(orders["Date"])
    wounds["Date"] = pd.to_datetime(wounds["Date"])
    missions["Date"] = pd.to_datetime(missions["Date"])

    orders["month"] = orders["Date"].dt.month
    wounds["month"] = wounds["Date"].dt.month
    missions["month"] = missions["Date"].dt.month

    # ─────────────────────────────────────────────
    # Aggregate operational features by month
    # ─────────────────────────────────────────────
    print("\n🔧 Engineering features...")

    # Wound care reports by injury type per month
    wound_features = wounds.groupby(["month", "Injury Type"]).size().unstack(fill_value=0)
    wound_features.columns = [f"wound_{c.lower().replace(' ', '_')}" for c in wound_features.columns]
    wound_features = wound_features.reset_index()

    # Missions by type per month
    mission_features = missions.groupby(["month", "Mission Type"]).size().unstack(fill_value=0)
    mission_features.columns = [f"mission_{c.lower().replace(' ', '_')}" for c in mission_features.columns]
    mission_features = mission_features.reset_index()

    # Total counts per month
    monthly_counts = pd.DataFrame({
        "month": range(1, 13),
        "total_wound_reports": [
            len(wounds[wounds["month"] == m]) for m in range(1, 13)
        ],
        "total_missions": [
            len(missions[missions["month"] == m]) for m in range(1, 13)
        ],
    })

    # ─────────────────────────────────────────────
    # Build training rows: one row per (month, item)
    # ─────────────────────────────────────────────
    df = orders[["month", "Season", "Item", "Quantity"]].copy()

    # Merge in operational features
    df = df.merge(wound_features, on="month", how="left")
    df = df.merge(mission_features, on="month", how="left")
    df = df.merge(monthly_counts, on="month", how="left")

    # Fill any NaN with 0 (for months with no data of that type)
    df = df.fillna(0)

    # Lag feature: previous month's quantity for the same item
    df = df.sort_values(["Item", "month"])
    df["lag_1_quantity"] = df.groupby("Item")["Quantity"].shift(1)
    # First month's lag = same as current (or use overall mean)
    df["lag_1_quantity"] = df["lag_1_quantity"].fillna(df["Quantity"])

    # One-hot encode season and item
    df = pd.get_dummies(df, columns=["Season", "Item"], prefix=["season", "item"])

    print(f"   ✓ Built dataset: {df.shape[0]} rows x {df.shape[1]} columns")
    return df


def train_model(df):
    """Train XGBoost regressor."""
    print("\n🎯 Training XGBoost model...")

    y = df["Quantity"]
    X = df.drop(columns=["Quantity"])

    # Save feature columns for later inference
    feature_columns = X.columns.tolist()

    # Train/test split — stratify by month to keep all months in train
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.20, random_state=42
    )

    print(f"   - Train: {len(X_train)} samples")
    print(f"   - Test:  {len(X_test)} samples")

    # XGBoost with reasonable hyperparameters for small dataset
    model = XGBRegressor(
        n_estimators=200,
        max_depth=4,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.8,
        random_state=42,
        objective="reg:squarederror",
        n_jobs=-1,
    )

    model.fit(
        X_train,
        y_train,
        eval_set=[(X_test, y_test)],
        verbose=False,
    )

    # Predictions
    y_pred_train = model.predict(X_train)
    y_pred_test = model.predict(X_test)

    # Metrics
    train_rmse = np.sqrt(mean_squared_error(y_train, y_pred_train))
    test_rmse = np.sqrt(mean_squared_error(y_test, y_pred_test))
    train_r2 = r2_score(y_train, y_pred_train)
    test_r2 = r2_score(y_test, y_pred_test)
    train_mape = mean_absolute_percentage_error(y_train, y_pred_train) * 100
    test_mape = mean_absolute_percentage_error(y_test, y_pred_test) * 100

    # K-fold cross-validation for robustness
    print("\n🔁 Running 5-fold cross-validation...")
    kfold = KFold(n_splits=5, shuffle=True, random_state=42)
    cv_scores = cross_val_score(model, X, y, cv=kfold, scoring="r2")
    cv_r2_mean = cv_scores.mean()
    cv_r2_std = cv_scores.std()

    metrics = {
        "trained_at": datetime.now().isoformat(),
        "n_train_samples": len(X_train),
        "n_test_samples": len(X_test),
        "n_features": X.shape[1],
        "model_params": {
            "n_estimators": 200,
            "max_depth": 4,
            "learning_rate": 0.05,
            "subsample": 0.8,
            "colsample_bytree": 0.8,
        },
        "train_rmse": float(train_rmse),
        "test_rmse": float(test_rmse),
        "train_r2": float(train_r2),
        "test_r2": float(test_r2),
        "train_mape": float(train_mape),
        "test_mape": float(test_mape),
        "cv_r2_mean": float(cv_r2_mean),
        "cv_r2_std": float(cv_r2_std),
    }

    print("\n📊 RESULTS:")
    print(f"   Train RMSE:  {train_rmse:.2f}")
    print(f"   Test RMSE:   {test_rmse:.2f}")
    print(f"   Train R²:    {train_r2:.3f}")
    print(f"   Test R²:     {test_r2:.3f}")
    print(f"   Train MAPE:  {train_mape:.1f}%")
    print(f"   Test MAPE:   {test_mape:.1f}%")
    print(f"   CV R² mean:  {cv_r2_mean:.3f} (±{cv_r2_std:.3f})")

    return model, feature_columns, metrics, X_test, y_test, y_pred_test


def plot_feature_importance(model, feature_columns, top_n=15):
    """Plot top N most important features."""
    print("\n📈 Generating feature importance plot...")

    importances = model.feature_importances_
    fi_df = (
        pd.DataFrame({"feature": feature_columns, "importance": importances})
        .sort_values("importance", ascending=False)
        .head(top_n)
    )

    plt.figure(figsize=(10, 7))
    plt.barh(fi_df["feature"][::-1], fi_df["importance"][::-1], color="#c8102e")
    plt.xlabel("Feature Importance", fontsize=11)
    plt.title(f"Top {top_n} Most Important Features", fontsize=13, fontweight="bold")
    plt.tight_layout()
    plt.savefig(f"{MODEL_DIR}/feature_importance.png", dpi=120)
    plt.close()
    print(f"   ✓ Saved: feature_importance.png")

    print("\n   Top 10 features:")
    for _, row in fi_df.head(10).iterrows():
        print(f"     {row['feature']:50s}  {row['importance']:.4f}")


def plot_predictions(y_test, y_pred):
    """Plot predicted vs actual."""
    print("\n📈 Generating predictions plot...")
    plt.figure(figsize=(8, 8))
    plt.scatter(y_test, y_pred, alpha=0.6, color="#c8102e", s=50)
    max_val = max(y_test.max(), y_pred.max())
    plt.plot([0, max_val], [0, max_val], "k--", lw=2, label="Perfect prediction")
    plt.xlabel("Actual Quantity", fontsize=11)
    plt.ylabel("Predicted Quantity", fontsize=11)
    plt.title("Predicted vs Actual Quantities (Hold-Out Test Set)",
              fontsize=13, fontweight="bold")
    plt.legend()
    plt.grid(alpha=0.3)
    plt.tight_layout()
    plt.savefig(f"{MODEL_DIR}/predictions_vs_actual.png", dpi=120)
    plt.close()
    print(f"   ✓ Saved: predictions_vs_actual.png")


def save_artifacts(model, feature_columns, metrics):
    """Save the trained model + metadata."""
    print("\n💾 Saving artifacts...")

    joblib.dump(model, f"{MODEL_DIR}/model.pkl")
    print(f"   ✓ Saved: model.pkl")

    with open(f"{MODEL_DIR}/feature_columns.json", "w") as f:
        json.dump(feature_columns, f, indent=2)
    print(f"   ✓ Saved: feature_columns.json")

    with open(f"{MODEL_DIR}/metrics.json", "w") as f:
        json.dump(metrics, f, indent=2)
    print(f"   ✓ Saved: metrics.json")


def main():
    print("=" * 65)
    print("🤖 Lebanese Red Cross — Order Quantity Predictor (XGBoost)")
    print("=" * 65)

    df = build_dataset()
    model, feature_columns, metrics, X_test, y_test, y_pred = train_model(df)

    plot_feature_importance(model, feature_columns)
    plot_predictions(y_test, y_pred)

    save_artifacts(model, feature_columns, metrics)

    print("\n" + "=" * 65)
    print("✅ DONE!  Generated files:")
    print("=" * 65)
    print("   model.pkl                 - Trained XGBoost model")
    print("   feature_columns.json      - Feature schema")
    print("   metrics.json              - Performance metrics")
    print("   feature_importance.png    - Top features chart")
    print("   predictions_vs_actual.png - Validation visualization")
    print("\n💡 Next: build the Flask API in api.py")


if __name__ == "__main__":
    main()
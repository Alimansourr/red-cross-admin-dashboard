// Service for calling the Flask ML API

const API_BASE_URL =
  process.env.REACT_APP_FORECAST_API_URL || "http://localhost:5001";

/**
 * Check if the Flask API is reachable
 */
export async function checkApiHealth() {
  try {
    const response = await fetch(`${API_BASE_URL}/`);
    if (!response.ok) throw new Error(`API returned ${response.status}`);
    return await response.json();
  } catch (err) {
    throw new Error(
      `Cannot reach forecast API at ${API_BASE_URL}. Make sure your Python Flask server is running (python api.py).`
    );
  }
}

/**
 * Get model performance metrics
 */
export async function getModelMetrics() {
  const response = await fetch(`${API_BASE_URL}/metrics`);
  if (!response.ok) throw new Error("Failed to load metrics");
  return await response.json();
}

/**
 * Get top feature importances
 */
export async function getFeatureImportance() {
  const response = await fetch(`${API_BASE_URL}/feature-importance`);
  if (!response.ok) throw new Error("Failed to load feature importance");
  return await response.json();
}

/**
 * Predict order quantities for a given month
 */
export async function predictOrder(month, year = 2026) {
  const response = await fetch(`${API_BASE_URL}/predict`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ month, year }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Prediction failed: ${text}`);
  }
  return await response.json();
}
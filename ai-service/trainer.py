import os
import joblib
import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
from datetime import datetime
from dotenv import load_dotenv
from features import build_training_matrix

load_dotenv()

MODEL_DIR  = os.getenv('MODEL_DIR', 'models')
MODEL_PATH = os.path.join(MODEL_DIR, 'isolation_forest.pkl')
SCALER_PATH = os.path.join(MODEL_DIR, 'scaler.pkl')

os.makedirs(MODEL_DIR, exist_ok=True)


def train_model():
    """
    Train Isolation Forest on current device metrics.

    Why Isolation Forest?
    - Unsupervised: no labeled "anomaly" data needed
    - Works on small datasets (20+ samples is enough)
    - Fast, interpretable, proven in network monitoring
    - Naturally handles multi-dimensional features
    - contamination param = expected % of anomalies (10% default)
    """
    print(f"[Trainer] Building feature matrix...")
    X, device_ids = build_training_matrix()

    if len(X) == 0:
        print("[Trainer] Not enough data to train. Need at least 5 metrics per device.")
        return False

    print(f"[Trainer] Training on {len(X)} device feature vectors...")

    # Scale features — IsolationForest is sensitive to scale
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    # Train model
    # contamination: fraction of data expected to be anomalous
    # n_estimators: more trees = more stable, slower training
    contamination = float(os.getenv('CONTAMINATION', 0.1))
    model = IsolationForest(
        n_estimators=200,
        contamination=contamination,
        random_state=42,
        n_jobs=-1,       # Use all CPU cores
        bootstrap=True,
    )
    model.fit(X_scaled)

    # Save model + scaler
    joblib.dump(model, MODEL_PATH)
    joblib.dump(scaler, SCALER_PATH)

    print(f"[Trainer] ✅ Model trained and saved → {MODEL_PATH}")
    print(f"[Trainer] Devices used for training: {len(device_ids)}")
    return True


def load_model():
    """Load saved model and scaler"""
    if not os.path.exists(MODEL_PATH) or not os.path.exists(SCALER_PATH):
        return None, None
    model  = joblib.load(MODEL_PATH)
    scaler = joblib.load(SCALER_PATH)
    return model, scaler


def model_exists():
    return os.path.exists(MODEL_PATH) and os.path.exists(SCALER_PATH)
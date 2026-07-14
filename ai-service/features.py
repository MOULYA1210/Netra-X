import numpy as np
import pandas as pd
from pymongo import MongoClient
from datetime import datetime, timedelta
import os
from dotenv import load_dotenv

load_dotenv()

def get_db():
    client = MongoClient(os.getenv('MONGO_URI', 'mongodb://localhost:27017/netrax'))
    return client['netrax']

def fetch_metrics_for_device(device_id: str, hours: int = 24) -> pd.DataFrame:
    """
    Fetch recent ping metrics for a device from MongoDB
    """
    db = get_db()
    since = datetime.utcnow() - timedelta(hours=hours)

    cursor = db.metrics.find(
        {
            'deviceId': {'$exists': True},
            'type': 'ping',
            'timestamp': {'$gte': since},
            '$expr': {'$eq': [{'$toString': '$deviceId'}, str(device_id)]}
        },
        sort=[('timestamp', 1)]
    )

    records = list(cursor)
    if not records:
        return pd.DataFrame()

    rows = []
    for r in records:
        ping = r.get('ping', {})
        rows.append({
            'timestamp':    r.get('timestamp'),
            'alive':        1 if ping.get('alive') else 0,
            'responseTime': ping.get('responseTime') or 0,
            'packetLoss':   ping.get('packetLoss') or 0,
        })

    return pd.DataFrame(rows)


def fetch_all_recent_metrics(hours: int = 6) -> pd.DataFrame:
    """
    Fetch recent metrics for ALL devices — used for bulk analysis
    """
    db = get_db()
    since = datetime.utcnow() - timedelta(hours=hours)

    cursor = db.metrics.find(
        {'type': 'ping', 'timestamp': {'$gte': since}},
        sort=[('timestamp', 1)]
    )

    records = list(cursor)
    if not records:
        return pd.DataFrame()

    rows = []
    for r in records:
        ping = r.get('ping', {})
        rows.append({
            'deviceId':     str(r.get('deviceId', '')),
            'ipAddress':    r.get('ipAddress', ''),
            'timestamp':    r.get('timestamp'),
            'alive':        1 if ping.get('alive') else 0,
            'responseTime': ping.get('responseTime') or 0,
            'packetLoss':   ping.get('packetLoss') or 0,
        })

    return pd.DataFrame(rows)


def engineer_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Transform raw time-series into ML features per device.

    Features explained:
    - mean_rtt       : average response time (baseline)
    - std_rtt        : standard deviation (consistency)
    - max_rtt        : worst case response time
    - min_rtt        : best case
    - rtt_range      : max - min (spread)
    - packet_loss    : % failed pings
    - alive_ratio    : % successful pings
    - rtt_cv         : coefficient of variation (std/mean) — normalized variability
    - spike_count    : how many RTTs exceed 2x the mean
    - recent_trend   : is RTT getting worse? (slope of last 5 readings)
    """
    if df.empty:
        return pd.DataFrame()

    features = {}

    rtt = df['responseTime'].values
    alive = df['alive'].values

    features['mean_rtt']     = np.mean(rtt)
    features['std_rtt']      = np.std(rtt)
    features['max_rtt']      = np.max(rtt)
    features['min_rtt']      = np.min(rtt)
    features['rtt_range']    = np.max(rtt) - np.min(rtt)
    features['packet_loss']  = np.mean(df['packetLoss'].values)
    features['alive_ratio']  = np.mean(alive)
    features['rtt_cv']       = (np.std(rtt) / np.mean(rtt)) if np.mean(rtt) > 0 else 0

    # Spike: readings more than 2x the mean
    mean = np.mean(rtt)
    features['spike_count']  = int(np.sum(rtt > 2 * mean)) if mean > 0 else 0

    # Trend: slope of last 5 readings (positive = getting worse)
    if len(rtt) >= 5:
        last5 = rtt[-5:]
        features['recent_trend'] = float(np.polyfit(range(5), last5, 1)[0])
    else:
        features['recent_trend'] = 0.0

    return pd.DataFrame([features])


def build_training_matrix() -> tuple:
    """
    Build feature matrix for ALL devices — used to train the model.
    Returns (X, device_ids)
    """
    df = fetch_all_recent_metrics(hours=24)
    if df.empty:
        return np.array([]), []

    device_ids = df['deviceId'].unique()
    feature_rows = []
    valid_ids = []

    for did in device_ids:
        device_df = df[df['deviceId'] == did]
        if len(device_df) < 5:  # Need at least 5 readings
            continue

        feats = engineer_features(device_df)
        if not feats.empty:
            feature_rows.append(feats.values[0])
            valid_ids.append(did)

    if not feature_rows:
        return np.array([]), []

    return np.array(feature_rows), valid_ids
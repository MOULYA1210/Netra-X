import numpy as np
import pandas as pd
from datetime import datetime
from features import (
    fetch_metrics_for_device,
    fetch_all_recent_metrics,
    engineer_features,
    get_db,
)
from trainer import load_model, model_exists


def score_to_severity(score: float) -> str:
    """
    Convert anomaly score (0-100) to human-readable severity.
    Score = 0   → completely normal
    Score = 100 → extreme anomaly
    """
    if score >= 75: return 'critical'
    if score >= 50: return 'high'
    if score >= 30: return 'medium'
    if score >= 10: return 'low'
    return 'normal'


def isolation_score_to_pct(raw_score: float) -> float:
    """
    Convert Isolation Forest decision score to 0-100 anomaly score.
    IsolationForest returns:
        positive = normal
        negative = anomaly
    We map this to 0 (normal) → 100 (extreme anomaly)
    """
    # Clamp to typical range
    clamped = max(-0.5, min(0.5, raw_score))
    # Invert and normalize: more negative = higher anomaly score
    pct = (0.5 - clamped) * 100
    return round(max(0, min(100, pct)), 1)


def analyze_device(device_id: str, device_name: str, ip_address: str) -> dict:
    """
    Run anomaly detection on a single device.
    Returns anomaly result dict.
    """
    model, scaler = load_model()

    df = fetch_metrics_for_device(device_id, hours=6)
    if df.empty or len(df) < 5:
        return {
            'deviceId':    device_id,
            'deviceName':  device_name,
            'ipAddress':   ip_address,
            'status':      'insufficient_data',
            'message':     f'Need at least 5 metric readings (have {len(df)})',
            'anomalyScore': 0,
            'severity':    'normal',
            'features':    {},
        }

    # Engineer features
    feats = engineer_features(df)
    if feats.empty:
        return {
            'deviceId':    device_id,
            'deviceName':  device_name,
            'ipAddress':   ip_address,
            'status':      'feature_error',
            'anomalyScore': 0,
            'severity':    'normal',
            'features':    {},
        }

    feature_dict = feats.to_dict(orient='records')[0]

    result = {
        'deviceId':    device_id,
        'deviceName':  device_name,
        'ipAddress':   ip_address,
        'features':    feature_dict,
        'dataPoints':  len(df),
        'analyzedAt':  datetime.utcnow().isoformat(),
    }

    # If no model yet, use rule-based fallback
    if not model_exists() or model is None:
        score, reasons = rule_based_score(feature_dict)
        result.update({
            'status':       'rule_based',
            'anomalyScore':  score,
            'severity':      score_to_severity(score),
            'reasons':       reasons,
            'modelUsed':    'rule_based_fallback',
        })
        return result

    # Use ML model
    X = feats.values
    X_scaled = scaler.transform(X)

    raw_score   = float(model.decision_function(X_scaled)[0])
    is_anomaly  = model.predict(X_scaled)[0] == -1  # -1 = anomaly
    anomaly_pct = isolation_score_to_pct(raw_score)

    reasons = build_reasons(feature_dict, is_anomaly)

    result.update({
        'status':       'analyzed',
        'anomalyScore':  anomaly_pct,
        'severity':      score_to_severity(anomaly_pct),
        'isAnomaly':     is_anomaly,
        'rawScore':      raw_score,
        'reasons':       reasons,
        'modelUsed':    'isolation_forest',
    })

    return result


def rule_based_score(features: dict) -> tuple:
    """
    Fallback when model is not trained yet.
    Simple threshold-based scoring.
    """
    score = 0
    reasons = []

    mean_rtt = features.get('mean_rtt', 0)
    packet_loss = features.get('packet_loss', 0)
    spike_count = features.get('spike_count', 0)
    rtt_cv = features.get('rtt_cv', 0)
    alive_ratio = features.get('alive_ratio', 1)
    recent_trend = features.get('recent_trend', 0)

    if mean_rtt > 200:
        score += 35
        reasons.append(f'High average RTT: {mean_rtt:.1f}ms (threshold: 200ms)')
    elif mean_rtt > 100:
        score += 15
        reasons.append(f'Elevated RTT: {mean_rtt:.1f}ms')

    if packet_loss > 20:
        score += 40
        reasons.append(f'High packet loss: {packet_loss:.1f}%')
    elif packet_loss > 5:
        score += 20
        reasons.append(f'Elevated packet loss: {packet_loss:.1f}%')

    if spike_count > 5:
        score += 20
        reasons.append(f'Frequent RTT spikes: {spike_count} occurrences')

    if rtt_cv > 0.5:
        score += 15
        reasons.append(f'Unstable latency (CV: {rtt_cv:.2f})')

    if alive_ratio < 0.8:
        score += 30
        reasons.append(f'Low availability: {alive_ratio*100:.1f}%')

    if recent_trend > 10:
        score += 15
        reasons.append(f'RTT trending upward: +{recent_trend:.1f}ms/check')

    return min(score, 100), reasons


def build_reasons(features: dict, is_anomaly: bool) -> list:
    """Build human-readable explanation of why something is anomalous"""
    reasons = []

    mean_rtt    = features.get('mean_rtt', 0)
    packet_loss = features.get('packet_loss', 0)
    spike_count = features.get('spike_count', 0)
    rtt_cv      = features.get('rtt_cv', 0)
    alive_ratio = features.get('alive_ratio', 1)
    trend       = features.get('recent_trend', 0)

    if mean_rtt > 200:
        reasons.append(f'High average RTT: {mean_rtt:.1f}ms')
    if packet_loss > 10:
        reasons.append(f'Elevated packet loss: {packet_loss:.1f}%')
    if spike_count > 3:
        reasons.append(f'RTT spikes detected: {spike_count}x')
    if rtt_cv > 0.5:
        reasons.append(f'Inconsistent latency (CV={rtt_cv:.2f})')
    if alive_ratio < 0.9:
        reasons.append(f'Availability issues: {alive_ratio*100:.1f}% uptime')
    if trend > 5:
        reasons.append(f'Latency trending up: +{trend:.1f}ms/check')
    if is_anomaly and not reasons:
        reasons.append('Statistical outlier vs. fleet baseline')

    return reasons


def analyze_all_devices() -> list:
    """
    Run anomaly detection across all monitored devices.
    Returns list of results sorted by anomaly score.
    """
    db = get_db()
    devices = list(db.devices.find({'monitoringEnabled': True}, {
        'name': 1, 'ipAddress': 1
    }))

    if not devices:
        return []

    results = []
    for device in devices:
        result = analyze_device(
            str(device['_id']),
            device.get('name', 'Unknown'),
            device.get('ipAddress', ''),
        )
        results.append(result)

    # Sort: anomalies first, then by score descending
    results.sort(key=lambda x: x.get('anomalyScore', 0), reverse=True)
    return results


def save_anomaly(result: dict):
    """Persist anomaly result to MongoDB"""
    if result.get('anomalyScore', 0) < 10:
        return  # Don't save normal readings

    db = get_db()
    db.anomalies.insert_one({
        **result,
        'savedAt': datetime.utcnow(),
    })
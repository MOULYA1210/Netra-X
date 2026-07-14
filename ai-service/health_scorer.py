import numpy as np
from datetime import datetime, timedelta
from features import get_db, fetch_metrics_for_device, engineer_features


def compute_health_score(device_id: str, device_name: str, ip_address: str) -> dict:
    """
    Compute a 0-100 health score for a device.
    100 = perfectly healthy, 0 = completely failed.

    Scoring components (weights sum to 100):
    ┌─────────────────────┬────────┐
    │ Component           │ Weight │
    ├─────────────────────┼────────┤
    │ Availability        │  35%   │
    │ Latency quality     │  25%   │
    │ Packet loss         │  20%   │
    │ Stability (jitter)  │  15%   │
    │ Trend direction     │   5%   │
    └─────────────────────┴────────┘
    """
    db = get_db()

    # Fetch last 24h of metrics
    from features import fetch_metrics_for_device
    df = fetch_metrics_for_device(device_id, hours=24)

    if df.empty or len(df) < 3:
        return {
            'deviceId':    device_id,
            'deviceName':  device_name,
            'ipAddress':   ip_address,
            'healthScore': None,
            'grade':       'N/A',
            'status':      'insufficient_data',
            'components':  {},
            'message':     f'Need at least 3 readings (have {len(df)})',
        }

    rtt        = df['responseTime'].values
    alive      = df['alive'].values
    loss       = df['packetLoss'].values
    feats      = engineer_features(df)
    feat_dict  = feats.to_dict(orient='records')[0] if not feats.empty else {}

    # ── Component 1: Availability (35 pts) ──────────────────────────────────
    alive_ratio       = float(np.mean(alive))
    availability_pts  = alive_ratio * 35

    # ── Component 2: Latency Quality (25 pts) ───────────────────────────────
    mean_rtt = float(np.mean(rtt[alive == 1])) if np.any(alive == 1) else 999
    if mean_rtt <= 20:    latency_pts = 25
    elif mean_rtt <= 50:  latency_pts = 22
    elif mean_rtt <= 100: latency_pts = 17
    elif mean_rtt <= 200: latency_pts = 10
    elif mean_rtt <= 500: latency_pts = 4
    else:                 latency_pts = 0

    # ── Component 3: Packet Loss (20 pts) ───────────────────────────────────
    avg_loss = float(np.mean(loss))
    if avg_loss == 0:     loss_pts = 20
    elif avg_loss <= 1:   loss_pts = 18
    elif avg_loss <= 5:   loss_pts = 12
    elif avg_loss <= 15:  loss_pts = 5
    else:                 loss_pts = 0

    # ── Component 4: Stability / Jitter (15 pts) ────────────────────────────
    rtt_cv = feat_dict.get('rtt_cv', 0)
    if rtt_cv <= 0.1:    stability_pts = 15
    elif rtt_cv <= 0.25: stability_pts = 12
    elif rtt_cv <= 0.5:  stability_pts = 7
    elif rtt_cv <= 1.0:  stability_pts = 3
    else:                stability_pts = 0

    # ── Component 5: Trend (5 pts) ──────────────────────────────────────────
    trend = feat_dict.get('recent_trend', 0)
    if trend <= 0:   trend_pts = 5    # Improving or stable
    elif trend <= 5: trend_pts = 3
    elif trend <= 15:trend_pts = 1
    else:            trend_pts = 0

    # ── Total ────────────────────────────────────────────────────────────────
    total = availability_pts + latency_pts + loss_pts + stability_pts + trend_pts
    total = round(max(0, min(100, total)), 1)

    # ── Grade ────────────────────────────────────────────────────────────────
    grade = (
        'A' if total >= 90 else
        'B' if total >= 75 else
        'C' if total >= 60 else
        'D' if total >= 40 else
        'F'
    )

    # ── Failure Risk (inverse of health, weighted) ───────────────────────────
    failure_risk = round(100 - total, 1)
    risk_level = (
        'critical' if failure_risk >= 70 else
        'high'     if failure_risk >= 50 else
        'medium'   if failure_risk >= 30 else
        'low'      if failure_risk >= 10 else
        'minimal'
    )

    return {
        'deviceId':    device_id,
        'deviceName':  device_name,
        'ipAddress':   ip_address,
        'healthScore': total,
        'grade':       grade,
        'failureRisk': failure_risk,
        'riskLevel':   risk_level,
        'status':      'scored',
        'components': {
            'availability': round(availability_pts, 1),
            'latency':      round(latency_pts, 1),
            'packetLoss':   round(loss_pts, 1),
            'stability':    round(stability_pts, 1),
            'trend':        round(trend_pts, 1),
        },
        'metrics': {
            'alive_ratio': round(alive_ratio * 100, 1),
            'mean_rtt':    round(mean_rtt, 1),
            'avg_loss':    round(avg_loss, 1),
            'rtt_cv':      round(rtt_cv, 3),
            'trend':       round(trend, 2),
        },
        'dataPoints':  len(df),
        'scoredAt':    datetime.utcnow().isoformat(),
    }


def score_all_devices() -> list:
    """Score health for all monitored devices, sorted by risk."""
    db = get_db()
    devices = list(db.devices.find(
        {'monitoringEnabled': True},
        {'name': 1, 'ipAddress': 1}
    ))

    results = []
    for device in devices:
        score = compute_health_score(
            str(device['_id']),
            device.get('name', 'Unknown'),
            device.get('ipAddress', ''),
        )
        results.append(score)

    # Sort: highest risk first
    results.sort(key=lambda x: x.get('failureRisk', 0), reverse=True)
    return results
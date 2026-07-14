import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from sklearn.linear_model import LinearRegression
from sklearn.preprocessing import PolynomialFeatures
from sklearn.pipeline import make_pipeline
import warnings
warnings.filterwarnings('ignore')

from features import get_db, fetch_metrics_for_device


def fetch_rtt_series(device_id: str, hours: int = 24) -> pd.DataFrame:
    """
    Fetch RTT time series for a device.
    Returns DataFrame with timestamp + responseTime columns.
    """
    db = get_db()
    since = datetime.utcnow() - timedelta(hours=hours)

    cursor = db.metrics.find(
        {
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
        if ping.get('alive') and ping.get('responseTime') is not None:
            rows.append({
                'timestamp':    r['timestamp'],
                'responseTime': float(ping['responseTime']),
                'packetLoss':   float(ping.get('packetLoss', 0)),
            })

    return pd.DataFrame(rows)


def moving_average(values: np.ndarray, window: int = 5) -> np.ndarray:
    """Simple moving average smoothing"""
    if len(values) < window:
        return values
    return np.convolve(values, np.ones(window) / window, mode='valid')


def forecast_rtt(device_id: str, horizon_minutes: int = 60) -> dict:
    """
    Forecast RTT for the next N minutes using polynomial regression.

    Steps:
    1. Fetch historical RTT data
    2. Smooth with moving average
    3. Fit polynomial regression on time index
    4. Project forward by horizon_minutes
    5. Return forecast points + confidence band
    """
    df = fetch_rtt_series(device_id, hours=12)

    if df.empty or len(df) < 10:
        return {
            'status':  'insufficient_data',
            'message': f'Need at least 10 data points (have {len(df)})',
            'forecast': [],
        }

    # Use time index (0, 1, 2...) as X — simpler than datetime math
    rtt = df['responseTime'].values
    smoothed = moving_average(rtt, window=min(5, len(rtt) // 2))
    X = np.arange(len(smoothed)).reshape(-1, 1)

    # Degree-2 polynomial — captures gentle curves without overfitting
    model = make_pipeline(PolynomialFeatures(degree=2), LinearRegression())
    model.fit(X, smoothed)

    # Calculate residuals for confidence interval
    residuals = smoothed - model.predict(X)
    std_residual = np.std(residuals)

    # --- Historical fit points (for chart baseline) ---
    history_points = []
    step_size_minutes = 1  # Assume ~1 reading per minute (adjust for your interval)
    for i, (ts, rtt_val) in enumerate(zip(df['timestamp'].values[-len(smoothed):], smoothed)):
        history_points.append({
            'time':     pd.Timestamp(ts).strftime('%H:%M'),
            'actual':   round(float(rtt_val), 2),
            'forecast': round(float(model.predict([[i]])[0]), 2),
        })

    # --- Future forecast points ---
    last_idx = len(smoothed)
    interval_steps = max(1, horizon_minutes)
    forecast_points = []

    for step in range(1, interval_steps + 1, max(1, interval_steps // 20)):
        future_idx = last_idx + step
        predicted  = float(model.predict([[future_idx]])[0])
        predicted  = max(0, predicted)   # RTT can't be negative

        future_time = (
            pd.Timestamp(df['timestamp'].values[-1]) +
            pd.Timedelta(minutes=step * step_size_minutes)
        )

        forecast_points.append({
            'time':       future_time.strftime('%H:%M'),
            'forecast':   round(predicted, 2),
            'upper':      round(predicted + 1.96 * std_residual, 2),
            'lower':      round(max(0, predicted - 1.96 * std_residual), 2),
        })

    # --- Trend direction ---
    if len(smoothed) >= 2:
        first_half = np.mean(smoothed[:len(smoothed)//2])
        second_half = np.mean(smoothed[len(smoothed)//2:])
        trend_pct = ((second_half - first_half) / max(first_half, 1)) * 100
    else:
        trend_pct = 0

    trend_direction = (
        'increasing' if trend_pct > 5 else
        'decreasing' if trend_pct < -5 else
        'stable'
    )

    # --- Final forecasted value ---
    final_predicted = forecast_points[-1]['forecast'] if forecast_points else None

    return {
        'status':           'success',
        'deviceId':         device_id,
        'metric':           'responseTime',
        'dataPoints':       len(df),
        'horizon_minutes':  horizon_minutes,
        'trend_direction':  trend_direction,
        'trend_pct':        round(trend_pct, 1),
        'current_avg_rtt':  round(float(np.mean(rtt[-10:])), 2),
        'forecasted_rtt':   final_predicted,
        'std_residual':     round(std_residual, 2),
        'history':          history_points[-30:],   # Last 30 for chart
        'forecast':         forecast_points,
        'generatedAt':      datetime.utcnow().isoformat(),
    }


def forecast_packet_loss(device_id: str, horizon_minutes: int = 60) -> dict:
    """
    Forecast packet loss trend.
    Uses same approach as RTT but on packetLoss field.
    """
    df = fetch_rtt_series(device_id, hours=12)

    if df.empty or len(df) < 10:
        return {'status': 'insufficient_data', 'forecast': []}

    loss = df['packetLoss'].values
    X    = np.arange(len(loss)).reshape(-1, 1)

    model = make_pipeline(PolynomialFeatures(degree=2), LinearRegression())
    model.fit(X, loss)

    last_idx = len(loss)
    forecast_points = []

    for step in range(1, horizon_minutes + 1, max(1, horizon_minutes // 20)):
        predicted = float(model.predict([[last_idx + step]])[0])
        predicted = max(0, min(100, predicted))   # Clamp 0-100%
        future_time = (
            pd.Timestamp(df['timestamp'].values[-1]) +
            pd.Timedelta(minutes=step)
        )
        forecast_points.append({
            'time':     future_time.strftime('%H:%M'),
            'forecast': round(predicted, 2),
        })

    current_loss = float(np.mean(loss[-10:]))
    final_loss   = forecast_points[-1]['forecast'] if forecast_points else current_loss
    loss_worsening = final_loss > current_loss + 5

    return {
        'status':          'success',
        'current_loss':    round(current_loss, 2),
        'forecasted_loss': round(final_loss, 2),
        'loss_worsening':  loss_worsening,
        'forecast':        forecast_points,
        'generatedAt':     datetime.utcnow().isoformat(),
    }


def forecast_all_devices(horizon_minutes: int = 60) -> list:
    """
    Run RTT forecast for all monitored devices.
    """
    db = get_db()
    devices = list(db.devices.find(
        {'monitoringEnabled': True},
        {'name': 1, 'ipAddress': 1}
    ))

    results = []
    for device in devices:
        did = str(device['_id'])
        rtt_forecast  = forecast_rtt(did, horizon_minutes)
        loss_forecast = forecast_packet_loss(did, horizon_minutes)

        results.append({
            'deviceId':   did,
            'deviceName': device.get('name', 'Unknown'),
            'ipAddress':  device.get('ipAddress', ''),
            'rtt':        rtt_forecast,
            'packetLoss': loss_forecast,
        })

    return results
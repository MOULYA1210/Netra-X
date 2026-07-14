from flask import Flask, jsonify, request
from flask_cors import CORS
from dotenv import load_dotenv
import os
import threading

from trainer import train_model, model_exists
from detector import analyze_all_devices, analyze_device, save_anomaly
from forecaster import forecast_rtt, forecast_all_devices, forecast_packet_loss
from health_scorer import compute_health_score, score_all_devices

load_dotenv()

app = Flask(__name__)
CORS(app)  # Allow Node.js backend to call this service

PORT = int(os.getenv('PORT', 5001))

@app.route('/forecast/<device_id>/rtt', methods=['GET'])
def forecast_device_rtt(device_id):
    """Forecast RTT for a specific device"""
    horizon = int(request.args.get('horizon', 60))
    result  = forecast_rtt(device_id, horizon_minutes=horizon)
    return jsonify({'success': True, 'data': result})


@app.route('/forecast/<device_id>/loss', methods=['GET'])
def forecast_device_loss(device_id):
    """Forecast packet loss for a specific device"""
    horizon = int(request.args.get('horizon', 60))
    result  = forecast_packet_loss(device_id, horizon_minutes=horizon)
    return jsonify({'success': True, 'data': result})


@app.route('/forecast/all', methods=['POST'])
def forecast_all():
    """Forecast RTT for all devices"""
    horizon = int(request.json.get('horizon', 60)) if request.json else 60
    results = forecast_all_devices(horizon_minutes=horizon)
    return jsonify({'success': True, 'count': len(results), 'data': results})


# ─── Health Scoring Routes ─────────────────────────────────────────────────────

@app.route('/health-score/<device_id>', methods=['GET'])
def health_score_device(device_id):
    """Compute health score for a single device"""
    from features import get_db
    db = get_db()
    device = db.devices.find_one({'_id': __import__('bson').ObjectId(device_id)})
    if not device:
        return jsonify({'success': False, 'message': 'Device not found'}), 404

    result = compute_health_score(
        device_id,
        device.get('name', 'Unknown'),
        device.get('ipAddress', ''),
    )
    return jsonify({'success': True, 'data': result})


@app.route('/health-score/all', methods=['POST'])
def health_score_all():
    """Score all monitored devices"""
    results = score_all_devices()
    return jsonify({'success': True, 'count': len(results), 'data': results})


# ─── Health ────────────────────────────────────────────────────────────────────
@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        'status':      'ok',
        'service':     'NetraX AI Anomaly Detector',
        'modelTrained': model_exists(),
    })


# ─── Train Model ───────────────────────────────────────────────────────────────
@app.route('/train', methods=['POST'])
def train():
    """
    Trigger model training.
    Runs in background thread so API returns immediately.
    """
    def run_training():
        success = train_model()
        print(f"[AI] Training {'succeeded' if success else 'failed'}")

    thread = threading.Thread(target=run_training)
    thread.daemon = True
    thread.start()

    return jsonify({
        'success': True,
        'message': 'Training started in background',
        'modelExisted': model_exists(),
    })


# ─── Analyze All Devices ───────────────────────────────────────────────────────
@app.route('/analyze', methods=['POST'])
def analyze_all():
    """
    Run anomaly detection on all monitored devices.
    Saves anomalies to MongoDB.
    """
    results = analyze_all_devices()

    # Save anomalies
    saved = 0
    for result in results:
        if result.get('anomalyScore', 0) >= 10:
            save_anomaly(result)
            saved += 1

    anomalies = [r for r in results if r.get('severity') not in ('normal', None)]

    return jsonify({
        'success':       True,
        'totalDevices':  len(results),
        'anomaliesFound': len(anomalies),
        'savedToDb':     saved,
        'results':       results,
    })


# ─── Analyze Single Device ─────────────────────────────────────────────────────
@app.route('/analyze/<device_id>', methods=['POST'])
def analyze_one(device_id):
    body = request.get_json() or {}
    result = analyze_device(
        device_id,
        body.get('deviceName', 'Unknown'),
        body.get('ipAddress', ''),
    )
    if result.get('anomalyScore', 0) >= 10:
        save_anomaly(result)

    return jsonify({'success': True, 'result': result})


# ─── Get Model Status ──────────────────────────────────────────────────────────
@app.route('/model/status', methods=['GET'])
def model_status():
    return jsonify({
        'trained':    model_exists(),
        'modelPath':  'models/isolation_forest.pkl',
    })


if __name__ == '__main__':
    print(f"🤖 NetraX AI Service starting on port {PORT}")
    print(f"📊 Model trained: {model_exists()}")
    app.run(host='0.0.0.0', port=PORT, debug=False)
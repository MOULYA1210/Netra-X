<div align="center">

# ⬡ NetraX
### The Eyes of Intelligent Networks

**AI-Driven Network Management System**  
*Real-Time Monitoring · Anomaly Detection · Predictive Analytics · Automation*

[![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org)
[![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactjs.org)
[![Python](https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://python.org)
[![MongoDB](https://img.shields.io/badge/MongoDB-4EA94B?style=for-the-badge&logo=mongodb&logoColor=white)](https://mongodb.com)
[![scikit-learn](https://img.shields.io/badge/scikit--learn-F7931E?style=for-the-badge&logo=scikit-learn&logoColor=white)](https://scikit-learn.org)

</div>

---

## 🔍 What is NetraX?

NetraX is a production-grade, enterprise-level **Network Management System (NMS)**
built from scratch — going far beyond traditional tools like Nagios and Zabbix by
integrating AI, real-time streaming, predictive analytics, and intelligent automation.

> Built as a Final Year Project in Computer Science & Engineering,
> demonstrating full-stack development, AI/ML integration, and
> real-world network engineering concepts in a single unified platform.

---

## ⚡ Key Features

| Module | Description |
|--------|-------------|
| 🔍 **Network Discovery** | Nmap-powered IP range scanning, OS/port/MAC fingerprinting, auto-save to DB |
| 💓 **Monitoring Engine** | ICMP ping + SNMP data collection, concurrent polling, real-time status tracking |
| 📊 **Live NOC Dashboard** | React dashboard with Recharts, WebSocket live updates, health indicators |
| 🧠 **AI Anomaly Detection** | Isolation Forest on 10 engineered features, 0–100 severity scoring |
| 🔮 **Predictive Analytics** | Polynomial regression RTT forecast (60-min horizon), composite health scoring |
| ⚡ **Automation Engine** | Rule-based triggers (IF/THEN), auto-retry, webhook, 6 action types |
| 🔔 **Alert System** | SMTP email, escalation engine (L1/L2), deduplication, notification center |
| 🛡️ **Security Monitor** | Port scan detection, threat scoring, DDoS pattern recognition, IDS-lite |

---

## 🏗️ System Architecture
┌─────────────────────────────────────────┐
│         PRESENTATION LAYER              │
│   React.js · Vite · Recharts · WS      │
└────────────────┬────────────────────────┘
│
┌────────────────▼────────────────────────┐
│           API GATEWAY LAYER             │
│   Node.js · Express · WebSocket Server  │
└──────────┬─────────────┬───────────────┘
│             │
┌──────────▼──┐   ┌──────▼──────────────┐
│  AI SERVICE │   │    DATA LAYER        │
│ Python Flask│   │ MongoDB · TTL Indexes│
│ scikit-learn│   │ Time-Series Metrics  │
└──────────┬──┘   └─────────────────────┘
│
┌──────────▼────────────────────────────┐
│           NETWORK LAYER                │
│  ICMP · SNMP · Nmap · Packet Inspect  │
└───────────────────────────────────────┘
---

## 🛠️ Tech Stack

**Frontend**
- React.js + Vite
- Recharts (LineChart, ComposedChart, PieChart)
- WebSocket client with auto-reconnect hook
- Dark NOC theme — no CSS framework

**Backend**
- Node.js + Express.js (MVC architecture)
- WebSocket server (ws library)
- node-cron scheduler
- Winston logging
- Nodemailer (SMTP alerts)

**AI / ML Service**
- Python + Flask microservice
- scikit-learn: Isolation Forest, LinearRegression, PolynomialFeatures
- pandas + numpy for feature engineering
- joblib for model persistence

**Database**
- MongoDB with Mongoose ODM
- TTL indexes (7-day metrics, 30-day alerts auto-expiry)
- Compound indexes for time-series queries
- Aggregation pipelines for analytics

**Networking**
- ICMP ping (ping npm package)
- SNMP v2c collection (net-snmp)
- Nmap network scanning (node-nmap)

---

## 📁 Project Structure
netrax/
├── backend/                  # Node.js Express API
│   └── src/
│       ├── controllers/      # Route handlers
│       ├── models/           # Mongoose schemas
│       ├── routes/           # API route definitions
│       ├── services/         # Business logic
│       └── utils/            # Logger, WebSocket, IP utils
│
├── ai-service/               # Python Flask AI microservice
│   ├── app.py                # Flask API routes
│   ├── detector.py           # Isolation Forest detection
│   ├── forecaster.py         # RTT forecasting engine
│   ├── health_scorer.py      # Composite health scoring
│   ├── features.py           # Feature engineering
│   └── trainer.py            # Model training pipeline
│
└── frontend/                 # React.js dashboard
└── src/
├── pages/            # Dashboard, Monitor, Discovery,
│                     # Analytics, Automation, Alerts
├── components/       # Reusable UI components
├── hooks/            # useWebSocket custom hook
└── api/              # Axios instance + interceptors
---

## 🚀 Quick Start

### Prerequisites
- Node.js v18+
- Python 3.9+
- MongoDB (local or Atlas)
- Nmap installed and in PATH

### 1. Clone the repository
```bash
git clone https://github.com/YOUR_USERNAME/netrax.git
cd netrax
```

### 2. Backend setup
```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your MongoDB URI
npm run dev
```

### 3. AI Service setup
```bash
cd ai-service
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # Mac/Linux
pip install -r requirements.txt
python app.py
```

### 4. Frontend setup
```bash
cd frontend
npm install
npm run dev
```

### 5. Open the dashboard
http://localhost:5173
---

## 🌐 API Endpoints
GET/POST   /api/devices              Device management
POST       /api/scan                 Trigger network scan
GET        /api/scan/status/:jobId   Scan job status
GET        /api/metrics/latest       Latest device metrics
POST       /api/anomaly/detect       Run AI detection
POST       /api/anomaly/train        Train ML model
POST       /api/forecast/run         RTT forecasting
GET/POST   /api/rules                Automation rules
GET/PATCH  /api/alerts               Alert management
POST       /api/alerts/bulk          Bulk alert actions
## 👩‍💻 Author

Moulya D U
B.Tech Computer Science & Engineering(Networks)
Presidency University· 2026
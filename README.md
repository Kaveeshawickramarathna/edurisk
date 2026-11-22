# EduRisk — AI-Based Academic Risk Prediction & Early Support System

A full-stack university academic monitoring and early-support platform with a Python/FastAPI machine-learning risk prediction service, PostgreSQL persistence, Email OTP verification, and role-based portals for **Administrators**, **Lecturers**, and **Students**.

> **Decision-Support & Demo ML Notice:** EduRisk is designed as a decision-support tool for university staff. By default, the ML pipeline is trained on a synthetic academic dataset (`is_demo = true`). Risk categories and associated indicators do **not** represent proof of causation or final judgments about a student's ability.

---

## System Architecture

```
React 19 + Tailwind CSS + Recharts (Port 5173)
        │  REST + JWT Bearer Auth
        ▼
Node.js + Express 5 API (Port 5000) ────► Python + FastAPI + scikit-learn ML Service (Port 8000)
        │  SQL (pg / PGlite fallback)
        ▼
PostgreSQL 16 (Docker Port 15432, or embedded PGlite fallback)
```

---

## Key Features & Modules

- **Authentication, Email OTP & Role-Based Access Control (RBAC):**
  - **First-Run Admin Setup:** The very first user who registers via Email OTP automatically becomes the system **Administrator (`ADMIN`)**.
  - **Self-Registration with Email OTP:** Subsequent **Students** and **Lecturers** register using real 6-digit Email OTP verification.
  - **Forgot Password Flow (`/forgot-password`):** Reset forgotten passwords securely via 6-digit Email OTP.
  - **Strong Password Policy:** Enforced on both frontend (live strength meter) and backend (8+ characters, uppercase, lowercase, number, and special character).
- **Administrator Portal:**
  - System overview KPIs, User Management (create/edit users, reset passwords), dedicated **Lecturer Management**, Course & Roster management, Student Profile & GPA/Attendance entry, Academic Settings, and System Health monitoring.
- **Lecturer Portal:**
  - Scoped to assigned courses & enrolled students, bulk inline Course Gradebook, individual Student Academic Record entry (Attendance, GPA, Assignments, Quizzes, Missed Submissions, LMS Activity), AI Risk Prediction triggers, Intervention tracking & Student Support Request inbox, CSV reports, and Lecturer Profile.
- **Student Portal:**
  - Personal academic overview, Course Performance breakdown with an interactive **What-If Goal Simulator**, Learning Action Checklist, Lecturer Support Request form, and Profile & Password management.
- **Academic Risk Prediction (Python / FastAPI / scikit-learn):**
  - Trains and evaluates three candidate models (**Logistic Regression**, **Decision Tree**, **Random Forest**) on a stratified 80/20 held-out test set.
  - Reports **Accuracy, Macro Precision/Recall/F1, High-Risk Recall, Confusion Matrix, and Feature Importances**.
  - Selects the best candidate based on validation metrics rather than model complexity and returns non-causal indicator explanations & tailored early-support actions.

---

## Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | JavaScript, React 19, React Router, Tailwind CSS, Recharts, Lucide Icons, Vite |
| **Backend API** | Node.js, Express 5, JWT, bcrypt, PostgreSQL (`pg`), Email OTP (Apps Script HTTPS / SMTP) |
| **Database** | PostgreSQL 16 (`database/schema.sql`, Docker Compose on `127.0.0.1:15432`), automatic embedded PGlite fallback |
| **ML Service** | Python 3, FastAPI, Uvicorn, scikit-learn, pandas, numpy, joblib |

---

## Quick Start

### 1. Environment Configuration
Copy the example environment file and fill in your local secrets:
```bash
cp edurisk/server/.env.example edurisk/server/.env
```
*(Never commit `server/.env` — it is excluded in `.gitignore`.)*

### 2. Database (PostgreSQL 16 via Docker)
```bash
cd edurisk
docker compose up -d
```
> PostgreSQL runs on `127.0.0.1:15432` (to avoid Windows port `5432` reservations). If external PostgreSQL is not running, the backend automatically falls back to an embedded PostgreSQL engine (`@electric-sql/pglite`) under `server/data/pgdata`.

### 3. Python ML Service (Port 8000)
```bash
cd edurisk/ml_service
python -m venv venv
./venv/Scripts/pip install -r requirements.txt
# Train & evaluate candidate models (Logistic Regression, Decision Tree, Random Forest)
./venv/Scripts/python train.py
# Start FastAPI prediction service
./venv/Scripts/uvicorn main:app --host 127.0.0.1 --port 8000
```

### 4. Backend API (Port 5000)
```bash
cd edurisk/server
npm install
npm run dev
```

### 5. Frontend Client (Port 5173)
```bash
cd edurisk/client
npm install
npm run dev
```

Open **http://localhost:5173** in your browser. On a fresh database, register the first account via `/register` — it will automatically be promoted to **Administrator**.

---

## Machine Learning Evaluation Summary (Demo Dataset)

Dataset: `ml_service/data/demo_academic_dataset.csv` (1,200 synthetic student records; 960 train / 240 held-out test split).

| Candidate Model | Test Accuracy | Macro F1 | High-Risk Recall | Selection Score |
| :--- | :---: | :---: | :---: | :---: |
| **Logistic Regression (Selected)** | **83.3%** | **82.5%** | **80.9%** | **0.817** |
| Random Forest | 80.4% | 79.6% | 76.2% | 0.790 |
| Decision Tree | 80.8% | 80.2% | 80.9% | 0.782 |

To train on a real/public labelled academic CSV dataset:
```bash
./venv/Scripts/python train.py --dataset path/to/labelled_dataset.csv --validated
```

---

## Running Automated Tests

- **ML Pipeline & Schema Tests:**
  ```bash
  edurisk/ml_service/venv/Scripts/python edurisk/ml_service/test_ml.py
  ```
- **Backend API, Database & RBAC Tests (14 suites):**
  ```bash
  npm --prefix edurisk/server test
  ```
- **Frontend Production Build & Lint:**
  ```bash
  npm --prefix edurisk/client run lint
  npm --prefix edurisk/client run build
  ```

---

## Risks, Ethics & Limitations

- **Synthetic Demo Data:** Default predictions are trained on synthetic data and tagged `is_demo: true`. Real deployment requires ethically approved, anonymized institutional data and re-evaluation across student subgroups.
- **No Sensitive Attributes:** Predictions rely strictly on approved academic indicators (attendance, assignments, quizzes, previous GPA, missed submissions, LMS activity).
- **Human-in-the-Loop:** Risk categories serve exclusively to prioritize early academic support and advising.

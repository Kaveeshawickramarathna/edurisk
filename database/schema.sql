-- EduRisk: AI-Based Academic Risk Prediction & Early Support System
-- PostgreSQL Database Schema

DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('STUDENT', 'LECTURER', 'ADMIN');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE risk_level AS ENUM ('LOW', 'MEDIUM', 'HIGH');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role user_role NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS students (
    id SERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE REFERENCES users (id) ON DELETE CASCADE,
    student_identifier VARCHAR(100) UNIQUE NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    major VARCHAR(100) NOT NULL DEFAULT 'Computer Science',
    year_of_study INTEGER NOT NULL DEFAULT 1 CHECK (year_of_study BETWEEN 1 AND 6),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS otp_verifications (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    student_name VARCHAR(200) DEFAULT '',
    otp_hash VARCHAR(255) NOT NULL,
    purpose VARCHAR(50) NOT NULL DEFAULT 'STUDENT_REGISTER',
    expires_at TIMESTAMP NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    verified BOOLEAN NOT NULL DEFAULT FALSE,
    verification_token VARCHAR(128),
    consumed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS lecturers (
    id SERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE REFERENCES users (id) ON DELETE CASCADE,
    employee_id VARCHAR(100) UNIQUE,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    department VARCHAR(100) NOT NULL DEFAULT 'Computing',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS courses (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    department VARCHAR(100) NOT NULL DEFAULT 'Computing',
    credits INTEGER NOT NULL DEFAULT 3 CHECK (credits BETWEEN 1 AND 12),
    lecturer_id INTEGER REFERENCES lecturers (id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS enrollments (
    id SERIAL PRIMARY KEY,
    student_id INTEGER NOT NULL REFERENCES students (id) ON DELETE CASCADE,
    course_id INTEGER NOT NULL REFERENCES courses (id) ON DELETE CASCADE,
    semester VARCHAR(50) NOT NULL,
    enrolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (
        student_id,
        course_id,
        semester
    )
);

CREATE TABLE IF NOT EXISTS academic_records (
    id SERIAL PRIMARY KEY,
    enrollment_id INTEGER UNIQUE NOT NULL REFERENCES enrollments (id) ON DELETE CASCADE,
    attendance_percentage DECIMAL(5, 2) NOT NULL DEFAULT 0.0 CHECK (
        attendance_percentage BETWEEN 0 AND 100
    ),
    assignment_score DECIMAL(5, 2) NOT NULL DEFAULT 0.0 CHECK (
        assignment_score BETWEEN 0 AND 100
    ),
    quiz_score DECIMAL(5, 2) NOT NULL DEFAULT 0.0 CHECK (quiz_score BETWEEN 0 AND 100),
    previous_gpa DECIMAL(3, 2) NOT NULL DEFAULT 3.00 CHECK (previous_gpa BETWEEN 0 AND 4),
    missed_submissions INTEGER NOT NULL DEFAULT 0 CHECK (missed_submissions >= 0),
    lms_activity_score DECIMAL(5, 2) NOT NULL DEFAULT 0.0 CHECK (
        lms_activity_score BETWEEN 0 AND 100
    ),
    notes TEXT DEFAULT '',
    updated_by INTEGER REFERENCES users (id) ON DELETE SET NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS risk_predictions (
    id SERIAL PRIMARY KEY,
    student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    risk_level risk_level NOT NULL,
    probability DECIMAL(5,4) NOT NULL CHECK (probability BETWEEN 0 AND 1),
    class_probabilities JSONB DEFAULT '{}'::jsonb,
    contributing_factors JSONB DEFAULT '[]'::jsonb,
    suggested_actions JSONB DEFAULT '[]'::jsonb,
    explanation_summary TEXT DEFAULT '',
    model_name VARCHAR(100) DEFAULT 'Demo ML Model',
    is_demo BOOLEAN NOT NULL DEFAULT TRUE,
    generated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS interventions (
    id SERIAL PRIMARY KEY,
    student_id INTEGER NOT NULL REFERENCES students (id) ON DELETE CASCADE,
    lecturer_id INTEGER REFERENCES lecturers (id) ON DELETE SET NULL,
    action_type VARCHAR(100) NOT NULL DEFAULT 'Academic Advising',
    notes TEXT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING' CHECK (
        status IN (
            'PENDING',
            'IN_PROGRESS',
            'COMPLETED',
            'FOLLOW_UP_NEEDED'
        )
    ),
    follow_up_date DATE,
    student_visible BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS academic_settings (
    id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    institution_name VARCHAR(255) NOT NULL DEFAULT 'EduRisk University',
    current_semester VARCHAR(50) NOT NULL DEFAULT '2026-S2',
    attendance_warning_threshold DECIMAL(5, 2) NOT NULL DEFAULT 75.00,
    gpa_warning_threshold DECIMAL(3, 2) NOT NULL DEFAULT 2.50,
    high_risk_threshold DECIMAL(4, 2) NOT NULL DEFAULT 0.65,
    medium_risk_threshold DECIMAL(4, 2) NOT NULL DEFAULT 0.35,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_enrollments_student ON enrollments (student_id);

CREATE INDEX IF NOT EXISTS idx_enrollments_course ON enrollments (course_id);

CREATE INDEX IF NOT EXISTS idx_predictions_student_time ON risk_predictions (student_id, generated_at DESC);

CREATE INDEX IF NOT EXISTS idx_interventions_student ON interventions (student_id);

CREATE INDEX IF NOT EXISTS idx_interventions_lecturer ON interventions (lecturer_id);
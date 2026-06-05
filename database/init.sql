CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'user',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS energy_metrics (
    id SERIAL PRIMARY KEY,
    site VARCHAR(120) NOT NULL,
    kilowatts NUMERIC(8, 2) NOT NULL,
    renewable_percentage NUMERIC(5, 2) NOT NULL,
    carbon_grams NUMERIC(8, 2) NOT NULL,
    temperature_c NUMERIC(5, 2) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS alerts (
    id SERIAL PRIMARY KEY,
    type VARCHAR(80) NOT NULL,
    severity VARCHAR(30) NOT NULL,
    message TEXT NOT NULL,
    value NUMERIC(8, 2) NOT NULL,
    threshold NUMERIC(8, 2) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'open',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO users (username, email, password, role)
VALUES (
    'admin',
    'admin@greenops.local',
    '$2b$10$6wrRSnsPrj2azJW1ChQnKeDyM19OOmQLV.ENKhkteR/5OcMJwQa6u',
    'admin'
)
ON CONFLICT (email) DO NOTHING;

INSERT INTO energy_metrics
    (site, kilowatts, renewable_percentage, carbon_grams, temperature_c, created_at)
VALUES
    ('Paris DC-1', 58.40, 64.00, 312.00, 22.10, NOW() - INTERVAL '55 minutes'),
    ('Paris DC-1', 62.90, 60.50, 338.20, 22.40, NOW() - INTERVAL '45 minutes'),
    ('Paris DC-1', 71.30, 52.10, 401.90, 23.00, NOW() - INTERVAL '35 minutes'),
    ('Lyon Edge', 42.20, 74.30, 201.40, 20.60, NOW() - INTERVAL '30 minutes'),
    ('Lyon Edge', 47.80, 69.90, 230.10, 21.20, NOW() - INTERVAL '20 minutes'),
    ('Nantes Lab', 36.60, 81.40, 168.80, 19.90, NOW() - INTERVAL '10 minutes');

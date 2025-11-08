-- Schéma de base de données pour le système de microcrédit

-- Table des agents de crédit
CREATE TABLE IF NOT EXISTS agents (
    id SERIAL PRIMARY KEY,
    agent_id VARCHAR(2) UNIQUE NOT NULL,
    nom VARCHAR(255) NOT NULL,
    prenom VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE,
    telephone VARCHAR(20),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table des membres
CREATE TABLE IF NOT EXISTS membres (
    id SERIAL PRIMARY KEY,
    membre_id VARCHAR(4) UNIQUE NOT NULL,
    agent_id VARCHAR(2) NOT NULL REFERENCES agents(agent_id) ON DELETE CASCADE,
    nom VARCHAR(255) NOT NULL,
    prenom VARCHAR(255) NOT NULL,
    telephone VARCHAR(20),
    adresse TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table des prêts
CREATE TABLE IF NOT EXISTS prets (
    id SERIAL PRIMARY KEY,
    pret_id VARCHAR(50) UNIQUE NOT NULL, -- Format: CL-000-Janv
    membre_id VARCHAR(4) NOT NULL REFERENCES membres(membre_id) ON DELETE CASCADE,
    agent_id VARCHAR(2) NOT NULL REFERENCES agents(agent_id) ON DELETE CASCADE,
    montant_pret DECIMAL(10, 2) NOT NULL, -- Montant total du prêt (ex: 5000 HTG)
    montant_remboursement DECIMAL(10, 2) NOT NULL, -- Montant de chaque remboursement (ex: 250 HTG)
    nombre_remboursements INTEGER NOT NULL DEFAULT 23,
    date_decaissement DATE NOT NULL,
    date_premier_remboursement DATE NOT NULL, -- 2ème jour après décaissement
    statut VARCHAR(20) DEFAULT 'actif', -- actif, termine, annule
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table des remboursements
CREATE TABLE IF NOT EXISTS remboursements (
    id SERIAL PRIMARY KEY,
    pret_id VARCHAR(50) NOT NULL REFERENCES prets(pret_id) ON DELETE CASCADE,
    membre_id VARCHAR(4) NOT NULL REFERENCES membres(membre_id) ON DELETE CASCADE,
    agent_id VARCHAR(2) NOT NULL REFERENCES agents(agent_id) ON DELETE CASCADE,
    numero_remboursement INTEGER NOT NULL, -- 1 à 23
    montant DECIMAL(10, 2) NOT NULL,
    date_remboursement DATE NOT NULL,
    date_paiement DATE, -- Date réelle du paiement (peut être différente de date_remboursement)
    statut VARCHAR(20) DEFAULT 'en_attente', -- en_attente, paye, en_retard
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(pret_id, numero_remboursement)
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_membres_agent_id ON membres(agent_id);
CREATE INDEX IF NOT EXISTS idx_prets_membre_id ON prets(membre_id);
CREATE INDEX IF NOT EXISTS idx_prets_agent_id ON prets(agent_id);
CREATE INDEX IF NOT EXISTS idx_remboursements_pret_id ON remboursements(pret_id);
CREATE INDEX IF NOT EXISTS idx_remboursements_membre_id ON remboursements(membre_id);
CREATE INDEX IF NOT EXISTS idx_remboursements_statut ON remboursements(statut);

-- Fonction pour générer automatiquement l'agent_id
CREATE OR REPLACE FUNCTION generate_agent_id()
RETURNS VARCHAR(2) AS $$
DECLARE
    new_id VARCHAR(2);
    max_num INTEGER;
BEGIN
    SELECT COALESCE(MAX(CAST(agent_id AS INTEGER)), 0) INTO max_num FROM agents;
    new_id := LPAD((max_num + 1)::TEXT, 2, '0');
    RETURN new_id;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour générer automatiquement le membre_id
CREATE OR REPLACE FUNCTION generate_membre_id()
RETURNS VARCHAR(4) AS $$
DECLARE
    new_id VARCHAR(4);
    max_num INTEGER;
BEGIN
    SELECT COALESCE(MAX(CAST(membre_id AS INTEGER)), 0) INTO max_num FROM membres;
    new_id := LPAD((max_num + 1)::TEXT, 4, '0');
    RETURN new_id;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour générer automatiquement le pret_id
CREATE OR REPLACE FUNCTION generate_pret_id()
RETURNS VARCHAR(50) AS $$
DECLARE
    new_id VARCHAR(50);
    month_name VARCHAR(10);
    max_num INTEGER;
BEGIN
    -- Obtenir le nom du mois en français
    month_name := CASE EXTRACT(MONTH FROM NOW())
        WHEN 1 THEN 'Janv'
        WHEN 2 THEN 'Fevr'
        WHEN 3 THEN 'Mars'
        WHEN 4 THEN 'Avril'
        WHEN 5 THEN 'Mai'
        WHEN 6 THEN 'Juin'
        WHEN 7 THEN 'Juillet'
        WHEN 8 THEN 'Aout'
        WHEN 9 THEN 'Sept'
        WHEN 10 THEN 'Oct'
        WHEN 11 THEN 'Nov'
        WHEN 12 THEN 'Dec'
    END;
    
    -- Trouver le numéro maximum pour ce mois
    SELECT COALESCE(MAX(CAST(SUBSTRING(pret_id FROM 4 FOR 3) AS INTEGER)), 0) 
    INTO max_num 
    FROM prets 
    WHERE pret_id LIKE 'CL-%' || '-' || month_name;
    
    new_id := 'CL-' || LPAD((max_num + 1)::TEXT, 3, '0') || '-' || month_name;
    RETURN new_id;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour mettre à jour updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_agents_updated_at BEFORE UPDATE ON agents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_membres_updated_at BEFORE UPDATE ON membres
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_prets_updated_at BEFORE UPDATE ON prets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_remboursements_updated_at BEFORE UPDATE ON remboursements
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


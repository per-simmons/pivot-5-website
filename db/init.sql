-- AI Editor 2.0 Database Schema
-- System Prompts with Versioning

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- SYSTEM PROMPTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS system_prompts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    prompt_key VARCHAR(100) UNIQUE NOT NULL,
    step_id INTEGER NOT NULL CHECK (step_id >= 1 AND step_id <= 5),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    model VARCHAR(100) NOT NULL,
    temperature DECIMAL(3,2) DEFAULT 0.7,
    slot_number INTEGER CHECK (slot_number >= 1 AND slot_number <= 5),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_prompts_step ON system_prompts(step_id);
CREATE INDEX IF NOT EXISTS idx_prompts_key ON system_prompts(prompt_key);

-- ============================================================================
-- SYSTEM PROMPT VERSIONS TABLE (for version history)
-- ============================================================================
CREATE TABLE IF NOT EXISTS system_prompt_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    prompt_id UUID NOT NULL REFERENCES system_prompts(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    content TEXT NOT NULL,
    change_summary TEXT,
    created_by UUID,
    created_by_email VARCHAR(255),
    is_current BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(prompt_id, version)
);

-- Index for fast version lookups
CREATE INDEX IF NOT EXISTS idx_versions_prompt ON system_prompt_versions(prompt_id);
CREATE INDEX IF NOT EXISTS idx_versions_current ON system_prompt_versions(prompt_id, is_current) WHERE is_current = true;

-- ============================================================================
-- STORED PROCEDURES
-- ============================================================================

-- Function to update prompt content (creates new version)
CREATE OR REPLACE FUNCTION update_prompt_content(
    p_prompt_key VARCHAR,
    p_content TEXT,
    p_user_id UUID DEFAULT NULL,
    p_user_email VARCHAR DEFAULT NULL,
    p_change_summary TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_prompt_id UUID;
    v_current_version INTEGER;
    v_new_version_id UUID;
BEGIN
    -- Get prompt ID
    SELECT id INTO v_prompt_id FROM system_prompts WHERE prompt_key = p_prompt_key;
    IF v_prompt_id IS NULL THEN
        RAISE EXCEPTION 'Prompt not found: %', p_prompt_key;
    END IF;

    -- Get current version number
    SELECT COALESCE(MAX(version), 0) INTO v_current_version
    FROM system_prompt_versions WHERE prompt_id = v_prompt_id;

    -- Mark old versions as not current
    UPDATE system_prompt_versions
    SET is_current = false
    WHERE prompt_id = v_prompt_id AND is_current = true;

    -- Insert new version
    INSERT INTO system_prompt_versions (
        prompt_id, version, content, change_summary,
        created_by, created_by_email, is_current
    ) VALUES (
        v_prompt_id, v_current_version + 1, p_content, p_change_summary,
        p_user_id, p_user_email, true
    ) RETURNING id INTO v_new_version_id;

    -- Update prompt updated_at
    UPDATE system_prompts SET updated_at = NOW() WHERE id = v_prompt_id;

    RETURN v_new_version_id;
END;
$$ LANGUAGE plpgsql;

-- Function to rollback to a previous version
CREATE OR REPLACE FUNCTION rollback_prompt(
    p_prompt_key VARCHAR,
    p_version INTEGER,
    p_user_id UUID DEFAULT NULL,
    p_user_email VARCHAR DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_prompt_id UUID;
    v_old_content TEXT;
    v_new_version_id UUID;
BEGIN
    -- Get prompt ID
    SELECT id INTO v_prompt_id FROM system_prompts WHERE prompt_key = p_prompt_key;
    IF v_prompt_id IS NULL THEN
        RAISE EXCEPTION 'Prompt not found: %', p_prompt_key;
    END IF;

    -- Get content from the version to rollback to
    SELECT content INTO v_old_content
    FROM system_prompt_versions
    WHERE prompt_id = v_prompt_id AND version = p_version;

    IF v_old_content IS NULL THEN
        RAISE EXCEPTION 'Version % not found for prompt %', p_version, p_prompt_key;
    END IF;

    -- Create new version with old content
    SELECT update_prompt_content(
        p_prompt_key, v_old_content, p_user_id, p_user_email,
        'Rollback to version ' || p_version
    ) INTO v_new_version_id;

    RETURN v_new_version_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- AUDIT LOG TABLE (optional but useful)
-- ============================================================================
CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id VARCHAR(255),
    details JSONB,
    user_email VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_time ON audit_log(created_at);

-- ============================================================================
-- JOBS TABLE (for tracking worker jobs)
-- ============================================================================
CREATE TABLE IF NOT EXISTS jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_type VARCHAR(100) NOT NULL,
    step_id INTEGER NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    payload JSONB,
    result JSONB,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_step ON jobs(step_id);

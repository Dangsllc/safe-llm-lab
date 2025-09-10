-- Add Row-Level Security to Safe LLM Lab Database
-- This migration adds comprehensive RLS policies to protect user data

-- Enable RLS on all sensitive tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE studies ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_collaborators ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompt_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_encryption ENABLE ROW LEVEL SECURITY;

-- Create function to get current user ID from application context
CREATE OR REPLACE FUNCTION current_app_user_id() RETURNS UUID AS $$
BEGIN
  RETURN COALESCE(current_setting('app.current_user_id', true)::UUID, '00000000-0000-0000-0000-000000000000'::UUID);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to check if user is admin
CREATE OR REPLACE FUNCTION current_user_is_admin() RETURNS BOOLEAN AS $$
BEGIN
  RETURN COALESCE(current_setting('app.current_user_role', true) = 'ADMIN', false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Users table policies
CREATE POLICY users_own_data ON users
  USING (id = current_app_user_id() OR current_user_is_admin());

CREATE POLICY users_insert_admin ON users
  FOR INSERT WITH CHECK (current_user_is_admin());

CREATE POLICY users_update_own ON users
  FOR UPDATE USING (id = current_app_user_id() OR current_user_is_admin());

-- Studies table policies  
CREATE POLICY studies_owner_access ON studies
  USING (
    "ownerId" = current_app_user_id() 
    OR current_user_is_admin()
    OR id IN (
      SELECT "studyId" FROM study_collaborators 
      WHERE "userId" = current_app_user_id()
    )
  );

CREATE POLICY studies_owner_create ON studies
  FOR INSERT WITH CHECK ("ownerId" = current_app_user_id() OR current_user_is_admin());

CREATE POLICY studies_owner_update ON studies
  FOR UPDATE USING (
    "ownerId" = current_app_user_id() 
    OR current_user_is_admin()
    OR (
      id IN (
        SELECT "studyId" FROM study_collaborators 
        WHERE "userId" = current_app_user_id() 
        AND role IN ('OWNER', 'EDITOR')
      )
    )
  );

-- Study collaborators policies
CREATE POLICY collaborators_study_access ON study_collaborators
  USING (
    "userId" = current_app_user_id()
    OR current_user_is_admin()
    OR "studyId" IN (
      SELECT id FROM studies WHERE "ownerId" = current_app_user_id()
    )
  );

-- Test sessions policies
CREATE POLICY sessions_study_access ON test_sessions
  USING (
    "userId" = current_app_user_id()
    OR current_user_is_admin()  
    OR "studyId" IN (
      SELECT "studyId" FROM study_collaborators 
      WHERE "userId" = current_app_user_id()
    )
    OR "studyId" IN (
      SELECT id FROM studies WHERE "ownerId" = current_app_user_id()
    )
  );

CREATE POLICY sessions_create_policy ON test_sessions
  FOR INSERT WITH CHECK (
    "userId" = current_app_user_id()
    AND (
      "studyId" IN (
        SELECT "studyId" FROM study_collaborators 
        WHERE "userId" = current_app_user_id() 
        AND role IN ('OWNER', 'EDITOR', 'CONTRIBUTOR')
      )
      OR "studyId" IN (
        SELECT id FROM studies WHERE "ownerId" = current_app_user_id()
      )
    )
  );

-- Prompt templates policies
CREATE POLICY templates_study_access ON prompt_templates
  USING (
    "createdBy" = current_app_user_id()
    OR current_user_is_admin()
    OR "studyId" IN (
      SELECT "studyId" FROM study_collaborators 
      WHERE "userId" = current_app_user_id()
    )
    OR "studyId" IN (
      SELECT id FROM studies WHERE "ownerId" = current_app_user_id()  
    )
    OR "isShared" = true
  );

-- Security audit log policies (admins and own events only)
CREATE POLICY audit_log_access ON security_audit_log
  USING (
    current_user_is_admin() 
    OR "userId" = current_app_user_id()
  );

CREATE POLICY audit_log_insert ON security_audit_log
  FOR INSERT WITH CHECK (true); -- System can always insert audit events

-- Sessions table policies (own sessions only)
CREATE POLICY sessions_own_only ON sessions
  USING ("userId" = current_app_user_id() OR current_user_is_admin());

-- User invites policies
CREATE POLICY invites_access ON user_invites
  USING (
    "invitedBy" = current_app_user_id()
    OR current_user_is_admin()
    OR email = current_setting('app.current_user_email', true)
  );

-- Data encryption policies (own keys only)
CREATE POLICY encryption_own_keys ON data_encryption
  USING ("userId" = current_app_user_id() OR current_user_is_admin());

-- Grant necessary permissions to application user
-- Note: Replace 'app_user' with your actual application database user
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;
-- GRANT EXECUTE ON FUNCTION current_app_user_id() TO app_user;
-- GRANT EXECUTE ON FUNCTION current_user_is_admin() TO app_user;
-- One email, one account, regardless of case or tenant.
--
-- Login finds a user by email alone, so two users sharing an address (in two
-- tenants, or as Asha@x vs asha@x) cannot sign in. These indexes make that
-- impossible to create, and back the lower(email) lookups.
--
-- Fails if existing rows already collide; resolve those before applying:
--   SELECT lower(email), count(*) FROM users GROUP BY 1 HAVING count(*) > 1;
--   SELECT lower(email), count(*) FROM tenants GROUP BY 1 HAVING count(*) > 1;

UPDATE users SET email = lower(email) WHERE email <> lower(email);
UPDATE tenants SET email = lower(email) WHERE email <> lower(email);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_lower_unique ON users (lower(email));
CREATE UNIQUE INDEX IF NOT EXISTS idx_tenants_email_lower_unique ON tenants (lower(email));

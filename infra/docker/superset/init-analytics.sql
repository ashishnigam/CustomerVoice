DO
$$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'analytics') THEN
    CREATE ROLE analytics LOGIN PASSWORD 'analytics';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'superset') THEN
    CREATE ROLE superset LOGIN PASSWORD 'superset';
  END IF;
END
$$;

SELECT 'CREATE DATABASE customervoice_observability OWNER analytics'
WHERE NOT EXISTS (
  SELECT 1 FROM pg_database WHERE datname = 'customervoice_observability'
)
\gexec

SELECT 'CREATE DATABASE superset_meta OWNER superset'
WHERE NOT EXISTS (
  SELECT 1 FROM pg_database WHERE datname = 'superset_meta'
)
\gexec

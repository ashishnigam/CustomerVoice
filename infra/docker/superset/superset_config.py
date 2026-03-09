import os

SQLALCHEMY_DATABASE_URI = os.environ.get(
    "SUPERSET_DATABASE_URL",
    "postgresql+psycopg2://superset:superset@analytics-postgres:5432/superset_meta",
)
SECRET_KEY = os.environ.get("SUPERSET_SECRET_KEY", "change-me")
SUPERSET_WEBSERVER_PORT = int(os.environ.get("SUPERSET_PORT", "8088"))
TALISMAN_ENABLED = False
WTF_CSRF_ENABLED = True
ROW_LIMIT = 5000

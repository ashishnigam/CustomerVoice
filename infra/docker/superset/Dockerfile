FROM apache/superset:6.0.0

USER root

RUN python -m ensurepip --upgrade \
  && python -m pip install --no-cache-dir psycopg2-binary

USER superset

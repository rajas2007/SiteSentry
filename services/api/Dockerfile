FROM python:3.11-slim

WORKDIR /app
COPY pyproject.toml ./
RUN pip install hatchling && pip install .

COPY src/ src/
EXPOSE 8000
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]

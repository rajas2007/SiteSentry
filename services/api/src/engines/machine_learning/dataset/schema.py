"""
ML Dataset Schema

Defines the contract for a training record in the Site Sentry / TrustLens AI Platform.
This schema guarantees reproducible, auditable, and strictly validated training data.

TARGET LABEL POLICY:
- 0 = benign (safe)
- 1 = malicious (phishing/malware/scam)
- The label MUST NOT be derived from the ScoreFusionEngine, final security score,
  severity, or DecisionEngine action. Using existing heuristic outputs to train
  the ML model causes circular target leakage (teaching the ML merely to
  mimic the heuristics).
- Using Threat Intelligence (VirusTotal/GSB) as the label source is only permitted
  if those precise sources are appropriately masked or removed from the feature vector
  during training to prevent the model from learning a trivial mapping (e.g. vt_detected -> malicious).
"""

from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator

from src.engines.machine_learning.schemas import FEATURE_ORDER, FEATURE_SCHEMA_VERSION


class ProvenanceMetadata(BaseModel):
    """
    Metadata preserving the origin of the sample.
    Never fabricate this data. If unknown, it must be explicitly handled.
    """

    dataset_name: str = Field(
        description="Name of the source dataset (e.g., 'PhishTank_2023', 'Manual_Review')"
    )
    dataset_version: str | None = Field(
        default=None, description="Version or date string of the source dataset"
    )
    ingestion_timestamp: str = Field(
        description="ISO 8601 timestamp of when this record was ingested"
    )
    original_id: str | None = Field(
        default=None, description="The ID of the sample in the original dataset"
    )


class TrainingRecord(BaseModel):
    """
    A single typed, validated training example.
    """

    sample_id: str = Field(description="Unique identifier for this training record")
    domain: str = Field(
        description="Normalized hostname/domain. Crucial for GroupKFold train/test splitting to prevent leakage."
    )

    # Labeling
    label: Literal[0, 1] = Field(
        description="Target variable. 0 = benign, 1 = malicious."
    )
    label_source: str = Field(
        description="Where this label came from (e.g., 'Manual', 'PhishTank_Verified'). Must NOT be 'ScoreFusion'."
    )

    # Provenance
    provenance: ProvenanceMetadata = Field(description="Traceability metadata")

    # Features
    feature_schema_version: str = Field(
        description=f"Must match the expected version, currently '{FEATURE_SCHEMA_VERSION}'"
    )
    features: list[float] = Field(
        description="The positional numeric feature vector. Must exactly match the canonical FEATURE_ORDER length."
    )

    # Explicitly prohibit leakage fields from being ingested
    score: Any = Field(default=None, exclude=True)
    severity: Any = Field(default=None, exclude=True)
    action: Any = Field(default=None, exclude=True)

    @field_validator("feature_schema_version")
    @classmethod
    def validate_schema_version(cls, v: str) -> str:
        if v != FEATURE_SCHEMA_VERSION:
            raise ValueError(
                f"Unsupported feature_schema_version: {v}. Expected: {FEATURE_SCHEMA_VERSION}"
            )
        return v

    @field_validator("features")
    @classmethod
    def validate_features_length_and_values(cls, v: list[float]) -> list[float]:
        import math

        expected_length = len(FEATURE_ORDER)
        if len(v) != expected_length:
            raise ValueError(
                f"Feature vector length mismatch. Expected {expected_length}, got {len(v)}."
            )
        for val in v:
            if math.isnan(val) or math.isinf(val):
                raise ValueError("Feature vector contains NaN or Infinite values.")
        return v

    @field_validator("label_source")
    @classmethod
    def validate_label_source_not_leaked(cls, v: str) -> str:
        disallowed_sources = {
            "scorefusion",
            "securityengine",
            "decisionengine",
            "heuristic",
        }
        if v.lower().replace(" ", "") in disallowed_sources:
            raise ValueError(f"Target leakage detected: label_source cannot be {v}")
        return v

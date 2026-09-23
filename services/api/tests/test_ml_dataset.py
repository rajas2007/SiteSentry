"""
Tests for the ML Dataset pipeline and Labeling foundation.
"""

import pytest
from pydantic import ValidationError

from src.engines.machine_learning.dataset.schema import (
    ProvenanceMetadata,
    TrainingRecord,
)
from src.engines.machine_learning.dataset.splitter import (
    DatasetSplitter,
    DatasetValidator,
)
from src.engines.machine_learning.schemas import FEATURE_ORDER, FEATURE_SCHEMA_VERSION


def _valid_provenance():
    return ProvenanceMetadata(
        dataset_name="TestDataset", ingestion_timestamp="2026-09-23T00:00:00Z"
    )


def _valid_features():
    return [0.0] * len(FEATURE_ORDER)


def test_valid_training_record():
    """1. Valid training record is accepted."""
    record = TrainingRecord(
        sample_id="123",
        domain="example.com",
        label=0,
        label_source="Manual_Review",
        provenance=_valid_provenance(),
        feature_schema_version=FEATURE_SCHEMA_VERSION,
        features=_valid_features(),
    )
    assert record.domain == "example.com"
    assert record.label == 0


def test_invalid_feature_count():
    """2. Invalid feature count is rejected."""
    bad_features = [0.0] * (len(FEATURE_ORDER) - 1)
    with pytest.raises(ValidationError, match="Feature vector length mismatch"):
        TrainingRecord(
            sample_id="123",
            domain="example.com",
            label=0,
            label_source="Manual_Review",
            provenance=_valid_provenance(),
            feature_schema_version=FEATURE_SCHEMA_VERSION,
            features=bad_features,
        )


def test_wrong_feature_schema_version():
    """3. Wrong feature schema version is rejected."""
    with pytest.raises(ValidationError, match="Unsupported feature_schema_version"):
        TrainingRecord(
            sample_id="123",
            domain="example.com",
            label=0,
            label_source="Manual_Review",
            provenance=_valid_provenance(),
            feature_schema_version="v2_invalid",
            features=_valid_features(),
        )


def test_invalid_feature_type():
    """4. Invalid feature type is rejected."""
    bad_features = _valid_features()
    bad_features[0] = "not_a_float"  # type: ignore
    with pytest.raises(ValidationError):
        TrainingRecord(
            sample_id="123",
            domain="example.com",
            label=0,
            label_source="Manual_Review",
            provenance=_valid_provenance(),
            feature_schema_version=FEATURE_SCHEMA_VERSION,
            features=bad_features,
        )


def test_nan_infinite_feature_rejected():
    """5. NaN/infinite numeric feature is rejected."""
    import math

    bad_features = _valid_features()
    bad_features[0] = math.nan
    with pytest.raises(ValidationError):
        TrainingRecord(
            sample_id="123",
            domain="example.com",
            label=0,
            label_source="Manual_Review",
            provenance=_valid_provenance(),
            feature_schema_version=FEATURE_SCHEMA_VERSION,
            features=bad_features,
        )


def test_invalid_label():
    """6. Invalid label is rejected."""
    with pytest.raises(ValidationError):
        TrainingRecord(
            sample_id="123",
            domain="example.com",
            label=2,  # type: ignore
            label_source="Manual_Review",
            provenance=_valid_provenance(),
            feature_schema_version=FEATURE_SCHEMA_VERSION,
            features=_valid_features(),
        )


def test_prohibited_target_leakage_fields():
    """7. Prohibited target-leaking field is rejected if represented in the ingestion schema."""
    # label_source cannot be ScoreFusion
    with pytest.raises(ValidationError, match="Target leakage detected"):
        TrainingRecord(
            sample_id="123",
            domain="example.com",
            label=1,
            label_source="ScoreFusion",
            provenance=_valid_provenance(),
            feature_schema_version=FEATURE_SCHEMA_VERSION,
            features=_valid_features(),
        )

    # attempting to pass score or severity should be ignored or raise depending on pydantic config
    # Since we set exclude=True, they shouldn't serialize. We test they aren't part of the model dump.
    record = TrainingRecord(
        sample_id="123",
        domain="example.com",
        label=0,
        label_source="Manual_Review",
        provenance=_valid_provenance(),
        feature_schema_version=FEATURE_SCHEMA_VERSION,
        features=_valid_features(),
        score=100,  # type: ignore
        severity="low",  # type: ignore
    )
    dump = record.model_dump()
    assert "score" not in dump
    assert "severity" not in dump


def test_duplicate_sample_detection_and_conflicts():
    """9. Duplicate sample detection works. 10. Conflicting labels are surfaced."""
    # Duplicate features, same domain
    r1 = TrainingRecord(
        sample_id="1",
        domain="example.com",
        label=0,
        label_source="SourceA",
        provenance=_valid_provenance(),
        feature_schema_version=FEATURE_SCHEMA_VERSION,
        features=_valid_features(),
    )
    # Different label, same domain -> conflict
    r2 = TrainingRecord(
        sample_id="2",
        domain="example.com",
        label=1,
        label_source="SourceB",
        provenance=_valid_provenance(),
        feature_schema_version=FEATURE_SCHEMA_VERSION,
        features=_valid_features(),
    )

    analysis = DatasetValidator.analyze_dataset([r1, r2])
    assert analysis["exact_duplicates_found"] == 1
    assert "example.com" in analysis["conflicts"]


def test_dataset_splitting_deterministic_and_grouped():
    """11. Dataset splitting is deterministic. 12. Grouped domains are not accidentally split."""
    records = []
    # Create 20 records across 5 domains
    for i in range(20):
        domain_idx = i % 5
        records.append(
            TrainingRecord(
                sample_id=str(i),
                domain=f"domain{domain_idx}.com",
                label=0,
                label_source="Manual",
                provenance=_valid_provenance(),
                feature_schema_version=FEATURE_SCHEMA_VERSION,
                features=_valid_features(),
            )
        )

    train, val, test = DatasetSplitter.split_by_domain(
        records, test_size=0.2, val_size=0.1, seed=123
    )

    # 1. Deterministic
    train2, _val2, test2 = DatasetSplitter.split_by_domain(
        records, test_size=0.2, val_size=0.1, seed=123
    )
    assert len(train) == len(train2)
    assert len(test) == len(test2)

    # 2. Grouped Domains Check
    train_domains = {r.domain for r in train}
    val_domains = {r.domain for r in val}
    test_domains = {r.domain for r in test}

    assert train_domains.isdisjoint(test_domains)
    assert train_domains.isdisjoint(val_domains)
    assert val_domains.isdisjoint(test_domains)


def test_dataset_statistics():
    """13. Dataset statistics are computed correctly."""
    r1 = TrainingRecord(
        sample_id="1",
        domain="a.com",
        label=0,
        label_source="A",
        provenance=_valid_provenance(),
        feature_schema_version=FEATURE_SCHEMA_VERSION,
        features=_valid_features(),
    )
    r2 = TrainingRecord(
        sample_id="2",
        domain="b.com",
        label=1,
        label_source="B",
        provenance=_valid_provenance(),
        feature_schema_version=FEATURE_SCHEMA_VERSION,
        features=_valid_features(),
    )

    analysis = DatasetValidator.analyze_dataset(
        [r1, r2, r2]
    )  # Intentionally pass r2 twice
    stats = analysis["statistics"]
    assert stats["total_samples"] == 3
    assert stats["benign_count"] == 1
    assert stats["malicious_count"] == 2
    assert stats["unique_domains"] == 2

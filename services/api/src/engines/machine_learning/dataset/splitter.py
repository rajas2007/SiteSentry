"""
Dataset Splitting and Validation

Provides robust methods to validate collections of training records,
detect duplicates, flag label conflicts, and securely split data into
train/validation/test sets without domain leakage.
"""

import hashlib
import json
from collections import defaultdict
from typing import Any, TypedDict

from src.engines.machine_learning.dataset.schema import TrainingRecord


class DatasetStatistics(TypedDict):
    total_samples: int
    benign_count: int
    malicious_count: int
    benign_percentage: float
    malicious_percentage: float
    unique_domains: int


class DatasetValidator:
    """
    Validates a batch of training records, ensuring no contradictory labels
    and providing dataset statistics.
    """

    @staticmethod
    def analyze_dataset(records: list[TrainingRecord]) -> dict[str, Any]:
        """
        Analyzes a dataset for duplicates, label conflicts, and class balance.
        """
        domain_labels: dict[str, set[int]] = defaultdict(set)
        sample_hashes: set[str] = set()

        duplicates_count = 0
        conflicts = []

        benign_cnt = 0
        malicious_cnt = 0

        for r in records:
            # Check domain conflicts
            domain_labels[r.domain].add(r.label)

            # Check exact duplicate features
            # We hash the feature vector to find exact duplicate observations
            feat_hash = hashlib.sha256(
                json.dumps(r.features).encode("utf-8")
            ).hexdigest()
            if feat_hash in sample_hashes:
                duplicates_count += 1
            sample_hashes.add(feat_hash)

            if r.label == 0:
                benign_cnt += 1
            else:
                malicious_cnt += 1

        # Identify conflicts (same domain, different labels)
        for domain, labels in domain_labels.items():
            if len(labels) > 1:
                conflicts.append(domain)

        total = len(records)
        stats: DatasetStatistics = {
            "total_samples": total,
            "benign_count": benign_cnt,
            "malicious_count": malicious_cnt,
            "benign_percentage": round(
                (benign_cnt / total * 100) if total > 0 else 0, 2
            ),
            "malicious_percentage": round(
                (malicious_cnt / total * 100) if total > 0 else 0, 2
            ),
            "unique_domains": len(domain_labels),
        }

        return {
            "statistics": stats,
            "conflicts": conflicts,
            "exact_duplicates_found": duplicates_count,
        }


class DatasetSplitter:
    """
    Splits dataset into train/val/test partitions.
    Uses domain-based grouping (GroupKFold concept) so that variations
    of the same domain do not bleed across train and test sets, which
    would artificially inflate model performance via memorization.
    """

    @staticmethod
    def split_by_domain(
        records: list[TrainingRecord],
        test_size: float = 0.2,
        val_size: float = 0.1,
        seed: int = 42,
    ) -> tuple[list[TrainingRecord], list[TrainingRecord], list[TrainingRecord]]:
        """
        Deterministic split ensuring domains are isolated.
        Note: The actual split relies on hashing the domain with a seed
        to deterministically assign domains to buckets.

        Returns: (train_records, val_records, test_records)
        """
        train = []
        val = []
        test = []

        # We want to deterministically assign a domain to a split.
        # We hash the domain + seed, convert to a float 0.0-1.0
        for r in records:
            h = int(hashlib.sha256(f"{r.domain}_{seed}".encode()).hexdigest()[:8], 16)
            fraction = h / 0xFFFFFFFF

            if fraction < test_size:
                test.append(r)
            elif fraction < (test_size + val_size):
                val.append(r)
            else:
                train.append(r)

        return train, val, test

# ML Dataset and Labeling Pipeline Foundation

This module defines the strictly validated contract for the Site Sentry / TrustLens AI Platform's ML training records.

## 1. Training Record Structure
A training record (`TrainingRecord` in `schema.py`) encapsulates an individual sample for model training. It includes:
- `sample_id`: Unique identifier
- `domain`: Normalized domain/hostname (crucial for train/test splitting)
- `label`: The target variable (0 = benign, 1 = malicious)
- `label_source`: Provenance of the label (e.g. "Manual", "PhishTank")
- `provenance`: Origin metadata of the sample (`ProvenanceMetadata`)
- `feature_schema_version`: Must strictly match the canonical version (currently `"v1"`)
- `features`: The ordered numeric feature vector extracted by `MLFeatureExtractor`

## 2. Label Definition
- **0 = Benign:** The domain/page is safe.
- **1 = Malicious:** The domain/page is unsafe (phishing, malware, scam, etc.).

## 3. Label Source Requirements & Leakage Rules
- The label **MUST NOT** be derived from the `ScoreFusionEngine`, the final security score, the Decision Engine, or existing heuristics. Using heuristic outputs as training targets causes circular leakage (teaching the ML merely to mimic the heuristics).
- If Threat Intelligence (VirusTotal/GSB) is used as the label source, those precise sources must be handled properly (e.g., masking those features from the input vector during training) so the model learns from the DOM/structural features rather than just learning a 1:1 mapping of `vt_detected -> malicious`.
- Labels must come from trusted, documented external sources (e.g., OpenPhish, PhishTank, manual verification).

## 4. Feature Schema Version & Canonical Ordering
- The feature vector relies on the `FEATURE_ORDER` list defined in `schemas.py`.
- The current version is **`v1`** and consists of 27 features.
- Any change to the ordering, count, or extraction logic requires bumping the schema version. The dataset validation will instantly reject mismatched schema versions or vector lengths.

## 5. Dataset Splitting Policy
Dataset splitting uses the `DatasetSplitter`, which implements a **GroupKFold** concept. 
Splitting is deterministic and grouped by `domain`. This prevents data leakage where URL variations of the exact same domain bleed into both the training and testing sets, artificially inflating model evaluation metrics through memorization rather than generalization.

## 6. Duplicate and Conflict Handling
The `DatasetValidator` analyzes batches of records and flags:
- **Exact Duplicates:** Records containing the exact same feature vector (detected via MD5 hashing the vector).
- **Label Conflicts:** Samples belonging to the same domain but assigned contradictory labels. 
These are not silently discarded but returned in the analysis report for human review.

## 7. Provenance Requirements
Provenance metadata is mandatory (`dataset_name`, `ingestion_timestamp`, `original_id`). It must trace back to the original source. Datasets with incompatible or fabricated provenance are rejected.

## 8. Current Data Limitations & Blocked Tasks
- **Current Limitation:** The repository lacks a trusted, labeled dataset. 
- **Blocked Tasks:** No models (XGBoost, LightGBM, etc.) can be trained. Do not invent fake data. Do not build inference endpoints or Score Fusion ML integration yet.
- **Next Steps:** An ingestion script must be written to import a real external dataset (e.g., PhishTank, Tranco) and map it into this schema before model training can begin.

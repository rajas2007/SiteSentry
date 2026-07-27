# 09b Feature Extraction Engine

## 1. Overview
The Feature Extraction Engine serves as the critical translation layer between raw, unstructured web data (HTML, network requests, raw URLs) and the highly structured format required by the downstream Rule Engine and Machine Learning Engine.

By isolating this logic into a dedicated engine, the TrustLens AI Platform ensures that analyzers do not calculate scores directly, but instead extract normalized features that can be weighted dynamically later in the pipeline.

## 2. Responsibilities
- Receives raw payloads from the Data Collection Engine (e.g., Browser Extension).
- Parses, sanitizes, and normalizes the data.
- Generates categorized Feature Vectors (numeric, boolean, categorical arrays).
- Passes these vectors to the Sub-Engines and ML Engine.

## 3. Extracted Feature Categories

### 3.1. URL Features
- `url_length`: Integer (e.g., `85`)
- `url_entropy`: Float (e.g., `4.82` - high entropy indicates domain generation algorithms)
- `has_ip_address`: Boolean
- `tld_reputation_tier`: Categorical (`1`, `2`, `3`)
- `subdomain_count`: Integer

### 3.2. SSL Features
- `has_https`: Boolean
- `ssl_issuer_reputation`: Categorical (`High`, `Medium`, `Low`, `Untrusted`)
- `days_until_expiry`: Integer
- `is_ev_cert`: Boolean (Extended Validation)

### 3.3. DOM & Visual Features
- `password_field_count`: Integer
- `hidden_iframe_count`: Integer
- `suspicious_script_count`: Integer (e.g., highly obfuscated JS)
- `marketing_popup_count`: Integer
- `prechecked_consent_boxes`: Boolean

### 3.4. Cookie & Tracker Features
- `third_party_cookie_count`: Integer
- `known_tracker_count`: Integer
- `supercookie_detected`: Boolean

### 3.5. Threat & Domain Features (Injected from Threat Intel Engine)
- `domain_age_days`: Integer
- `virus_total_positives`: Integer
- `is_phish_tank`: Boolean

## 4. Pipeline Integration
The Feature Extraction Engine does **not** make decisions.
If `virus_total_positives = 5`, it does not set the Trust Score to 0. It simply outputs the integer `5` in the feature vector. It is the job of the **Score Fusion Engine** and **Rule Engine** to interpret this feature and apply the appropriate penalty.

## 5. Extensibility
When a new plugin is added (e.g., the Web3 Engine), a corresponding feature extractor module is added here (e.g., `wallet_reputation_score`, `smart_contract_vulnerabilities_count`). This ensures the Machine Learning model can easily be retrained on new features without rewriting core infrastructure.

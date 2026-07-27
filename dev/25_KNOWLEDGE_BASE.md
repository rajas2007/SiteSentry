# 25 Knowledge Base

## 1. Overview
The Knowledge Base is a foundational component of the TrustLens AI Platform. It is a centralized, highly optimized repository of threat signatures, historical metadata, known scams, and educational resources. 

Unlike the Redis cache (which stores ephemeral, real-time scan results), the Knowledge Base stores persistent, structural intelligence.

## 2. Responsibilities
- **Storage of Threat Signatures:** Contains exact DOM structures, JavaScript hashes, and CSS selectors associated with known threats (e.g., a specific obfuscation pattern used in crypto wallet drainers).
- **Rule Engine Configurations:** Stores the deterministic rules used by the **Rule Engine** (allowing rapid hot-swapping of rules without deploying new backend code).
- **Machine Learning Context:** Provides the historical dataset (labels and feature vectors) required to continually retrain the **Machine Learning Engine**.
- **Educational Content:** Stores plain-text definitions of threat categories (e.g., "What is a Homograph Attack?") surfaced to users via the UI.

## 3. Data Structure
The Knowledge Base is typically implemented as a mix of a relational database (PostgreSQL) for structured metadata and a document store (MongoDB or Elasticsearch) for complex, nested threat signatures.

### Example: Threat Signature
```json
{
  "signature_id": "SIG-FAKE-MM-001",
  "category": "Crypto Scam",
  "description": "Fake MetaMask wallet connect prompt.",
  "target_dom_elements": [
    {
      "selector": "div.connect-wallet-modal",
      "contains_text": "Secret Recovery Phrase"
    }
  ],
  "associated_domains": ["metamask-secure-update.com"],
  "severity": "Critical"
}
```

## 4. Integration with Engines
1. **Rule Engine:** On boot, the Rule Engine pulls the active ruleset from the Knowledge Base.
2. **Threat Intelligence Engine:** When evaluating a URL, the Threat Intel Engine queries the Knowledge Base to see if it matches any known, proprietary TrustLens threat signatures before querying external APIs.
3. **Web3 Engine:** Heavily relies on the Knowledge Base for lists of known malicious smart contract addresses.

## 5. Maintenance
- Threat signatures are automatically updated by internal heuristic scrapers.
- Confirmed false negatives reported by the **Community Intelligence Engine** are automatically converted into new signatures by the ML training pipeline.

# 15 Data Flow Pipeline

## 1. Overview
The TrustLens AI Platform relies on a highly structured, sequential processing pipeline to evaluate websites. This document maps the journey of data from the client, through the various engines, to the final decision.

## 2. The Analysis Pipeline

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant Ext as Browser Ext (Data Collection)
    participant FE as Feature Extraction Engine
    
    box rgb(40, 44, 52) Plugin Managers & Sub-Engines
        participant Sec as Security Engine
        participant Priv as Privacy Intel Engine
        participant Threat as Threat Intel Engine
        participant Web3 as Web3 Engine (Opt)
    end
    
    participant Rules as Rule Engine
    participant ML as ML Engine
    participant Fusion as Score Fusion Engine
    participant Trust as Trust Engine
    participant Explain as Explainability Engine
    participant Decision as Decision Engine

    User->>Ext: Navigates to website
    Ext->>FE: Raw DOM, URL, Context Data
    FE->>FE: Normalize into Feature Vectors
    
    FE->>Sec: Security Features (SSL, DOM)
    FE->>Priv: Privacy Features (Cookies, Trackers)
    FE->>Threat: Domain/IP Features
    FE->>Web3: Wallet/Contract Features
    
    par Parallel Sub-Engine Analysis
        Threat->>Threat: Query OSINT Feeds
        Sec->>Sec: Analyze Payload
        Priv->>Priv: Analyze Trackers/Policies
        Web3->>Web3: Check Blockchain Rep
    end
    
    Sec & Priv & Threat & Web3->>Rules: Send structured findings
    Sec & Priv & Threat & Web3->>ML: Send feature vectors
    
    par Inference
        Rules->>Rules: Apply Deterministic Logic
        ML->>ML: Run Probabilistic Models
    end
    
    Rules & ML->>Fusion: Send raw outputs & Confidence
    Fusion->>Fusion: Calculate Sec, Priv, Web3 Scores
    Fusion->>Trust: Pass fused scores
    
    Trust->>Trust: Normalize Overall Trust Score
    Trust->>Explain: Pass scores & triggers
    
    Explain->>Explain: Translate to Human-Readable Text
    Explain->>Decision: Pass full report
    
    Decision->>Decision: Generate Final Recommendation, Severity, UI Color
    Decision-->>Ext: Final JSON Payload
    
    Ext->>User: Display Timeline & Dashboard
```

## 3. User-Facing Analysis Timeline
While the pipeline executes backend logic, the Decision Engine transmits status updates back to the client to render a user-facing timeline, building trust in the platform's thoroughness:

- ✔ Data Collected
- ✔ Features Extracted
- ✔ Threat Databases Queried (Threat Intel Engine)
- ✔ Privacy Policy Analyzed (Privacy Intel Engine)
- ✔ Smart Contracts Audited (Web3 Engine - *if applicable*)
- ✔ AI Analysis Complete (Machine Learning Engine)
- ✔ Recommendation Generated (Decision Engine)

## 4. Pipeline Engine Responsibilities
- **Feature Extraction Engine:** Converts messy raw data into clean, structured arrays (e.g., `has_password_field: 1`, `url_entropy: 4.2`).
- **Score Fusion Engine:** Handles the complex weighting (e.g., ML says 80% safe, Rule Engine found a critical VirusTotal hit -> Fusion overrides ML based on rule weights).
- **Decision Engine:** The final gatekeeper that dictates exactly how the extension or dashboard should alert the user (e.g., "Show a Red overlay banner with Priority 1").

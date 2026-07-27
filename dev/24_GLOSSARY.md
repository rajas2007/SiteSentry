# 24 Glossary

## C
- **Community Intelligence Engine:** The platform component responsible for crowdsourcing threat reports and maintaining user Cyber Hygiene Scores.
- **Confidence Score:** A percentage metric indicating how certain the platform is about its final Trust Score, based on data availability and ML confidence.

## D
- **Decision Engine:** The final engine in the pipeline that interprets scores and generates actionable UI commands and warnings.

## E
- **Explainability Engine:** Translates technical model outputs (like SHAP values) into human-readable text.

## F
- **Feature Extraction Engine:** The layer that translates raw client data into structured mathematical vectors for the downstream engines.

## K
- **Knowledge Base:** The central repository of persistent threat signatures, historical metadata, and ML training data.

## M
- **Machine Learning Engine:** The probabilistic analysis engine that uses models like XGBoost to evaluate unknown threats based on feature vectors.

## P
- **Plugin Manager:** The core architectural component that dynamically loads specific Sub-Engines (like Web3) based on the context of the scan.
- **Privacy Intelligence Engine:** The Sub-Engine focused on evaluating trackers, cookies, and privacy policy texts using NLP.

## R
- **Rule Engine:** The deterministic analysis engine that evaluates features against hardcoded, zero-tolerance policies.

## S
- **Score Fusion Engine:** The component responsible for merging the outputs of the ML and Rule engines into final localized scores (Security, Privacy, Web3).
- **Security Engine:** The Sub-Engine focused on analyzing payload and structural features for immediate threats like phishing or malware.

## T
- **Threat Intelligence Engine:** The Sub-Engine responsible for querying all external OSINT APIs (VirusTotal, WHOIS) and normalizing their data.
- **Trust Engine:** The component that normalizes the output of the Score Fusion Engine against historical entity reputation to calculate the Overall Trust Score.
- **TrustLens AI Platform:** The comprehensive suite of client applications, backend pipelines, and AI engines that provide real-time web intelligence.

## W
- **Web3 Engine:** An optional plugin that activates on crypto-related sites to audit smart contracts and wallet reputations.

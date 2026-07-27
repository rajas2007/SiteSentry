# 16a Decision Engine

## 1. Overview
The Decision Engine is the final stop in the TrustLens AI Platform pipeline. While the **Score Fusion Engine** outputs numbers (e.g., Security: 45) and the **Explainability Engine** outputs strings (e.g., "Missing SSL"), the Decision Engine dictates exactly how the client application should behave.

## 2. Responsibilities
- Interprets the normalized scores and explains them.
- Determines the overall **Severity Level**.
- Generates actionable **Recommendations** and **User Actions**.
- Determines the **UI Color** (e.g., Red/Yellow/Green) for the browser extension popup and badge.
- Triggers active intervention (e.g., injecting a blocking overlay banner into the DOM).

## 3. Decision Matrix

The engine uses a threshold matrix to map scores to UI states:

| Trust Score | Severity | UI Color | Alert Priority | Example User Action |
|-------------|----------|----------|----------------|---------------------|
| 80 - 100    | Low      | Emerald  | Background     | "Safe to browse."   |
| 50 - 79     | Medium   | Amber    | Passive Popup  | "Review privacy settings." |
| 0 - 49      | High     | Rose     | Active Overlay | "Leave site immediately." |

## 4. Generating Warnings & Recommendations
The Decision Engine maps the Threat Categories (e.g., *Fake Login*) identified by the pipeline to specific, actionable advice.

- **Threat Category:** *Credential Theft*
  - **Warning:** "This site is attempting to steal your password."
  - **Recommendation:** "Do not enter any personal information here."
  - **Action:** Disable password fields via DOM injection (if user settings permit).

- **Threat Category:** *Privacy Abuse*
  - **Warning:** "This site sells your data to third parties."
  - **Recommendation:** "Use a disposable alias email address if you must sign up."

## 5. Client Integration
The final JSON payload sent from the Decision Engine to the Browser Extension completely dictates the UI. The extension acts purely as a "dumb terminal" rendering the `ui_color`, `banner_text`, and `recommended_action` provided by this engine.

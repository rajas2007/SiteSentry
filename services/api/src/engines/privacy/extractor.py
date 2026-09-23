import re


class PrivacyPolicyExtractor:
    @staticmethod
    def extract_relevant_text(raw_text: str | None) -> str | None:
        """
        Extracts paragraphs that likely contain privacy policy information.
        Reduces arbitrary HTML/text to just relevant sentences to avoid sending
        PII, passwords, or unrelated content to the external LLM.
        """
        if not raw_text:
            return None

        # Very basic extraction: looking for sentences with privacy keywords
        keywords = [
            "privacy",
            "data",
            "share",
            "sell",
            "third party",
            "affiliate",
            "marketing",
            "consent",
            "cookie",
            "track",
        ]

        # Split by periods/newlines for simple sentence/block extraction
        blocks = re.split(r"[\.\n]+", raw_text)

        relevant_blocks = []
        for block in blocks:
            lower_block = block.lower()
            if any(k in lower_block for k in keywords):
                # Clean up multiple spaces
                clean_block = re.sub(r"\s+", " ", block).strip()
                if clean_block and len(clean_block) > 10:
                    relevant_blocks.append(clean_block)

        if not relevant_blocks:
            return None

        # Cap the length to avoid sending massive payloads
        extracted = ". ".join(relevant_blocks)
        return extracted[:4000]

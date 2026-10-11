class ThreatIntelUnavailableError(Exception):
    """Raised when an external threat intelligence lookup is unavailable or unconfigured."""

    def __init__(
        self,
        message: str = "Service unavailable",
        status_code: int | None = None,
    ) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


class ProviderUnavailableError(ThreatIntelUnavailableError):
    """Raised when a specific threat intelligence provider cannot be queried."""

    pass

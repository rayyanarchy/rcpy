class RcpyError(Exception):
    """An error with a message that is safe and useful to show the user.

    `status` is the HTTP status the API uses when this reaches a request.
    """

    def __init__(self, message: str, status: int = 400):
        super().__init__(message)
        self.status = status

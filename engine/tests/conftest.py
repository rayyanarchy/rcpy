import pytest

from rcpy.strategies.demo import DEMO


@pytest.fixture
def result():
    return DEMO.model_copy(deep=True)

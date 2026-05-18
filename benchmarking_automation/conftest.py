from pathlib import Path
import sys


PACKAGE_ROOT = Path(__file__).resolve().parent

# Tests import project modules as top-level packages (parser, normalizer, models),
# so make repo-root and benchmarking_automation-root pytest runs behave the same.
if str(PACKAGE_ROOT) not in sys.path:
    sys.path.insert(0, str(PACKAGE_ROOT))

# victors export, loaded straight from ml/export so a model update is just his commit
# analog_readers does `import analog_runtime as rt`, so that folder goes on the path
import os
import sys
from pathlib import Path

EXPORT = Path(os.environ.get("ML_EXPORT_DIR") or Path(__file__).resolve().parents[3] / "ml/export")
sys.path.insert(0, str(EXPORT))

import analog_readers as readers  # noqa: E402
import analog_runtime as runtime  # noqa: E402

import struct

import numpy as np

# height grid file: float32 min, float32 max (little endian), then n x n uint16, row 0 = north


def encode(z: np.ndarray) -> bytes:
    lo, hi = float(np.nanmin(z)), float(np.nanmax(z))
    q = np.round((np.nan_to_num(z, nan=lo) - lo) / max(hi - lo, 1e-9) * 65535).astype("<u2")
    return struct.pack("<ff", lo, hi) + q.tobytes()


def decode(b: bytes) -> np.ndarray:
    lo, hi = struct.unpack("<ff", b[:8])
    q = np.frombuffer(b, dtype="<u2", offset=8)
    n = int(round(q.size ** 0.5))
    return (q.reshape(n, n).astype(np.float32) / 65535) * (hi - lo) + lo

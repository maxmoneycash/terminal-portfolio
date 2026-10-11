"""Timing invariants independent of the original recording."""
import unittest
import numpy as np
from from_video import retime

class TimingTests(unittest.TestCase):
    def test_pause_compression_preserves_stroke_rhythm(self):
        times = np.array([0, 1, 1.1, 1.3, 2, 3, 4, 4.1])
        active = np.array([1, 2, 3, 6, 7])
        clock, speed = retime(times, active, 2)
        self.assertAlmostEqual(clock[active[0]], 0)
        self.assertAlmostEqual(clock[active[-1]], 2)
        self.assertTrue(np.all(np.diff(clock[active[0]:active[-1]+1]) >= 0))
        self.assertAlmostEqual((clock[3] - clock[2]) / (clock[2] - clock[1]), 2)
        self.assertAlmostEqual((clock[6] - clock[3]) * speed, 0.2)

    def test_untimed_recording_is_rejected(self):
        with self.assertRaises(ValueError):
            retime(np.array([0.0]), np.array([0]), 5.6)

if __name__ == '__main__': unittest.main()

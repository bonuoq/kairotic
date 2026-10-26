// SPDX-License-Identifier: MPL-2.0
// Kairotic · Study 28 · shift (the native part)
// A thin C entry point over stftPitchShift (Jürgen Hock, MIT): one channel of samples in, one out, with
// numbers instead of a command line, and a *schedule* of pitch factors instead of fixed ones — the
// factors can change from one STFT frame to the next (StftPitchShiftCore::factors), so a recording can be
// reharmonized along a progression, not only shifted by one interval.
//
//   ks_shift(sr, n, in, out, frame, hop, quefrency, distortion, normalize,
//            steps, times, counts, factors)
//
//   times[k]   the second at which step k begins (ascending; the first one should be 0)
//   counts[k]  how many factors step k has (1 = mono shift, more = poly shift, a chord)
//   factors    every factor of every step, one after another (2 = an octave up, 1.5 = a fifth…)
//
// The input is padded with one frame of silence on each side, so the first and last samples are covered
// by as many frames as the middle ones (the library's loop leaves the tail out and fades the head in), and
// the output is exactly as long as the input. Returns 0, or a negative code for parameters the library
// would refuse (it would throw, and this build has no exceptions).
//
// Built with wasi-sdk (no Emscripten glue): see build.sh.

// every standard header the library uses, before the macro below (which must not reach them)
#include <algorithm>
#include <bit>
#include <cassert>
#include <chrono>
#include <cmath>
#include <complex>
#include <concepts>
#include <cstdlib>
#include <cstring>
#include <functional>
#include <limits>
#include <map>
#include <memory>
#include <numeric>
#include <ostream>
#include <span>
#include <stdexcept>
#include <string>
#include <tuple>
#include <vector>

// The library throws only when its parameters are wrong; they are checked here before, so a throw is
// unreachable: in this build (-fno-exceptions) it becomes abort().
#define throw std::abort(),

#include <StftPitchShift/RFFT.h>
#include <StftPitchShift/STFT.h>
#include <StftPitchShift/StftPitchShiftCore.h>

#undef throw

using namespace stftpitchshift;

namespace
{
  bool power_of_two(int x) { return x >= 4 && (x & (x - 1)) == 0; }
}

extern "C"
{
  // the version of stftPitchShift this was built with, as 100 * major + minor
  __attribute__((export_name("ks_version"))) int ks_version() { return 200; }

  __attribute__((export_name("ks_alloc"))) void* ks_alloc(int bytes) { return std::malloc(bytes > 0 ? bytes : 1); }
  __attribute__((export_name("ks_free"))) void ks_free(void* p) { std::free(p); }

  __attribute__((export_name("ks_shift")))
  int ks_shift(double sr, int n, const float* in, float* out,
               int frame, int hop, double quefrency, double distortion, int normalize,
               int steps, const double* times, const int* counts, const double* factors)
  {
    if (!(sr > 0) || n < 0) return -1;
    if (!power_of_two(frame)) return -2;
    if (hop < 1 || hop > frame) return -3;
    if (!(quefrency >= 0) || !(distortion > 0)) return -4;
    if (steps < 1) return -5;

    // the schedule, checked: every step has 1…16 factors, all of them positive and finite
    std::vector<std::vector<double>> chords(steps);
    std::vector<double> starts(steps);
    for (int k = 0, o = 0; k < steps; ++k)
    {
      if (counts[k] < 1 || counts[k] > 16) return -6;
      for (int i = 0; i < counts[k]; ++i, ++o)
      {
        const double f = factors[o];
        if (!(f > 0) || !std::isfinite(f)) return -7;
        chords[k].push_back(f);
      }
      starts[k] = times[k];
      if (k > 0 && !(starts[k] >= starts[k - 1])) return -8;
    }

    std::memset(out, 0, sizeof(float) * n);
    if (n == 0) return 0;

    // one frame of silence before and after
    const size_t pad = frame;
    std::vector<float> x(n + 2 * pad, 0.0f), y(n + 2 * pad, 0.0f);
    std::memcpy(x.data() + pad, in, sizeof(float) * n);

    auto fft = std::make_shared<RFFT>();
    const auto size = std::make_tuple<size_t, size_t>(frame, frame);

    StftPitchShiftCore<float> core(fft, size, hop, sr);
    core.quefrency(quefrency);
    core.distortion(distortion);
    core.normalization(normalize != 0);

    int current = -1;
    size_t index = 0;

    STFT<float> stft(fft, size, hop);
    stft(x, y, [&](std::span<std::complex<float>> dft)
    {
      // the step that holds at the centre of this frame, in the time of the input
      const double t = (double(index * hop) + frame / 2.0 - double(pad)) / sr;
      int k = current < 0 ? 0 : current;
      while (k + 1 < steps && starts[k + 1] <= t) ++k;
      if (k != current) { core.factors(chords[k]); current = k; }
      core.shiftpitch(dft);
      ++index;
    });

    std::memcpy(out, y.data() + pad, sizeof(float) * n);
    return 0;
  }
}

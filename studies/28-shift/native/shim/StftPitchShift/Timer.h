// SPDX-License-Identifier: MPL-2.0
// Kairotic · Study 28 · a stand-in for StftPitchShift/Timer.h
// The library's STFT measures its loop when asked (chronometry) and prints the times to std::cout. This
// build never asks, and std::cout would bring the whole of iostream into the WebAssembly (some 200 KB):
// here the timers do nothing and std::cout is a sink. Found first because shim/ comes first in -I.
#pragma once

#include <chrono>
#include <ostream>
#include <string>

namespace stftpitchshift
{
  template<class T>
  class Timer
  {
  public:
    void tic() {}
    void toc() {}
    std::string str() const { return {}; }
  };
}

namespace kairotic_shim
{
  struct Sink
  {
    template<class X> Sink& operator<<(const X&) { return *this; }
    Sink& operator<<(std::ostream& (*)(std::ostream&)) { return *this; }
  };
}

namespace std { inline kairotic_shim::Sink cout; }

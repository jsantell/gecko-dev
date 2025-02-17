/* -*- Mode: C++; tab-width: 8; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim: set ts=8 sts=2 et sw=2 tw=80: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef mozilla_unused_h
#define mozilla_unused_h

#include "mozilla/Types.h"

#ifdef __cplusplus

namespace mozilla {

//
// Suppress GCC warnings about unused return values with
//   unused << SomeFuncDeclaredWarnUnusedReturnValue();
//
struct unused_t
{
};

extern MFBT_DATA const unused_t unused;

template<typename T>
inline void
operator<<(const unused_t& /*unused*/, const T& /*unused*/)
{
}

} // namespace mozilla

#endif // __cplusplus

// An alternative to mozilla::unused for use in (a) C code and (b) code where
// linking with unused.o is difficult.
#define MOZ_UNUSED(expr) \
  do { if (expr) { (void)0; } } while (0)

#endif // mozilla_unused_h

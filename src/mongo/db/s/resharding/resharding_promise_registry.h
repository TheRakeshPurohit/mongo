/**
 *    Copyright (C) 2026-present MongoDB, Inc.
 *
 *    This program is free software: you can redistribute it and/or modify
 *    it under the terms of the Server Side Public License, version 1,
 *    as published by MongoDB, Inc.
 *
 *    This program is distributed in the hope that it will be useful,
 *    but WITHOUT ANY WARRANTY; without even the implied warranty of
 *    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *    Server Side Public License for more details.
 *
 *    You should have received a copy of the Server Side Public License
 *    along with this program. If not, see
 *    <http://www.mongodb.com/licensing/server-side-public-license>.
 *
 *    As a special exception, the copyright holders give permission to link the
 *    code of portions of this program with the OpenSSL library under certain
 *    conditions as described in each individual source file and distribute
 *    linked combinations including the program with the OpenSSL library. You
 *    must comply with the Server Side Public License in all respects for
 *    all of the code used other than as permitted herein. If you modify file(s)
 *    with this exception, you may extend this exception to your version of the
 *    file(s), but you are not obligated to do so. If you do not wish to do so,
 *    delete this exception statement from your version. If you delete this
 *    exception statement from all source files in the program, then also delete
 *    it in the license file.
 */

#pragma once

#include "mongo/base/status.h"
#include "mongo/util/concurrency/with_lock.h"
#include "mongo/util/functional.h"

#include <vector>

namespace mongo {

/**
 * Tracks all ReshardingPromise instances belonging to a single resharding participant
 * (coordinator, donor, or recipient).
 *
 * Document is the participant's state document type. recover() accepts a const Document&
 * so that each promise's recovery function can inspect the durably-recorded state and set its value
 * accordingly.
 *
 * Lifecycle:
 *   1. At construction time, each ReshardingPromise calls registerPromise().
 *   2. After the participant reconstructs after a failover, recover() is called once
 *      with the reloaded state document to fulfill promises whose milestones were
 *      already reached in the previous term.
 *   3. On any terminal error, setError() broadcasts the error to all remaining
 *      unfulfilled promises.
 *
 * Thread safety: registerPromise() must complete before any concurrent callers
 * invoke setError() or recover(). Declare the registry before the promises it
 * tracks so that C++ member initialization order guarantees this.
 */
template <typename Document>
class ReshardingPromiseRegistry {
public:
    using RecoveryFn = std::function<void(WithLock, const Document&)>;
    using ErrorFn = std::function<void(WithLock, Status)>;

    /**
     * Registers a promise's recovery and error callbacks. Called automatically by
     * ReshardingPromise's constructor — not intended for direct use.
     */
    void registerPromise(RecoveryFn recoveryFn, ErrorFn errorFn) {
        _entries.push_back({std::move(recoveryFn), std::move(errorFn)});
    }

    /**
     * Calls each registered recovery function with the provided document under the
     * caller's lock. Promises whose milestones have already been durably recorded
     * will be fulfilled immediately; unfulfilled promises are left pending.
     */
    void recover(WithLock lk, const Document& doc) {
        for (auto& entry : _entries) {
            entry.recoveryFn(lk, doc);
        }
    }

    /**
     * Propagates a terminal error to every registered promise that has not yet been
     * fulfilled.
     */
    void setError(WithLock lk, Status status) {
        for (auto& entry : _entries) {
            entry.errorFn(lk, status);
        }
    }

private:
    struct Entry {
        RecoveryFn recoveryFn;
        ErrorFn errorFn;
    };

    std::vector<Entry> _entries;
};

}  // namespace mongo

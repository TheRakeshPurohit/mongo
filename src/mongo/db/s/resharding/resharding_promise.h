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

#include "mongo/db/s/resharding/resharding_promise_registry.h"
#include "mongo/util/future.h"

#include <utility>

namespace mongo {

/**
 * A SharedPromise wrapper that self-registers with a ReshardingPromiseRegistry.
 *
 * On construction, registers:
 *   - An auto-generated ErrorFn that forwards a terminal error to the inner
 *     SharedPromise when registry.setError() is called.
 *   - A caller-supplied RecoveryFn, invoked during registry.recover() after a
 *     failover. The RecoveryFn receives the participant's reloaded state document
 *     and is responsible for fulfilling this promise if its milestone was already
 *     durably recorded in the previous term.
 *
 * Double-fulfillment (calling emplaceValue or setError after an earlier fulfillment)
 * is silently ignored so that registry.setError() can safely broadcast to all
 * registered promises without checking each one's individual state.
 *
 * The WithLock parameter on emplaceValue and setError is expected to guard fulfillment:
 * callers must hold the associated lock when fulfilling, ensuring that the readiness
 * check and fulfillment are performed atomically with respect to other lock-holders.
 *
 * Non-copyable and non-movable: the auto-generated ErrorFn captures 'this', so
 * instances must reside at a stable address (direct class member, or unique_ptr).
 */
template <typename T>
class ReshardingPromise {
public:
    template <typename Document>
    ReshardingPromise(ReshardingPromiseRegistry<Document>& registry,
                      typename ReshardingPromiseRegistry<Document>::RecoveryFn recoveryFn);

    ReshardingPromise(const ReshardingPromise&) = delete;
    ReshardingPromise& operator=(const ReshardingPromise&) = delete;
    ReshardingPromise(ReshardingPromise&&) = delete;
    ReshardingPromise& operator=(ReshardingPromise&&) = delete;

    SharedSemiFuture<T> getFuture() const;

    template <typename... Args>
    void emplaceValue(WithLock, Args&&... args);

    void setError(WithLock, Status status);

private:
    SharedPromise<T> _promise;
};

template <typename T>
template <typename Document>
ReshardingPromise<T>::ReshardingPromise(
    ReshardingPromiseRegistry<Document>& registry,
    typename ReshardingPromiseRegistry<Document>::RecoveryFn recoveryFn) {
    registry.registerPromise(std::move(recoveryFn),
                             [this](WithLock lk, Status status) { setError(lk, status); });
}

template <typename T>
SharedSemiFuture<T> ReshardingPromise<T>::getFuture() const {
    return _promise.getFuture();
}

template <typename T>
template <typename... Args>
void ReshardingPromise<T>::emplaceValue(WithLock, Args&&... args) {
    if (!_promise.getFuture().isReady()) {
        _promise.emplaceValue(std::forward<Args>(args)...);
    }
}

template <typename T>
void ReshardingPromise<T>::setError(WithLock, Status status) {
    if (!_promise.getFuture().isReady()) {
        _promise.setError(std::move(status));
    }
}

}  // namespace mongo

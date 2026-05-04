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

#include "mongo/base/error_codes.h"
#include "mongo/base/status.h"
#include "mongo/db/s/resharding/resharding_promise.h"
#include "mongo/unittest/unittest.h"
#include "mongo/util/future.h"

#define MONGO_LOGV2_DEFAULT_COMPONENT ::mongo::logv2::LogComponent::kTest

namespace mongo {
namespace {

struct TestState {
    int value = 0;
};

using TestRegistry = ReshardingPromiseRegistry<TestState>;

class ReshardingPromiseRegistryTest : public unittest::Test {};

TEST_F(ReshardingPromiseRegistryTest, RecoverFulfillsPromisesWhoseThresholdWasReached) {
    TestRegistry registry;
    ReshardingPromise<void> p1(registry, [&](WithLock lk, const TestState& state) {
        if (state.value >= 1)
            p1.emplaceValue(lk);
    });
    ReshardingPromise<void> p2(registry, [&](WithLock lk, const TestState& state) {
        if (state.value >= 2)
            p2.emplaceValue(lk);
    });
    auto f1 = p1.getFuture();
    auto f2 = p2.getFuture();

    registry.recover(WithLock::withoutLock(), TestState{1});

    ASSERT_OK(f1.getNoThrow());
    ASSERT_FALSE(f2.isReady());
}

TEST_F(ReshardingPromiseRegistryTest, SetErrorFulfillsAllRegisteredPromises) {
    TestRegistry registry;
    ReshardingPromise<void> p1(registry, [](WithLock, const TestState&) {});
    ReshardingPromise<void> p2(registry, [](WithLock, const TestState&) {});
    auto f1 = p1.getFuture();
    auto f2 = p2.getFuture();

    registry.setError(WithLock::withoutLock(), Status(ErrorCodes::InternalError, "boom"));

    ASSERT_TRUE(f1.isReady());
    ASSERT_TRUE(f2.isReady());
    ASSERT_EQ(f1.getNoThrow().code(), ErrorCodes::InternalError);
    ASSERT_EQ(f2.getNoThrow().code(), ErrorCodes::InternalError);
}

TEST_F(ReshardingPromiseRegistryTest, SetErrorSkipsAlreadyFulfilledPromises) {
    TestRegistry registry;
    ReshardingPromise<void> promise(registry, [](WithLock, const TestState&) {});
    auto future = promise.getFuture();

    promise.emplaceValue(WithLock::withoutLock());
    registry.setError(WithLock::withoutLock(), Status(ErrorCodes::InternalError, "too late"));

    ASSERT_OK(future.getNoThrow());
}

}  // namespace
}  // namespace mongo

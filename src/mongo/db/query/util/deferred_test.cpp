/**
 *    Copyright (C) 2023-present MongoDB, Inc.
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

#include "mongo/db/query/util/deferred.h"

#include "mongo/unittest/assert.h"
#include "mongo/unittest/framework.h"

namespace mongo {

TEST(DeferredTest, EagerInitialization) {
    Deferred<std::string> eager{"someString"};
    ASSERT_EQ(*eager.get(), std::string{"someString"});
}

TEST(DeferredTest, DeferredInitialization) {
    size_t initializationCount = 0;
    Deferred<std::string> deferred{[&]() {
        initializationCount++;
        return "someString";
    }};

    // Ensure the deferred object wasn't initialized on creation.
    ASSERT_EQ(initializationCount, 0);

    // Ensure that the deferred object is initialized on pointer dereferences.
    ASSERT_FALSE(deferred->empty());
    ASSERT_EQ(initializationCount, 1);

    // Ensure that the content of the deferred object is equal to its raw counterpart, while also
    // verifing that it is initialized at most once.
    ASSERT_EQ(*deferred.get(), std::string{"someString"});
    ASSERT_EQ(initializationCount, 1);
}
}  // namespace mongo
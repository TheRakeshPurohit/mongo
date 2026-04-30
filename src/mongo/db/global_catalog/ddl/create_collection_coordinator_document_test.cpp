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

// TODO SERVER-125792: Remove this once 10.0 is LTS
#include "mongo/bson/bsonmisc.h"
#include "mongo/bson/bsonobj.h"
#include "mongo/db/basic_types_gen.h"
#include "mongo/db/global_catalog/ddl/create_collection_coordinator_document_compatibility_util.h"
#include "mongo/db/global_catalog/ddl/create_collection_coordinator_document_gen.h"
#include "mongo/idl/idl_parser.h"
#include "mongo/unittest/unittest.h"
#include "mongo/util/assert_util.h"

namespace mongo {
namespace {

TEST(BackwardCompatibleCollationTest, LegacyEmptyObjectBecomesSimple) {
    // Pre-9.0 binaries persisted {} for simple collation. BF-43104.
    Collation c = deserializeBackwardCompatibleCollation(BSONObj{});
    ASSERT_EQ(c.getLocale(), "simple");
}

TEST(BackwardCompatibleCollationTest, CanonicalFormParsesUnchanged) {
    Collation c = deserializeBackwardCompatibleCollation(BSON("locale" << "en_US"));
    ASSERT_EQ(c.getLocale(), "en_US");
}

TEST(BackwardCompatibleCollationTest, NonEmptyMalformedStillRejected) {
    // The shim only widens the {} case; other malformed inputs must still fail.
    ASSERT_THROWS(deserializeBackwardCompatibleCollation(BSON("foo" << 1)), DBException);
}

TEST(BackwardCompatibleCollationTest, SimpleCollationSerializesAsEmptyObject) {
    // Simple collation must serialize as {} so that pre-9.0 binaries reading the coordinator
    // document treat it as "no collation" and do not store a defaultCollation in the catalog.
    Collation simple = deserializeBackwardCompatibleCollation(BSONObj{});
    ASSERT_TRUE(serializeBackwardCompatibleCollation(simple).isEmpty());
}

TEST(BackwardCompatibleCollationTest, NonSimpleCollationSerializesWithFullSpec) {
    Collation en = deserializeBackwardCompatibleCollation(BSON("locale" << "en_US"));
    BSONObj serialized = serializeBackwardCompatibleCollation(en);
    ASSERT_FALSE(serialized.isEmpty());
    ASSERT_EQ(serialized["locale"].str(), "en_US");
}

TEST(BackwardCompatibleCollationTest, RoundtripSimpleCollation) {
    // Writing {} and reading it back must yield the simple collation.
    Collation c1 = deserializeBackwardCompatibleCollation(BSONObj{});
    BSONObj stored = serializeBackwardCompatibleCollation(c1);
    ASSERT_TRUE(stored.isEmpty());
    Collation c2 = deserializeBackwardCompatibleCollation(stored);
    ASSERT_EQ(c2.getLocale(), "simple");
}

}  // namespace
}  // namespace mongo

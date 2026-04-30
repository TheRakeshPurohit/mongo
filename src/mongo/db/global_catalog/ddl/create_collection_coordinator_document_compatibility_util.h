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
#pragma once

#include "mongo/base/string_data.h"
#include "mongo/bson/bsonelement.h"
#include "mongo/bson/bsonmisc.h"
#include "mongo/bson/bsonobj.h"
#include "mongo/bson/bsonobjbuilder.h"
#include "mongo/db/basic_types_gen.h"
#include "mongo/db/query/collation/collation_spec.h"

namespace mongo {

// Pre-9.0 binaries persisted {} for simple collation in TranslatedRequestParams. The typed
// Collation struct requires locale, so map the empty object to {locale: "simple"} on read.
inline Collation deserializeBackwardCompatibleCollation(const BSONObj& obj) {
    if (obj.isEmpty()) {
        return Collation::parse(CollationSpec::kSimpleSpec);
    }
    return Collation::parse(obj);
}

// IDL any-type deserializer overload: extracts the embedded object then delegates.
inline Collation deserializeBackwardCompatibleCollation(const BSONElement& elem) {
    return deserializeBackwardCompatibleCollation(elem.Obj());
}

// Returns {} for simple collation; full spec otherwise. Used by tests and the IDL serializer.
inline BSONObj serializeBackwardCompatibleCollation(const Collation& collation) {
    if (collation.getLocale() == CollationSpec::kSimpleBinaryComparison) {
        return BSONObj{};
    }
    return collation.toBSON();
}

// IDL any-type serializer overload: appends to a BSONObjBuilder.
// Serialize simple collation as {} to maintain compatibility with pre-9.0 binaries. An 8.0 binary
// reading {} treats it as "no collation" (the correct behavior for simple collation). Writing the
// full spec {locale: "simple", caseLevel: false, ...} would cause an 8.0 binary to store it as a
// non-empty defaultCollation, producing a mismatch with local collections created without an
// explicit collation.
inline void serializeBackwardCompatibleCollation(const Collation& collation,
                                                 StringData fieldName,
                                                 BSONObjBuilder* builder) {
    builder->append(fieldName, serializeBackwardCompatibleCollation(collation));
}

}  // namespace mongo

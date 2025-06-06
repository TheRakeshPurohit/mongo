/**
 *    Copyright (C) 2022-present MongoDB, Inc.
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

#include "mongo/s/shard_version.h"

#include "mongo/idl/idl_parser.h"
#include "mongo/s/shard_version_gen.h"

#include <boost/move/utility_core.hpp>
#include <boost/optional/optional.hpp>

namespace mongo {

ShardVersion ShardVersion::parse(const BSONElement& element) {
    auto parsedVersion = ShardVersionBase::parse(IDLParserContext("ShardVersion"), element.Obj());
    auto version = parsedVersion.getVersion();
    ShardVersion sv(ChunkVersion({parsedVersion.getEpoch(), parsedVersion.getTimestamp()},
                                 {version.getSecs(), version.getInc()}),
                    parsedVersion.getPlacementConflictTime());
    sv._ignoreShardingCatalogUuidMismatch = parsedVersion.getIgnoreCollectionUuidMismatch();
    return sv;
}

void ShardVersion::serialize(StringData field, BSONObjBuilder* builder) const {
    ShardVersionBase version;
    version.setGeneration({placementVersion().epoch(), placementVersion().getTimestamp()});
    version.setPlacement(
        Timestamp(placementVersion().majorVersion(), placementVersion().minorVersion()));
    version.setPlacementConflictTime(_placementConflictTime);
    if (MONGO_unlikely(_ignoreShardingCatalogUuidMismatch)) {
        version.setIgnoreCollectionUuidMismatch(_ignoreShardingCatalogUuidMismatch);
    }

    builder->append(field, version.toBSON());
}

std::string ShardVersion::toString() const {
    return placementVersion().toString();
}

}  // namespace mongo

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

#include "mongo/db/index_builds/resumable_index_builds_common.h"

#include "mongo/db/shard_role/transaction_resources.h"
#include "mongo/db/storage/kv/kv_engine.h"
#include "mongo/db/storage/record_store.h"
#include "mongo/util/fail_point.h"

#define MONGO_LOGV2_DEFAULT_COMPONENT ::mongo::logv2::LogComponent::kStorage

namespace mongo::index_builds {

MONGO_FAIL_POINT_DEFINE(failToParseResumeIndexInfo);

boost::optional<ResumeIndexInfo> readResumeIndexInfo(StorageEngine* engine,
                                                     OperationContext* opCtx,
                                                     const std::string& ident) {
    auto rs = engine->getEngine()->getRecordStore(
        opCtx, NamespaceString::kEmpty, ident, RecordStore::Options{}, boost::none /* uuid */);

    auto cursor = rs->getCursor(opCtx, *shard_role_details::getRecoveryUnit(opCtx));
    auto record = cursor->next();
    if (!record) {
        return boost::none;
    }
    auto doc = record.value().data.toBson();

    // Parse the documents here so that we can restart (or abort) the build if the document
    // doesn't contain all the necessary information to be able to resume building the index.
    ResumeIndexInfo resumeInfo;
    try {
        if (MONGO_unlikely(failToParseResumeIndexInfo.shouldFail())) {
            uasserted(ErrorCodes::FailPointEnabled,
                      "failToParseResumeIndexInfo fail point is enabled");
        }

        resumeInfo = ResumeIndexInfo::parse(doc, IDLParserContext("ResumeIndexInfo"));
    } catch (const DBException& e) {
        LOGV2(4916300, "Failed to parse resumable index info", "error"_attr = e.toStatus());

        // Ignore the error so that we can restart the index build instead of resume it. We
        // will drop the internal ident if we failed to parse, either immediately on catalog
        // repair or via abort for primary-driven index builds.
        return boost::none;
    }

    LOGV2(4916301,
          "Found unfinished index build to resume",
          "buildUUID"_attr = resumeInfo.getBuildUUID(),
          "collectionUUID"_attr = resumeInfo.getCollectionUUID(),
          "phase"_attr = idl::serialize(resumeInfo.getPhase()));

    return resumeInfo;
}

}  // namespace mongo::index_builds

/**
 * Test that _shardsvrFetchCollMetadata correctly persists collection and chunk metadata locally
 * on the shard.
 */

import {ShardingTest} from "jstests/libs/shardingtest.js";

const st = new ShardingTest({shards: 1, rs: {nodes: 1}});

// Helper: Get collection metadata from the global catalog.
function getCollMetadataFromGlobalCatalog(ns) {
    return st.s.getDB("config").collections.findOne({_id: ns});
}

// Helper: Get chunks metadata from the global catalog.
function getChunksMetadataFromGlobalCatalog(uuid) {
    return st.s.getDB("config").chunks.find({uuid}).toArray();
}

// Helper: Assert zero metadata inconsistencies for the given collection
function assertNoMetadataInconsistencies(coll) {
    const inconsistencies = coll.checkMetadataConsistency().toArray();
    assert.eq(0, inconsistencies.length, tojson(inconsistencies));
}

{
    jsTest.log("Test that _shardsvrFetchCollMetadata persists collection and chunk metadata");

    const dbName = jsTestName();
    const collName = "testColl";
    const ns = dbName + "." + collName;

    // Enable sharding on the database and shard the collection.
    assert.commandWorked(st.s.adminCommand({enableSharding: dbName, primaryShard: st.shard0.shardName}));
    assert.commandWorked(st.s.adminCommand({shardCollection: ns, key: {_id: 1}}));

    // Insert data.
    const testColl = st.s.getDB(dbName).getCollection(collName);
    for (let i = 0; i < 100; ++i) {
        assert.commandWorked(testColl.insert({_id: i}));
    }

    // Explicitly create multiple chunks.
    assert.commandWorked(st.s.adminCommand({split: ns, middle: {_id: 25}}));
    assert.commandWorked(st.s.adminCommand({split: ns, middle: {_id: 50}}));
    assert.commandWorked(st.s.adminCommand({split: ns, middle: {_id: 75}}));

    // Disable migrations.
    assert.commandWorked(
        st.configRS
            .getPrimary()
            .adminCommand({_configsvrSetAllowMigrations: ns, allowMigrations: false, writeConcern: {w: "majority"}}),
    );

    // Fetch the UUID explicitly.
    const globalCollMetadata = getCollMetadataFromGlobalCatalog(ns);
    assert(globalCollMetadata, "Collection metadata not found for namespace: " + ns);
    const collUUID = globalCollMetadata.uuid;

    // Verify explicitly that splits occurred.
    let chunks;
    assert.soon(
        () => {
            chunks = getChunksMetadataFromGlobalCatalog(collUUID);
            return chunks.length >= 4;
        },
        "Chunk splitting failed; expected at least 4 chunks.",
        5000,
        1000,
    );

    // Run the command on the shard within a retryable write session.
    const session = st.shard0.startSession({retryWrites: true});
    const sessionDb = session.getDatabase(dbName);
    try {
        assert.commandWorked(
            sessionDb.runCommand({
                _shardsvrFetchCollMetadata: ns,
                writeConcern: {w: "majority"},
                lsid: session.getSessionId(),
                txnNumber: NumberLong(1),
            }),
        );
    } finally {
        session.endSession();
    }

    // Validate collection and chunk metadata consistency for the collection.
    assertNoMetadataInconsistencies(testColl);
}

{
    jsTest.log("Test that _shardsvrFetchCollMetadata fails when migrations are allowed");

    const dbName = jsTestName();
    const collName = "testCollWithMigrations";
    const ns = dbName + "." + collName;

    assert.commandWorked(st.s.adminCommand({enableSharding: dbName, primaryShard: st.shard0.shardName}));
    assert.commandWorked(st.s.adminCommand({shardCollection: ns, key: {_id: 1}}));

    // Intentionally set allowMigrations to true on the config server
    assert.commandWorked(
        st.configRS
            .getPrimary()
            .adminCommand({_configsvrSetAllowMigrations: ns, allowMigrations: true, writeConcern: {w: "majority"}}),
    );

    // Expect that the command fails because migrations are not disabled.
    const session = st.shard0.startSession({retryWrites: true});
    const sessionDb = session.getDatabase(dbName);
    try {
        assert.commandFailedWithCode(
            sessionDb.runCommand({
                _shardsvrFetchCollMetadata: ns,
                writeConcern: {w: "majority"},
                lsid: session.getSessionId(),
                txnNumber: NumberLong(1),
            }),
            10140200,
        );
    } finally {
        session.endSession();
    }
}

{
    jsTest.log("Test that _shardsvrFetchCollMetadata fails when not called within retryable write");

    const dbName = jsTestName();
    const collName = "testCollWithMigrations";
    const ns = dbName + "." + collName;

    assert.commandWorked(st.s.adminCommand({enableSharding: dbName, primaryShard: st.shard0.shardName}));
    assert.commandWorked(st.s.adminCommand({shardCollection: ns, key: {_id: 1}}));

    // The retryable-write uassert fires before the migrations-disabled check, so there's no need
    // to disable migrations here.
    assert.commandFailedWithCode(
        st.shard0.getDB(dbName).runCommand({_shardsvrFetchCollMetadata: ns, writeConcern: {w: "majority"}}),
        10303100,
    );
}

{
    jsTest.log("Test idempotency: Running _shardsvrFetchCollMetadata twice produces consistent metadata");

    const dbName = jsTestName();
    const collName = "idempotentColl";
    const ns = dbName + "." + collName;

    // Enable sharding and shard the collection.
    assert.commandWorked(st.s.adminCommand({enableSharding: dbName, primaryShard: st.shard0.shardName}));
    assert.commandWorked(st.s.adminCommand({shardCollection: ns, key: {_id: 1}}));

    // Insert data
    const testColl = st.s.getDB(dbName).getCollection(collName);
    for (let i = 0; i < 100; ++i) {
        assert.commandWorked(testColl.insert({_id: i}));
    }

    // Explicitly create multiple chunks
    assert.commandWorked(st.s.adminCommand({split: ns, middle: {_id: 25}}));
    assert.commandWorked(st.s.adminCommand({split: ns, middle: {_id: 50}}));
    assert.commandWorked(st.s.adminCommand({split: ns, middle: {_id: 75}}));

    // Disable migrations.
    assert.commandWorked(
        st.configRS
            .getPrimary()
            .adminCommand({_configsvrSetAllowMigrations: ns, allowMigrations: false, writeConcern: {w: "majority"}}),
    );

    // Fetch the UUID explicitly.
    const globalCollMetadata = getCollMetadataFromGlobalCatalog(ns);
    assert(globalCollMetadata, "Collection metadata not found for namespace: " + ns);
    const collUUID = globalCollMetadata.uuid;

    // Verify explicitly that splits occurred.
    let chunks;
    assert.soon(
        () => {
            chunks = getChunksMetadataFromGlobalCatalog(collUUID);
            return chunks.length >= 4;
        },
        "Chunk splitting failed; expected at least 4 chunks.",
        5000,
        1000,
    );

    // Run the command twice within the same retryable write session
    const session = st.shard0.startSession({retryWrites: true});
    const sessionDb = session.getDatabase(dbName);
    try {
        // Run the command for the first time.
        assert.commandWorked(
            sessionDb.runCommand({
                _shardsvrFetchCollMetadata: ns,
                writeConcern: {w: "majority"},
                lsid: session.getSessionId(),
                txnNumber: NumberLong(1),
            }),
        );

        // Run the command a second time (idempotency).
        assert.commandWorked(
            sessionDb.runCommand({
                _shardsvrFetchCollMetadata: ns,
                writeConcern: {w: "majority"},
                lsid: session.getSessionId(),
                txnNumber: NumberLong(2),
            }),
        );
    } finally {
        session.endSession();
    }

    // Validate collection and chunk metadata consistency for the collection.
    assertNoMetadataInconsistencies(testColl);
}

st.stop();

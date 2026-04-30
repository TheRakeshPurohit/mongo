/**
 * Tests that traverseF elision without yield-time invalidation can miss documents when a
 * concurrent multikey flip breaks PathArrayness assumptions.
 *
 * Setup:
 *   - Collection has document {a: {b: 1, c: 1}} with indexes on {"a.b": 1} and {"a.c": 1}.
 *   - Both indexes are non-multikey, so PathArrayness infers canPathBeArray("a.b") == false
 *     and canPathBeArray("a.c") == false.
 *
 * Three plan shapes exercise the elision:
 *   - FETCH mode: a $match + $group with hint {"a.b": 1}. One predicate drives the IXSCAN;
 *     the other becomes a residual filter on FETCH with traverseF elision.
 *   - COLLSCAN mode: a $match with hint {$natural: 1} on a non-clustered collection. The
 *     filter runs on a generic ScanStage with traverseF elision.
 *   - CLUSTERED COLLSCAN mode: an _id range predicate on a clustered collection drives
 *     the clustered ScanStage bounds; residual "a.b"/"a.c" predicates run as the filter
 *     with traverseF elision.
 *
 * While yielded (before restore), we insert {a: [{b: 1, c: 1}, {b: 2, c: 1}]}, flipping both
 * indexes to multikey. When PathArrayness is enabled, the elided traverseF causes the query to
 * return wrong results (empty set) because the direct getField chain cannot descend into arrays.
 *
 * When PathArrayness is disabled, traverseF is never elided, so the query returns the new
 * document correctly.
 *
 * @tags: [requires_fcv_90, requires_sbe]
 */
import {getEngine, getQueryPlanners} from "jstests/libs/query/analyze_plan.js";
import {configureFailPoint} from "jstests/libs/fail_point_util.js";
import {funWithArgs} from "jstests/libs/parallel_shell_helpers.js";

const fetchCase = {
    mode: "fetch",
    pipeline: [{$match: {"a.b": 2, "a.c": 1}}, {$group: {_id: "$_id"}}],
    aggOptions: {hint: {"a.b": 1}},
    requiredStage: "fetch",
};

const collScanCase = {
    mode: "collscan",
    pipeline: [{$match: {"a.b": 2, "a.c": 1}}, {$group: {_id: "$_id"}}],
    aggOptions: {hint: {$natural: 1}},
    requiredStage: "scan",
};

const clusteredCollScanCase = {
    mode: "clusteredCollscan",
    pipeline: [{$match: {_id: {$gte: 0}, "a.b": 2, "a.c": 1}}, {$group: {_id: "$_id"}}],
    aggOptions: {hint: {$natural: 1}},
    requiredStage: "scan",
    requireClusteredBounds: true,
    createClustered: true,
};

function runTest({testCase, setParameters, expect}) {
    jsTest.log.info("Running " + testCase.mode + " with setParameters=" + tojson(setParameters) + ", expect=" + expect);

    const conn = MongoRunner.runMongod({setParameter: setParameters});
    assert.neq(null, conn, "mongod was unable to start up");

    const testDb = conn.getDB("test");
    const coll = testDb.traversef_elision_yield;

    coll.drop();

    if (testCase.createClustered) {
        assert.commandWorked(testDb.createCollection(coll.getName(), {clusteredIndex: {key: {_id: 1}, unique: true}}));
    }

    assert.commandWorked(coll.createIndex({"a.b": 1}));
    assert.commandWorked(coll.createIndex({"a.c": 1}));
    assert.commandWorked(coll.insert({_id: 0, a: {b: 1, c: 1}}));

    const explain = coll.explain().aggregate(testCase.pipeline, testCase.aggOptions);
    jsTest.log.info("Explain: " + tojson(explain));

    assert.eq(getEngine(explain), "sbe", "Expected SBE engine");
    const stages = getQueryPlanners(explain)[0].winningPlan.slotBasedPlan.stages;
    assert(
        stages.includes(testCase.requiredStage),
        "Expected a " + testCase.requiredStage + " stage in the SBE plan: " + stages,
    );
    if (testCase.requireClusteredBounds) {
        assert(
            stages.includes("minRecordId") || stages.includes("maxRecordId"),
            "Expected a clustered scan (min/maxRecordId slot) in the SBE plan: " + stages,
        );
    }

    assert.commandWorked(testDb.adminCommand({setParameter: 1, internalQueryExecYieldIterations: 1}));

    const fp = configureFailPoint(testDb, "setYieldAllLocksHang", {namespace: coll.getFullName()});

    try {
        let awaitShell = startParallelShell(
            funWithArgs(
                function (dbName, collName, pipeline, aggOptions, expect) {
                    const testColl = db.getSiblingDB(dbName)[collName];
                    const runAgg = () => testColl.aggregate(pipeline, aggOptions).toArray();
                    if (expect === "wrong") {
                        const results = runAgg();
                        assert.sameMembers(results, [], "Unexpected results: " + tojson(results));
                    } else if (expect === "correct") {
                        const results = runAgg();
                        assert.sameMembers(results, [{_id: 1}], "Unexpected results: " + tojson(results));
                    } else {
                        throw new Error("Unknown expect value: " + expect);
                    }
                },
                testDb.getName(),
                coll.getName(),
                testCase.pipeline,
                testCase.aggOptions,
                expect,
            ),
            conn.port,
        );

        fp.wait();

        // While yielded, insert a document that flips both indexes to multikey.
        assert.commandWorked(
            coll.insert({
                _id: 1,
                a: [
                    {b: 1, c: 1},
                    {b: 2, c: 1},
                ],
            }),
        );

        fp.off();
        awaitShell();
    } finally {
        fp.off();
    }

    // A fresh query sees updated PathArrayness and returns the correct result.
    const freshResults = coll.aggregate(testCase.pipeline, testCase.aggOptions).toArray();
    assert.eq(freshResults, [{_id: 1}], "A fresh query must find the matching document. Got: " + tojson(freshResults));

    MongoRunner.stopMongod(conn);
}

const flagOnOn = {
    featureFlagPathArrayness: true,
    internalEnablePathArrayness: true,
    logComponentVerbosity: tojson({query: {verbosity: 5}}),
};
const flagOnOff = {
    featureFlagPathArrayness: true,
    internalEnablePathArrayness: false,
    logComponentVerbosity: tojson({query: {verbosity: 5}}),
};
const flagOffOn = {
    featureFlagPathArrayness: false,
    internalEnablePathArrayness: true,
    logComponentVerbosity: tojson({query: {verbosity: 5}}),
};
const flagOffOff = {
    featureFlagPathArrayness: false,
    internalEnablePathArrayness: false,
    logComponentVerbosity: tojson({query: {verbosity: 5}}),
};

// FETCH mode: traverseF elision on the residual FETCH filter. Without invalidation, the query
// returns wrong results (empty set) when an elided path becomes multikey during yield.
runTest({testCase: fetchCase, setParameters: flagOnOn, expect: "wrong"});
runTest({testCase: fetchCase, setParameters: flagOnOff, expect: "correct"});
runTest({testCase: fetchCase, setParameters: flagOffOn, expect: "correct"});
runTest({testCase: fetchCase, setParameters: flagOffOff, expect: "correct"});

// COLLSCAN mode: traverseF elision on the ScanStage filter. Without invalidation, the query
// returns wrong results (empty set) when an elided path becomes multikey during yield.
runTest({testCase: collScanCase, setParameters: flagOnOn, expect: "wrong"});
runTest({testCase: collScanCase, setParameters: flagOnOff, expect: "correct"});
runTest({testCase: collScanCase, setParameters: flagOffOn, expect: "correct"});
runTest({testCase: collScanCase, setParameters: flagOffOff, expect: "correct"});

// CLUSTERED COLLSCAN mode: same ScanStage machinery, reached via the clustered-collection
// _id-bounded scan path. Without invalidation, wrong results for the same reason.
runTest({testCase: clusteredCollScanCase, setParameters: flagOnOn, expect: "wrong"});
runTest({testCase: clusteredCollScanCase, setParameters: flagOnOff, expect: "correct"});
runTest({testCase: clusteredCollScanCase, setParameters: flagOffOn, expect: "correct"});
runTest({testCase: clusteredCollScanCase, setParameters: flagOffOff, expect: "correct"});

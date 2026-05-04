/**
 * This test ensures that a chained secondary reading from another secondary using a
 * kLastApplied read source correctly changes its read source to kNoTimestamp if its
 * sync source transitions to primary. This ensures that the chained secondary cannot
 * read a step up no-op entry beyond the new primary's oplog visibility timestamp.
 *
 * It must wait until the new primary updates its oplog visibility to include the
 * no-op entry.
 *
 * @tags: [
 *   multiversion_incompatible,
 * ]
 */
import {ReplSetTest} from "jstests/libs/replsettest.js";
import {configureFailPoint} from "jstests/libs/fail_point_util.js";
import {restartServerReplication, stopServerReplication} from "jstests/libs/write_concern_util.js";

// Start a replica set with 3 nodes and speed up the no-op writer on secondary0.
const name = jsTestName();
const rst = new ReplSetTest({name: name, nodes: [{}, {setParameter: {periodicNoopIntervalSecs: 2}}, {}]});
rst.startSet();
let [primary, secondary0, secondary1] = rst.nodes;

rst.initiate();
rst.waitForState(primary, ReplSetTest.State.PRIMARY);
rst.awaitReplication();

// Make secondary1 sync from secondary0, which we will step up to become primary, by
// making sure it's ahead.
stopServerReplication(secondary1);
assert.commandWorked(primary.getDB("testDB").getCollection("testColl").insert({a: 1}));
assert.soonNoExcept(function () {
    return secondary0.getDB("testDB").getCollection("testColl").findOne({a: 1});
});
assert.commandWorked(
    secondary1.adminCommand({
        configureFailPoint: "forceSyncSourceCandidate",
        mode: "alwaysOn",
        data: {hostAndPort: secondary0.host},
    }),
);

restartServerReplication(secondary1);
rst.awaitSyncSource(secondary1, secondary0);

jsTest.log.info("Set hangBeforeUpdatingVisibility failpoint on secondary0");
// Hang the oplog visibility thread so secondary0 does not advance visibility to include the
// the step-up no-op entry.
const hangOplogVisibilityThread = configureFailPoint(secondary0, "hangBeforeUpdatingVisibility");

jsTest.log.info("Running replSetStepUp on secondary0");
secondary0.adminCommand({replSetStepUp: 1});

jsTest.log.info("Wait for secondary0 to hit hangBeforeUpdatingVisibility failpoint");
hangOplogVisibilityThread.wait();

const secondaryOplogVis = secondary1.getDB("admin").serverStatus().wiredTiger.oplog;
jsTest.log.info("oplog visibility ts on secondary1: " + tojson(secondaryOplogVis));
assert.commandWorked(secondary0.adminCommand({setParameter: 1, writePeriodicNoops: true}));
const primaryOplogVis = secondary0.getDB("admin").serverStatus().wiredTiger.oplog;
jsTest.log.info("oplog visibility ts on the new primary (secondary0): " + tojson(primaryOplogVis));

// Check that secondary1 is not able to see beyond new primary's oplog visibility point. Since
// secondary1 should not be able to observe the new primary no-op entry, confirm that the last
// entry it sees is in term 1.
assert.lte(timestampCmp(secondaryOplogVis["visibility timestamp"], primaryOplogVis["visibility timestamp"]), 0);
const lastSecondaryOplogEntry = secondary1.getDB("local").oplog.rs.find().sort({$natural: -1}).limit(1)[0];
jsTest.log.info("the last oplog entry on the secondary: " + tojson(lastSecondaryOplogEntry));
assert.eq(lastSecondaryOplogEntry.t, 1);
// Check that the primary and chained secondary's terms are both 2.
const primReplSetGetStatus = secondary0.adminCommand({replSetGetStatus: 1});
const secReplSetGetStatus = secondary1.adminCommand({replSetGetStatus: 1});
assert.eq(primReplSetGetStatus.term, 2);
assert.eq(secReplSetGetStatus.term, 2);

hangOplogVisibilityThread.off();

rst.awaitNodesAgreeOnPrimary(rst.timeoutMS, [primary, secondary0, secondary1], secondary0);
rst.awaitReplication();
rst.stopSet();

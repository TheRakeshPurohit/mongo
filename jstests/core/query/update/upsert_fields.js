// Upsert without shard key targeted to a single shard must run in a transaction or retryable write
// if the upsert doc does not belong on the initial shard.
// @tags: [assumes_unsharded_collection]

//
// Upsert behavior tests for field extraction
//

var coll = db[jsTestName()];
coll.drop();

var upsertedResult = function(query, expr) {
    coll.drop();
    let result = coll.update(query, expr, {upsert: true});
    return result;
};

var upsertedField = function(query, expr, fieldName) {
    var res = assert.commandWorked(upsertedResult(query, expr));
    var doc = coll.findOne();
    assert.neq(doc, null, "findOne query returned no results! UpdateRes: " + tojson(res));
    return doc[fieldName];
};

var upsertedId = function(query, expr) {
    return upsertedField(query, expr, "_id");
};

var upsertedXVal = function(query, expr) {
    return upsertedField(query, expr, "x");
};

//
// _id field has special rules
//

// _id autogenerated
assert.neq(null, upsertedId({}, {}));

// _id autogenerated with add'l fields
assert.neq(null, upsertedId({}, {a: 1}));
assert.eq(1, upsertedField({}, {a: 1}, "a"));
assert.neq(null, upsertedId({}, {$set: {a: 1}}, "a"));
assert.eq(1, upsertedField({}, {$set: {a: 1}}, "a"));
assert.neq(null, upsertedId({}, {$setOnInsert: {a: 1}}, "a"));
assert.eq(1, upsertedField({}, {$setOnInsert: {a: 1}}, "a"));

// _id not autogenerated
assert.eq(1, upsertedId({}, {_id: 1}));
assert.eq(1, upsertedId({}, {$set: {_id: 1}}));
assert.eq(1, upsertedId({}, {$setOnInsert: {_id: 1}}));

// _id type error
assert.writeError(upsertedResult({}, {_id: [1, 2]}));
assert.writeError(upsertedResult({}, {_id: undefined}));
assert.writeError(upsertedResult({}, {$set: {_id: [1, 2]}}));
// Fails in v2.6, no validation
assert.writeError(upsertedResult({}, {$setOnInsert: {_id: undefined}}));

// Check things that are pretty much the same for replacement and $op style upserts
for (var i = 0; i < 3; i++) {
    // replacement style
    var expr = {};

    // $op style
    if (i == 1)
        expr = {$set: {a: 1}};
    if (i == 2)
        expr = {$setOnInsert: {a: 1}};

    var isReplStyle = i == 0;

    // _id extracted
    assert.eq(1, upsertedId({_id: 1}, expr));
    // All below fail in v2.6, no $ops for _id and $and/$or not explored
    assert.eq(1, upsertedId({_id: {$eq: 1}}, expr));
    assert.eq(1, upsertedId({_id: {$all: [1]}}, expr));
    assert.eq(1, upsertedId({_id: {$in: [1]}}, expr));
    assert.eq(1, upsertedId({$and: [{_id: 1}]}, expr));
    assert.eq(1, upsertedId({$and: [{_id: {$eq: 1}}]}, expr));
    assert.eq(1, upsertedId({$or: [{_id: 1}]}, expr));
    assert.eq(1, upsertedId({$or: [{_id: {$eq: 1}}]}, expr));

    // _id not extracted, autogenerated
    assert.neq(1, upsertedId({_id: {$gt: 1}}, expr));
    assert.neq(1, upsertedId({_id: {$ne: 1}}, expr));
    assert.neq(1, upsertedId({_id: {$in: [1, 2]}}, expr));
    assert.neq(1, upsertedId({_id: {$elemMatch: {$eq: 1}}}, expr));
    assert.neq(1, upsertedId({_id: {$exists: true}}, expr));
    assert.neq(1, upsertedId({_id: {$not: {$eq: 1}}}, expr));
    assert.neq(1, upsertedId({$or: [{_id: {$eq: 1}}, {_id: 2}]}, expr));
    assert.neq(1, upsertedId({$nor: [{_id: 1}]}, expr));
    assert.neq(1, upsertedId({$nor: [{_id: {$eq: 1}}]}, expr));
    assert.neq(1, upsertedId({$nor: [{_id: {$eq: 1}}, {_id: 1}]}, expr));

    // _id extraction errors
    assert.writeError(upsertedResult({_id: [1, 2]}, expr));
    assert.writeError(upsertedResult({_id: undefined}, expr));
    assert.writeError(upsertedResult({_id: {$eq: [1, 2]}}, expr));
    assert.writeError(upsertedResult({_id: {$eq: undefined}}, expr));
    assert.writeError(upsertedResult({_id: {$all: [1, 2]}}, expr));
    // All below fail in v2.6, non-_id fields completely ignored
    assert.writeError(upsertedResult({$and: [{_id: 1}, {_id: 2}]}, expr));
    assert.writeError(upsertedResult({$and: [{_id: {$eq: 1}}, {_id: 2}]}, expr));
    assert.writeError(upsertedResult({_id: 1, "_id.x": 1}, expr));
    assert.writeError(upsertedResult({_id: {x: 1}, "_id.x": 1}, expr));

    // Special case - nested _id fields only used on $op-style updates
    if (isReplStyle) {
        // Fails in v2.6
        assert.writeError(upsertedResult({"_id.x": 1, "_id.y": 2}, expr));
    } else {
        // Fails in v2.6
        assert.docEq({x: 1, y: 2}, upsertedId({"_id.x": 1, "_id.y": 2}, expr));
    }
}

// regex _id in expression is an error, no regex ids allowed
assert.writeError(upsertedResult({}, {_id: /abc/}));
// Fails in v2.6, no validation
assert.writeError(upsertedResult({}, {$set: {_id: /abc/}}));

// no regex _id extraction from query
assert.neq(/abc/, upsertedId({_id: /abc/}, {}));

//
// Regular field extraction
//

// Check things that are pretty much the same for replacement and $op style upserts
for (var i = 0; i < 3; i++) {
    // replacement style
    var expr = {};

    // $op style
    if (i == 1) {
        expr = {$set: {a: 1}};
    }
    if (i == 2) {
        expr = {$setOnInsert: {a: 1}};
    }

    var isReplStyle = i == 0;

    // field extracted when replacement style
    var value = isReplStyle ? undefined : 1;
    assert.eq(value, upsertedXVal({x: 1}, expr));
    assert.eq(value, upsertedXVal({x: {$eq: 1}}, expr));
    assert.eq(value, upsertedXVal({x: {$in: [1]}}, expr));
    assert.eq(value, upsertedXVal({x: {$all: [1]}}, expr));
    assert.eq(value, upsertedXVal({$and: [{x: 1}]}, expr));
    assert.eq(value, upsertedXVal({$and: [{x: {$eq: 1}}]}, expr));
    assert.eq(value, upsertedXVal({$or: [{x: 1}]}, expr));
    assert.eq(value, upsertedXVal({$or: [{x: {$eq: 1}}]}, expr));
    // Special types extracted
    assert.eq(isReplStyle ? undefined : [1, 2], upsertedXVal({x: [1, 2]}, expr));
    assert.eq(isReplStyle ? undefined : {'x.x': 1}, upsertedXVal({x: {'x.x': 1}}, expr));

    // field not extracted
    assert.eq(undefined, upsertedXVal({x: {$gt: 1}}, expr));
    assert.eq(undefined, upsertedXVal({x: {$ne: 1}}, expr));
    assert.eq(undefined, upsertedXVal({x: {$in: [1, 2]}}, expr));
    assert.eq(undefined, upsertedXVal({x: {$elemMatch: {$eq: 1}}}, expr));
    assert.eq(undefined, upsertedXVal({x: {$exists: true}}, expr));
    assert.eq(undefined, upsertedXVal({x: {$not: {$eq: 1}}}, expr));
    assert.eq(undefined, upsertedXVal({$or: [{x: {$eq: 1}}, {x: 2}]}, expr));
    assert.eq(undefined, upsertedXVal({$nor: [{x: 1}]}, expr));
    assert.eq(undefined, upsertedXVal({$nor: [{x: {$eq: 1}}]}, expr));
    assert.eq(undefined, upsertedXVal({$nor: [{x: {$eq: 1}}, {x: 1}]}, expr));

    // field extraction errors
    assert.writeError(upsertedResult({x: undefined}, expr));

    if (!isReplStyle) {
        assert.writeError(upsertedResult({x: {$all: [1, 2]}}, expr));
        assert.writeError(upsertedResult({$and: [{x: 1}, {x: 2}]}, expr));
        assert.writeError(upsertedResult({$and: [{x: {$eq: 1}}, {x: 2}]}, expr));
    } else {
        assert.eq(undefined, upsertedXVal({x: {'x.x': 1}}, expr));
        assert.eq(undefined, upsertedXVal({x: {$all: [1, 2]}}, expr));
        assert.eq(undefined, upsertedXVal({$and: [{x: 1}, {x: 1}]}, expr));
        assert.eq(undefined, upsertedXVal({$and: [{x: {$eq: 1}}, {x: 2}]}, expr));
    }

    // nested field extraction
    var docValue = isReplStyle ? undefined : {x: 1};
    assert.docEq(docValue, upsertedXVal({"x.x": 1}, expr));
    assert.docEq(docValue, upsertedXVal({"x.x": {$eq: 1}}, expr));
    assert.docEq(docValue, upsertedXVal({"x.x": {$all: [1]}}, expr));
    assert.docEq(docValue, upsertedXVal({$and: [{"x.x": 1}]}, expr));
    assert.docEq(docValue, upsertedXVal({$and: [{"x.x": {$eq: 1}}]}, expr));
    assert.docEq(docValue, upsertedXVal({$or: [{"x.x": 1}]}, expr));
    assert.docEq(docValue, upsertedXVal({$or: [{"x.x": {$eq: 1}}]}, expr));

    // nested field conflicts
    if (!isReplStyle) {
        assert.writeError(upsertedResult({x: 1, "x.x": 1}, expr));
        assert.writeError(upsertedResult({x: {}, "x.x": 1}, expr));
        assert.writeError(upsertedResult({x: {x: 1}, "x.x": 1}, expr));
        assert.writeError(upsertedResult({x: {x: 1}, "x.y": 1}, expr));
        assert.writeError(upsertedResult({x: [1, {x: 1}], "x.x": 1}, expr));
    } else {
        assert.eq(undefined, upsertedXVal({x: 1, "x.x": 1}, expr));
        assert.eq(undefined, upsertedXVal({x: {}, "x.x": 1}, expr));
        assert.eq(undefined, upsertedXVal({x: {x: 1}, "x.x": 1}, expr));
        assert.eq(undefined, upsertedXVal({x: {x: 1}, "x.y": 1}, expr));
        assert.eq(undefined, upsertedXVal({x: [1, {x: 1}], "x.x": 1}, expr));
    }
}

// regex field in expression is a value
assert.eq(/abc/, upsertedXVal({}, {x: /abc/}));
assert.eq(/abc/, upsertedXVal({}, {$set: {x: /abc/}}));

// no regex field extraction from query unless $eq'd
assert.eq(/abc/, upsertedXVal({x: {$eq: /abc/}}, {$set: {a: 1}}));
assert.eq(undefined, upsertedXVal({x: /abc/}, {$set: {a: 1}}));

// replacement-style updates ignore conflicts *except* on _id field
assert.eq(1, upsertedId({_id: 1, x: [1, {x: 1}], "x.x": 1}, {}));

// DBRef special cases
// make sure query doesn't error when creating doc for insert, since it's missing the rest of the
// dbref fields. SERVER-14024
// Fails in 2.6.1->3
assert.docEq(DBRef("a", 1), upsertedXVal({"x.$id": 1}, {$set: {x: DBRef("a", 1)}}));

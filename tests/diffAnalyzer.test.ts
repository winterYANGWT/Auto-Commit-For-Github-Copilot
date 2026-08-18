import assert from 'node:assert/strict';
import test from 'node:test';
import { parseDiff, resolveStagingPaths } from '../src/git/diffAnalyzer';

test('rename changes retain both paths needed to stage the deletion and addition', () => {
    const diff = `diff --git a/旧 file.txt b/新 file.txt
similarity index 100%
rename from 旧 file.txt
rename to 新 file.txt
`;

    const changes = parseDiff(diff);

    assert.equal(changes.length, 1);
    assert.equal(changes[0].type, 'renamed');
    assert.equal(changes[0].path, '新 file.txt');
    assert.equal(changes[0].originalPath, '旧 file.txt');
    assert.deepEqual(
        resolveStagingPaths(['新 file.txt'], changes),
        ['旧 file.txt', '新 file.txt']
    );
});

test('non-rename changes keep their existing staging paths', () => {
    const changes = parseDiff(`diff --git a/kept.txt b/kept.txt
index 257cc56..5716ca5 100644
--- a/kept.txt
+++ b/kept.txt
@@ -1 +1 @@
-before
+after
`);

    assert.deepEqual(resolveStagingPaths(['kept.txt'], changes), ['kept.txt']);
});

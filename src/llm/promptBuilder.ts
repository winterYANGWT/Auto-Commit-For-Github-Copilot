import type { FileChange, FileGroup, GenerateOptions, GitLogEntry } from '../types';

/**
 * Builds the combined prompt (instructions + task) for one FileGroup.
 * Sent as a single User message to avoid relying on a System role.
 */
export function buildPrompt(group: FileGroup, options: GenerateOptions, recentCommits?: GitLogEntry[]): string {
    const styleRule = options.conventionalCommits
        ? 'Follow the Conventional Commits specification. ' +
        'Prefix the message with one of: feat, fix, docs, style, refactor, perf, test, chore, ci, build. ' +
        'Optionally add a scope in parentheses, e.g. "feat(auth): ...".'
        : 'Write a clear, imperative-mood sentence without a type prefix.';

    const langRule =
        options.language === 'zh'
            ? 'Write the commit message and reason in Chinese (中文).'
            : 'Write the commit message and reason in English.';

    const fileList = group.files
        .map((f) => `  - ${f.path} (${f.type})`)
        .join('\n');

    const diffs = group.files.map((f) => f.diff).join('\n');

    let prompt = `You are a Git commit message generator.
Analyze the diff below and generate exactly ONE commit message for this group of files.

Rules:
1. ${styleRule}
2. ${langRule}
3. Keep the message under 72 characters.
4. The "reason" must be 1-2 sentences explaining WHY this change was made, not just what changed.
5. Return ONLY a JSON object — no markdown, no explanation, no code fences.
6. Match the style and tone of the recent commit history below for consistency.`;

    if (recentCommits && recentCommits.length > 0) {
        const historyLines = recentCommits
            .map((c) => `  - ${c.message}`)
            .join('\n');
        prompt += `\n\nRecent commit history (for style reference):\n${historyLines}`;
    }

    prompt += `\n\nGroup: ${group.label}\nFiles:\n${fileList}\n\nDiff:\n\`\`\`diff\n${diffs}\n\`\`\`\n\nRequired JSON format:\n{"message":"<commit message>","reason":"<why this change was made>"}`;

    if (options.prompt) {
        prompt += `\n\nAdditional instructions from the user:\n${options.prompt}`;
    }

    return prompt;
}

/**
 * Builds a single prompt that covers ALL file groups at once.
 * The model is asked to return a JSON array with one entry per group,
 * in the same order as the input groups.
 */
export function buildBatchPrompt(groups: FileGroup[], options: GenerateOptions, recentCommits?: GitLogEntry[]): string {
    const styleRule = options.conventionalCommits
        ? 'Follow the Conventional Commits specification. ' +
        'Prefix the message with one of: feat, fix, docs, style, refactor, perf, test, chore, ci, build. ' +
        'Optionally add a scope in parentheses, e.g. "feat(auth): ...".'
        : 'Write a clear, imperative-mood sentence without a type prefix.';

    const langRule =
        options.language === 'zh'
            ? 'Write every commit message and reason in Chinese (中文).'
            : 'Write every commit message and reason in English.';

    let prompt = `You are a Git commit message generator.
Analyze the diffs below and generate ONE commit message per group.

Rules:
1. ${styleRule}
2. ${langRule}
3. Keep each message under 72 characters.
4. Each "reason" must be 1-2 sentences explaining WHY this change was made, not just what changed.
5. Return ONLY a JSON array — no markdown, no explanation, no code fences.
6. The array must have exactly ${groups.length} element(s), one per group, in the same order as listed below.
7. Match the style and tone of the recent commit history below for consistency.`;

    if (recentCommits && recentCommits.length > 0) {
        const historyLines = recentCommits
            .map((c) => `  - ${c.message}`)
            .join('\n');
        prompt += `\n\nRecent commit history (for style reference):\n${historyLines}`;
    }

    for (const group of groups) {
        const fileList = group.files.map((f) => `  - ${f.path} (${f.type})`).join('\n');
        const diffs = group.files.map((f) => f.diff).join('\n');
        prompt += `\n\n---\nGroup: ${group.label}\nFiles:\n${fileList}\n\nDiff:\n\`\`\`diff\n${diffs}\n\`\`\``;
    }

    prompt += `\n\nRequired JSON format (array of ${groups.length} object(s)):\n[{"message":"<commit message>","reason":"<why>"},...]`;

    if (options.prompt) {
        prompt += `\n\nAdditional instructions from the user:\n${options.prompt}`;
    }

    return prompt;
}

/**
 * Builds a single prompt that asks the LLM to BOTH group the changed files
 * by logical/functional cohesion AND produce one commit message per group.
 *
 * The model receives every file's path, change-type and diff at once so it
 * can reason about cross-file relationships (e.g. a feature that touches
 * source + test + docs together).
 *
 * The model must return a JSON array, one object per group, where:
 *   - `message`  is the commit subject
 *   - `reason`   explains WHY (1-2 sentences)
 *   - `files`    lists the EXACT relative paths from the input set
 *
 * Every input file MUST appear in exactly one group.
 */
export function buildGroupingPrompt(
    changes: FileChange[],
    options: GenerateOptions,
    recentCommits?: GitLogEntry[]
): string {
    const styleRule = options.conventionalCommits
        ? 'Follow the Conventional Commits specification. ' +
        'Prefix the message with one of: feat, fix, docs, style, refactor, perf, test, chore, ci, build. ' +
        'Optionally add a scope in parentheses, e.g. "feat(auth): ...".'
        : 'Write a clear, imperative-mood sentence without a type prefix.';

    const langRule =
        options.language === 'zh'
            ? 'Write every commit message and reason in Chinese (中文).'
            : 'Write every commit message and reason in English.';

    let prompt = `You are an expert Git commit assistant.
You will receive a set of staged file changes. Your job has TWO parts:

PART A — GROUPING (ONE FEATURE / INTENT PER COMMIT)
  The GOLDEN RULE: each commit must represent EXACTLY ONE feature, fix,
  refactor, or chore — never two. When in doubt, SPLIT rather than merge.

  Two files belong to the SAME group ONLY when they jointly implement that
  one single intent. Typical valid groupings:
    • a feature's source file + its own new/updated tests
    • a refactor that mechanically touches several files of the same module
    • a rename that propagates across a few call-sites

  You MUST split into separate groups whenever any of these apply:
    • the changes implement two different features / bug fixes
    • a feature change is mixed with an unrelated refactor or cleanup
    • source-code changes are mixed with unrelated docs / config / deps bumps
    • two independent bug fixes touch the same area
    • formatting-only changes are mixed with behavioural changes
    • dependency bumps are mixed with feature work
  Files that share a directory but serve different intents MUST go to
  different groups. Do NOT group by directory or file extension — group
  STRICTLY by single shared intent.

  Do not artificially minimise the number of groups. Producing more, smaller
  commits is STRONGLY preferred over a single mixed commit.

PART B — COMMIT MESSAGES
  For each group, produce a commit message and a short reason. Because each
  group represents exactly one intent, the message must describe that ONE
  intent — no "and", no "&", no comma-separated lists of unrelated changes.

Hard rules:
1. ${styleRule}
2. ${langRule}
3. Keep each "message" under 72 characters.
4. Each "reason" must be 1-2 sentences explaining WHY (not just what).
5. The "message" MUST describe a single intent. Reject phrasing like
   "add X and fix Y", "feat: A, B", "update X and refactor Y" — split instead.
6. Every input file MUST appear in EXACTLY ONE group — no duplicates, no omissions.
7. Use the EXACT file paths shown below (case-sensitive, no leading "./" or "a/").
8. Return ONLY a JSON array — no markdown, no explanation, no code fences.
9. Match the style and tone of the recent commit history below for consistency.`;

    if (recentCommits && recentCommits.length > 0) {
        const historyLines = recentCommits.map((c) => `  - ${c.message}`).join('\n');
        prompt += `\n\nRecent commit history (for style reference):\n${historyLines}`;
    }

    prompt += `\n\nStaged files (${changes.length} total):`;
    for (const change of changes) {
        prompt += `\n\n--- FILE: ${change.path} (${change.type}) ---\n\`\`\`diff\n${change.diff}\n\`\`\``;
    }

    prompt += `\n\nRequired JSON format:
[
  {"message":"<commit message>","reason":"<why>","files":["<path1>","<path2>"]},
  ...
]`;

    if (options.prompt) {
        prompt += `\n\nAdditional instructions from the user:\n${options.prompt}`;
    }

    return prompt;
}

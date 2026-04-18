import type { FileGroup, GenerateOptions, GitLogEntry } from '../types';

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

import * as vscode from 'vscode';
import type { CommitCandidate, FileChange, FileGroup, GenerateOptions, GitLogEntry } from '../types';
import { buildBatchPrompt, buildGroupingPrompt, buildPrompt } from './promptBuilder';

let _modelCache: vscode.LanguageModelChat | undefined;
let _cachedModelId: string | undefined;

/** Returns all available language models with human-readable names. */
export async function getAvailableModels(): Promise<Array<{ id: string; name: string }>> {
    // Fetch ALL models — not just copilot vendor — so the user sees
    // the same full list they get in Copilot Chat (Claude, Gemini, etc.)
    const models = await vscode.lm.selectChatModels();
    return models.map((m) => ({ id: m.id, name: m.name || m.id }));
}

/** Returns the best available Copilot model, caching the result. */
async function getModel(preferredModelId?: string): Promise<vscode.LanguageModelChat> {
    // Return cache only if the preferred model hasn't changed
    if (_modelCache && _cachedModelId === (preferredModelId ?? '')) {
        return _modelCache;
    }

    let models: vscode.LanguageModelChat[] = [];

    if (preferredModelId) {
        models = await vscode.lm.selectChatModels({ id: preferredModelId });
    }

    if (models.length === 0) {
        // Prefer gpt-4o; fall back to any available model
        models = await vscode.lm.selectChatModels({ vendor: 'copilot', family: 'gpt-4o' });
    }
    if (models.length === 0) {
        models = await vscode.lm.selectChatModels({ vendor: 'copilot' });
    }
    if (models.length === 0) {
        models = await vscode.lm.selectChatModels();
    }
    if (models.length === 0) {
        throw new Error(
            'No GitHub Copilot language model found. ' +
            'Please ensure GitHub Copilot is installed and you are signed in.'
        );
    }

    _modelCache = models[0];
    _cachedModelId = preferredModelId ?? '';
    return _modelCache;
}

/** Clears the cached model (e.g. on extension deactivation). */
export function clearModelCache(): void {
    _modelCache = undefined;
    _cachedModelId = undefined;
}

/**
 * Calls the Copilot LM API for a single FileGroup and returns a CommitCandidate.
 * Throws if the model is unavailable or the response cannot be parsed.
 */
export async function generateForGroup(
    group: FileGroup,
    options: GenerateOptions,
    token: vscode.CancellationToken,
    recentCommits?: GitLogEntry[]
): Promise<CommitCandidate> {
    const model = await getModel(options.model);
    const prompt = buildPrompt(group, options, recentCommits);

    const messages = [vscode.LanguageModelChatMessage.User(prompt)];
    const response = await model.sendRequest(messages, {}, token);

    let raw = '';
    for await (const chunk of response.text) {
        if (token.isCancellationRequested) {
            throw new vscode.CancellationError();
        }
        raw += chunk;
    }

    const parsed = parseResponse(raw);

    return {
        id: generateId(),
        message: parsed.message.trim(),
        reason: parsed.reason.trim(),
        files: group.files.map((f) => f.path),
        checked: true,
    };
}

/**
 * Sends ALL file groups in a single LLM request and returns one CommitCandidate per group.
 * More token-efficient than calling generateForGroup N times because the system instructions
 * are only sent once.
 */
export async function generateForAllGroups(
    groups: FileGroup[],
    options: GenerateOptions,
    token: vscode.CancellationToken,
    recentCommits?: GitLogEntry[]
): Promise<CommitCandidate[]> {
    if (groups.length === 0) {
        return [];
    }

    const model = await getModel(options.model);
    const prompt = buildBatchPrompt(groups, options, recentCommits);

    const messages = [vscode.LanguageModelChatMessage.User(prompt)];
    const response = await model.sendRequest(messages, {}, token);

    let raw = '';
    for await (const chunk of response.text) {
        if (token.isCancellationRequested) {
            throw new vscode.CancellationError();
        }
        raw += chunk;
    }

    const items = parseArrayResponse(raw, groups.length);

    return groups.map((group, i) => ({
        id: generateId(),
        message: items[i].message.trim(),
        reason: items[i].reason.trim(),
        files: group.files.map((f) => f.path),
        checked: true,
    }));
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseArrayResponse(raw: string, expectedCount: number): Array<{ message: string; reason: string }> {
    const cleaned = raw
        .replace(/^```(?:json)?\s*/m, '')
        .replace(/\s*```\s*$/m, '')
        .trim();

    const tryParseArray = (text: string) => {
        const arr = JSON.parse(text) as unknown;
        if (!Array.isArray(arr) || arr.length !== expectedCount) {
            return null;
        }
        for (const item of arr) {
            if (
                !item ||
                typeof item !== 'object' ||
                typeof (item as Record<string, unknown>).message !== 'string' ||
                typeof (item as Record<string, unknown>).reason !== 'string'
            ) {
                return null;
            }
        }
        return arr as Array<{ message: string; reason: string }>;
    };

    try {
        const result = tryParseArray(cleaned);
        if (result) {
            return result;
        }
    } catch {
        // fall through
    }

    // Try to extract a JSON array from somewhere in the response
    const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
        try {
            const result = tryParseArray(arrayMatch[0]);
            if (result) {
                return result;
            }
        } catch {
            // fall through
        }
    }

    throw new Error(`Could not parse batch LLM response (expected array of ${expectedCount}): ${raw.slice(0, 300)}`);
}

function parseResponse(raw: string): { message: string; reason: string } {
    // Strip markdown code fences if the model added them anyway
    const cleaned = raw
        .replace(/^```(?:json)?\s*/m, '')
        .replace(/\s*```\s*$/m, '')
        .trim();

    const tryParse = (text: string) => {
        const obj = JSON.parse(text) as unknown;
        if (
            obj &&
            typeof obj === 'object' &&
            'message' in obj &&
            'reason' in obj &&
            typeof (obj as Record<string, unknown>).message === 'string' &&
            typeof (obj as Record<string, unknown>).reason === 'string'
        ) {
            return obj as { message: string; reason: string };
        }
        return null;
    };

    // Direct parse
    try {
        const result = tryParse(cleaned);
        if (result) {
            return result;
        }
    } catch {
        // fall through
    }

    // Try to extract a JSON object from somewhere in the response
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
        try {
            const result = tryParse(jsonMatch[0]);
            if (result) {
                return result;
            }
        } catch {
            // fall through
        }
    }

    throw new Error(`Could not parse LLM response: ${raw.slice(0, 300)}`);
}

function generateId(): string {
    return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

// ─── AI-driven grouping + generation (single LLM call) ───────────────────────

/**
 * Sends ALL staged changes to the LLM in a single request and lets the model
 * decide both HOW to group the files AND what commit message each group gets.
 *
 * Returns one CommitCandidate per AI-determined group. Every input file is
 * guaranteed to appear in exactly one returned candidate; if the model omits
 * or duplicates files, an Error is thrown so the caller can fall back to the
 * rule-based grouping path.
 */
export async function generateGroupedCommits(
    changes: FileChange[],
    options: GenerateOptions,
    token: vscode.CancellationToken,
    recentCommits?: GitLogEntry[]
): Promise<CommitCandidate[]> {
    if (changes.length === 0) {
        return [];
    }

    const model = await getModel(options.model);
    const prompt = buildGroupingPrompt(changes, options, recentCommits);

    const messages = [vscode.LanguageModelChatMessage.User(prompt)];
    const response = await model.sendRequest(messages, {}, token);

    let raw = '';
    for await (const chunk of response.text) {
        if (token.isCancellationRequested) {
            throw new vscode.CancellationError();
        }
        raw += chunk;
    }

    const items = parseGroupingResponse(raw);
    const validated = validateGrouping(items, changes);

    return validated.map((g) => ({
        id: generateId(),
        message: g.message.trim(),
        reason: g.reason.trim(),
        files: g.files,
        checked: true,
    }));
}

interface ParsedGroup { message: string; reason: string; files: string[]; }

function parseGroupingResponse(raw: string): ParsedGroup[] {
    const cleaned = raw
        .replace(/^```(?:json)?\s*/m, '')
        .replace(/\s*```\s*$/m, '')
        .trim();

    const tryParse = (text: string): ParsedGroup[] | null => {
        const arr = JSON.parse(text) as unknown;
        if (!Array.isArray(arr) || arr.length === 0) {
            return null;
        }
        const out: ParsedGroup[] = [];
        for (const item of arr) {
            if (!item || typeof item !== 'object') { return null; }
            const rec = item as Record<string, unknown>;
            if (
                typeof rec.message !== 'string' ||
                typeof rec.reason !== 'string' ||
                !Array.isArray(rec.files) ||
                rec.files.length === 0 ||
                !rec.files.every((f) => typeof f === 'string')
            ) {
                return null;
            }
            out.push({
                message: rec.message,
                reason: rec.reason,
                files: rec.files as string[],
            });
        }
        return out;
    };

    try {
        const result = tryParse(cleaned);
        if (result) { return result; }
    } catch { /* fall through */ }

    const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
        try {
            const result = tryParse(arrayMatch[0]);
            if (result) { return result; }
        } catch { /* fall through */ }
    }

    throw new Error(`Could not parse grouping LLM response: ${raw.slice(0, 300)}`);
}

/**
 * Ensures every input file is referenced exactly once across all groups.
 * Returns the groups with file paths normalised to the original input casing/order.
 */
function validateGrouping(groups: ParsedGroup[], changes: FileChange[]): ParsedGroup[] {
    const validPaths = new Set(changes.map((c) => c.path));
    const seen = new Set<string>();

    for (const g of groups) {
        const normalised: string[] = [];
        for (const f of g.files) {
            if (!validPaths.has(f)) {
                throw new Error(`LLM returned unknown file path in group: ${f}`);
            }
            if (seen.has(f)) {
                throw new Error(`LLM assigned the same file to multiple groups: ${f}`);
            }
            seen.add(f);
            normalised.push(f);
        }
        g.files = normalised;
    }

    if (seen.size !== validPaths.size) {
        const missing: string[] = [];
        for (const p of validPaths) {
            if (!seen.has(p)) { missing.push(p); }
        }
        throw new Error(`LLM did not assign every file to a group. Missing: ${missing.join(', ')}`);
    }

    return groups;
}

// Re-export for callers that still need the rule-based FileGroup shape.
export type { FileGroup };

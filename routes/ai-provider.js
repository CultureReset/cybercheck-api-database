// ─── Universal AI Provider Abstraction ───────────────────────────────────────
// Swap providers by setting AI_PROVIDER env var: 'anthropic', 'xai', 'openai'
// Falls back automatically based on which API keys are present.
// All endpoints share this — change the env var once, everything follows.

const supabase = require('../db');

async function uploadImageToStorage(base64, mime) {
    try {
        const fileName = `temp-vision-${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${mime.split('/')[1] || 'jpg'}`;
        const buffer = Buffer.from(base64, 'base64');
        const { data, error } = await supabase.storage
            .from('vision-temp')
            .upload(fileName, buffer, { contentType: mime, cacheControl: '3600' });

        if (error) throw error;

        const { data: { publicUrl } } = supabase.storage
            .from('vision-temp')
            .getPublicUrl(fileName);

        return publicUrl;
    } catch (e) {
        console.warn('Supabase upload failed, falling back to data URL:', e.message);
        return null;
    }
}

function getProvider(override) {
    if (override) return override;
    if (process.env.AI_PROVIDER) return process.env.AI_PROVIDER;
    // Vision-first order: Gemini > xAI > OpenAI > Anthropic
    // (Anthropic last — haiku struggles with complex multi-column menus)
    if (process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_KEY) return 'gemini';
    if (process.env.XAI_API_KEY || process.env.GROK_API_KEY) return 'xai';
    if (process.env.OPENAI_API_KEY) return 'openai';
    if (process.env.ANTHROPIC_API_KEY) return 'anthropic';
    throw new Error('No AI provider configured. Set AI_PROVIDER env var and the matching API key.');
}

function getProviderInfo() {
    try {
        const provider = getProvider();
        const models = {
            anthropic: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6',
            xai:       process.env.XAI_MODEL       || 'grok-3',
            openai:    process.env.OPENAI_MODEL     || 'gpt-4o',
            gemini:    process.env.GEMINI_MODEL    || 'gemini-2.5-flash',
        };
        return { provider, model: models[provider] || 'unknown', configured: true };
    } catch {
        return { provider: null, model: null, configured: false };
    }
}

// Returns per-provider configuration status for UI dropdowns.
// Never throws — missing keys just mean that provider shows as unavailable.
function getVisionProvidersStatus() {
    return {
        default: (() => { try { return getProvider(); } catch { return null; } })(),
        providers: [
            { id: 'gemini',    label: 'Gemini 2.5 Flash',   configured: !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_KEY), defaultModel: process.env.GEMINI_MODEL || 'gemini-2.5-flash' },
            { id: 'xai',       label: 'Grok 2 Vision',      configured: !!(process.env.XAI_API_KEY || process.env.GROK_API_KEY),     defaultModel: process.env.XAI_VISION_MODEL || 'grok-2-vision-1212' },
            { id: 'openai',    label: 'OpenAI GPT-4o mini', configured: !!process.env.OPENAI_API_KEY,                                defaultModel: process.env.OPENAI_VISION_MODEL || 'gpt-4o-mini' },
            { id: 'anthropic', label: 'Claude Sonnet',      configured: !!process.env.ANTHROPIC_API_KEY,                             defaultModel: process.env.ANTHROPIC_VISION_MODEL || 'claude-sonnet-4-6' },
        ],
    };
}

// Extract and parse JSON from anywhere in the AI response text.
// Handles: pure JSON, markdown fences at start/end, fences embedded in explanation text.
function parseJsonLoose(text) {
    if (!text) throw new Error('Empty AI response');
    const s = String(text).trim();

    // 1. Try raw parse first (pure JSON response)
    try { return JSON.parse(s); } catch {}

    // 2. Extract from ```json ... ``` or ``` ... ``` anywhere in the text
    const fenceMatch = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenceMatch) {
        try { return JSON.parse(fenceMatch[1].trim()); } catch {}
    }

    // 3. Find outermost { ... } block
    const start = s.indexOf('{'), end = s.lastIndexOf('}');
    if (start >= 0 && end > start) {
        try { return JSON.parse(s.slice(start, end + 1)); } catch {}
    }

    // 4. Find outermost [ ... ] block
    const aStart = s.indexOf('['), aEnd = s.lastIndexOf(']');
    if (aStart >= 0 && aEnd > aStart) {
        try { return JSON.parse(s.slice(aStart, aEnd + 1)); } catch {}
    }

    throw new Error('AI returned non-JSON: ' + s.slice(0, 200));
}

// Normalize "data:image/jpeg;base64,xxx" → { mimeType, base64 }
function normalizeImageInput({ imageBase64, mimeType }) {
    if (!imageBase64) throw new Error('imageBase64 required');
    let b64 = String(imageBase64), mime = mimeType || 'image/jpeg';
    const m = b64.match(/^data:([^;]+);base64,(.+)$/);
    if (m) { mime = m[1]; b64 = m[2]; }
    return { mimeType: mime, base64: b64 };
}

// ─── Vision extraction — returns parsed JSON ─────────────────────────────────
// Unified image→JSON extraction across all providers.
// Auto-fallback: if `fallback: true` and primary fails, retries the next
// configured provider in preferred order.
async function extractJsonFromImage({
    imageBase64, mimeType,
    systemPrompt = 'Return ONLY valid JSON — no markdown, no explanation.',
    userPrompt,
    provider: providerOverride,
    model,
    temperature = 0.1,
    maxTokens = 4000,
    fallback = true,
}) {
    const { mimeType: mime, base64 } = normalizeImageInput({ imageBase64, mimeType });
    const primary = getProvider(providerOverride);

    const preferredOrder = ['gemini', 'xai', 'openai', 'anthropic', 'ollama'];
    const tryOrder = fallback
        ? [primary, ...preferredOrder.filter(p => p !== primary)]
        : [primary];

    let lastErr;
    for (const p of tryOrder) {
        try {
            // Only pass caller-specified model to the primary provider.
            // Fallback providers use their own defaults so a Claude model name
            // doesn't bleed into an OpenAI call, etc.
            const providerModel = (p === primary) ? model : undefined;
            const json = await _callVision(p, { base64, mime, systemPrompt, userPrompt, model: providerModel, temperature, maxTokens });
            return { result: json, provider: p };
        } catch (e) {
            lastErr = e;
            if (String(e.message || '').startsWith('AI returned non-JSON')) break;
        }
    }
    throw lastErr || new Error('All vision providers failed');
}

async function _callVision(provider, { base64, mime, systemPrompt, userPrompt, model, temperature, maxTokens }) {
    // ── Gemini ────────────────────────────────────────────────────────────────
    if (provider === 'gemini') {
        const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_KEY;
        if (!apiKey) throw new Error('GEMINI_API_KEY not set');
        const resolvedModel = model || process.env.GEMINI_MODEL || 'gemini-2.5-flash';
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(resolvedModel)}:generateContent?key=${apiKey}`;
        const resp = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                system_instruction: { parts: [{ text: systemPrompt }] },
                contents: [{ role: 'user', parts: [
                    { inline_data: { mime_type: mime, data: base64 } },
                    { text: userPrompt },
                ]}],
                generationConfig: {
                    temperature, maxOutputTokens: maxTokens,
                    responseMimeType: 'application/json',
                },
            }),
        });
        if (!resp.ok) throw new Error(`Gemini ${resp.status}: ${await resp.text()}`);
        const data = await resp.json();
        const text = data.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
        return parseJsonLoose(text);
    }

    // ── Anthropic ─────────────────────────────────────────────────────────────
    if (provider === 'anthropic') {
        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');
        const resolvedModel = model || process.env.ANTHROPIC_VISION_MODEL || 'claude-sonnet-4-6';
        const resp = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
            body: JSON.stringify({
                model: resolvedModel, max_tokens: maxTokens, temperature,
                system: systemPrompt,
                messages: [
                    { role: 'user', content: [
                        { type: 'image', source: { type: 'base64', media_type: mime, data: base64 } },
                        { type: 'text', text: userPrompt },
                    ]},
                    // Pre-fill assistant turn — forces Claude to continue from '{' so it
                    // cannot add any explanation before the JSON.
                    { role: 'assistant', content: '{' },
                ],
            }),
        });
        if (!resp.ok) throw new Error(`Anthropic ${resp.status}: ${await resp.text()}`);
        const data = await resp.json();
        if (data.error) throw new Error(`Anthropic: ${data.error.message}`);
        const text = '{' + (data.content || []).filter(c => c.type === 'text').map(c => c.text).join('');
        return parseJsonLoose(text);
    }

    // ── xAI (Grok) + OpenAI — both use OpenAI-compatible chat/completions ─────
    if (provider === 'xai' || provider === 'grok' || provider === 'openai') {
        const isXai = (provider === 'xai' || provider === 'grok');
        const apiKey = isXai
            ? (process.env.XAI_API_KEY || process.env.GROK_API_KEY)
            : process.env.OPENAI_API_KEY;
        if (!apiKey) throw new Error(`${isXai ? 'XAI' : 'OPENAI'}_API_KEY not set`);
        const endpoint = isXai ? 'https://api.x.ai/v1/chat/completions' : 'https://api.openai.com/v1/chat/completions';
        const resolvedModel = model || (isXai
            ? (process.env.XAI_VISION_MODEL || 'grok-2-vision-1212')
            : (process.env.OPENAI_VISION_MODEL || 'gpt-4o'));

        // Upload to Supabase Storage for xAI/OpenAI (they don't accept data URLs)
        let imageUrl = `data:${mime};base64,${base64}`;
        const storageUrl = await uploadImageToStorage(base64, mime);
        if (storageUrl) imageUrl = storageUrl;

        const resp = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: resolvedModel, temperature, max_tokens: maxTokens,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: [
                        { type: 'image_url', image_url: { url: imageUrl } },
                        { type: 'text', text: userPrompt },
                    ]},
                ],
            }),
        });
        if (!resp.ok) throw new Error(`${isXai ? 'xAI' : 'OpenAI'} ${resp.status}: ${await resp.text()}`);
        const data = await resp.json();
        const text = data.choices?.[0]?.message?.content || '';
        return parseJsonLoose(text);
    }

    // ── Ollama (local open-source vision: llava, minicpm-v, qwen2-vl, etc.) ──
    if (provider === 'ollama') {
        const baseUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
        const resolvedModel = model || process.env.OLLAMA_VISION_MODEL || 'minicpm-v';
        const resp = await fetch(`${baseUrl}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: resolvedModel,
                stream: false,
                format: 'json',
                options: { temperature, num_predict: maxTokens },
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt, images: [base64] },
                ],
            }),
        });
        if (!resp.ok) throw new Error(`Ollama ${resp.status}: ${await resp.text()}`);
        const data = await resp.json();
        const text = data.message?.content || '';
        return parseJsonLoose(text);
    }

    throw new Error(`Unknown vision provider: "${provider}"`);
}

// Convert xAI/OpenAI-format tool definitions to Anthropic's input_schema format
function toAnthropicTools(tools) {
    return tools.map(t => ({
        name: t.function.name,
        description: t.function.description,
        input_schema: (t.function.parameters && Object.keys(t.function.parameters).length)
            ? t.function.parameters
            : { type: 'object', properties: {} },
    }));
}

// One round of the agent loop. Returns:
//   { text, tool_calls: [{id, name, arguments}], done, assistantMsg, makeToolResultMsgs }
async function callAIRound({ messages, tools = [], systemPrompt = '', provider: providerOverride, model, temperature = 0.3, maxTokens = 2000 }) {
    const provider = getProvider(providerOverride);

    // ── Anthropic (Claude) ────────────────────────────────────────────────────
    if (provider === 'anthropic') {
        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');
        const resolvedModel = model || process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';

        const body = {
            model: resolvedModel,
            max_tokens: maxTokens,
            temperature,
            messages,
            ...(systemPrompt && { system: systemPrompt }),
            ...(tools.length && { tools: toAnthropicTools(tools) }),
        };

        const resp = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
            body: JSON.stringify(body),
        });
        const data = await resp.json();
        if (data.error) throw new Error(`Anthropic: ${data.error.message}`);

        const textContent = (data.content || []).filter(c => c.type === 'text').map(c => c.text).join('');
        const toolUseBlocks = (data.content || []).filter(c => c.type === 'tool_use');
        const toolCalls = toolUseBlocks.map(c => ({ id: c.id, name: c.name, arguments: c.input }));
        const done = data.stop_reason !== 'tool_use' || toolCalls.length === 0;

        const assistantMsg = { role: 'assistant', content: data.content || [{ type: 'text', text: textContent }] };

        const makeToolResultMsgs = (results) => [{
            role: 'user',
            content: results.map(r => ({
                type: 'tool_result',
                tool_use_id: r.id,
                content: typeof r.output === 'string' ? r.output : JSON.stringify(r.output),
            })),
        }];

        return { text: textContent, tool_calls: toolCalls, done, assistantMsg, makeToolResultMsgs, provider };
    }

    // ── xAI (Grok) ────────────────────────────────────────────────────────────
    if (provider === 'xai' || provider === 'grok') {
        const apiKey = process.env.XAI_API_KEY || process.env.GROK_API_KEY;
        if (!apiKey) throw new Error('XAI_API_KEY not set');
        const resolvedModel = model || process.env.XAI_MODEL || 'grok-3';

        const resp = await fetch('https://api.x.ai/v1/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: resolvedModel,
                messages: [{ role: 'system', content: systemPrompt }, ...messages],
                ...(tools.length && { tools, tool_choice: 'auto' }),
                temperature,
                max_tokens: maxTokens,
            }),
        });
        if (!resp.ok) throw new Error(`xAI ${resp.status}: ${await resp.text()}`);
        const data = await resp.json();
        const choice = data.choices?.[0];
        if (!choice) throw new Error('No response from xAI');

        const toolCalls = (choice.message.tool_calls || []).map(c => ({
            id: c.id, name: c.function.name,
            arguments: JSON.parse(c.function.arguments || '{}'),
        }));
        const done = toolCalls.length === 0;
        const assistantMsg = choice.message;

        const makeToolResultMsgs = (results) => results.map(r => ({
            role: 'tool', tool_call_id: r.id,
            content: typeof r.output === 'string' ? r.output : JSON.stringify(r.output),
        }));

        return { text: choice.message.content || '', tool_calls: toolCalls, done, assistantMsg, makeToolResultMsgs, provider };
    }

    // ── OpenAI (GPT) ─────────────────────────────────────────────────────────
    if (provider === 'openai') {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) throw new Error('OPENAI_API_KEY not set');
        const resolvedModel = model || process.env.OPENAI_MODEL || 'gpt-4o';

        const resp = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: resolvedModel,
                messages: [{ role: 'system', content: systemPrompt }, ...messages],
                ...(tools.length && { tools, tool_choice: 'auto' }),
                temperature,
                max_tokens: maxTokens,
            }),
        });
        if (!resp.ok) throw new Error(`OpenAI ${resp.status}: ${await resp.text()}`);
        const data = await resp.json();
        const choice = data.choices?.[0];
        if (!choice) throw new Error('No response from OpenAI');

        const toolCalls = (choice.message.tool_calls || []).map(c => ({
            id: c.id, name: c.function.name,
            arguments: JSON.parse(c.function.arguments || '{}'),
        }));
        const done = toolCalls.length === 0;
        const assistantMsg = choice.message;

        const makeToolResultMsgs = (results) => results.map(r => ({
            role: 'tool', tool_call_id: r.id,
            content: typeof r.output === 'string' ? r.output : JSON.stringify(r.output),
        }));

        return { text: choice.message.content || '', tool_calls: toolCalls, done, assistantMsg, makeToolResultMsgs, provider };
    }

    // ── Gemini ────────────────────────────────────────────────────────────────
    if (provider === 'gemini') {
        const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_KEY;
        if (!apiKey) throw new Error('GEMINI_API_KEY not set');
        const resolvedModel = model || process.env.GEMINI_MODEL || 'gemini-2.5-flash';
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(resolvedModel)}:generateContent?key=${apiKey}`;

        // Convert messages to Gemini format (user/model alternating)
        const contents = messages.map(m => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) }],
        }));

        const body = {
            system_instruction: systemPrompt ? { parts: [{ text: systemPrompt }] } : undefined,
            contents,
            generationConfig: { temperature, maxOutputTokens: maxTokens },
        };

        // Add Google Search grounding if requested via tools
        const wantsSearch = tools.some(t => t.name === 'google_search' || t.type === 'google_search');
        if (wantsSearch) body.tools = [{ google_search: {} }];

        const resp = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        if (!resp.ok) throw new Error(`Gemini ${resp.status}: ${await resp.text()}`);
        const data = await resp.json();
        const text = (data.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('');
        return { text, tool_calls: [], done: true, assistantMsg: { role: 'assistant', content: text }, makeToolResultMsgs: () => [], provider };
    }

    throw new Error(`Unknown AI provider: "${provider}". Valid options: anthropic, gemini, xai, openai`);
}

// Full agentic loop — calls tools automatically until the AI is done
async function runAgentLoop({ systemPrompt, messages, tools, executeTool, provider, model, temperature, maxTokens, maxRounds = 6 }) {
    const toolsActivity = [];
    const workingMessages = [...messages];

    for (let round = 0; round < maxRounds; round++) {
        const result = await callAIRound({ messages: workingMessages, tools, systemPrompt, provider, model, temperature, maxTokens });

        if (result.done) {
            return { reply: result.text, tools_called: toolsActivity, provider: result.provider };
        }

        workingMessages.push(result.assistantMsg);

        const toolOutputs = await Promise.all(result.tool_calls.map(async (call) => {
            toolsActivity.push({ tool: call.name, args: call.arguments });
            const output = await executeTool(call.name, call.arguments);
            return { id: call.id, name: call.name, output };
        }));

        const toolResultMsgs = result.makeToolResultMsgs(toolOutputs);
        workingMessages.push(...toolResultMsgs);
    }

    return { reply: 'Reached max tool call rounds. Try a more specific question.', tools_called: toolsActivity };
}

module.exports = { callAIRound, runAgentLoop, getProvider, getProviderInfo, getVisionProvidersStatus, extractJsonFromImage };

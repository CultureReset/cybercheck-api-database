// ─── Universal AI Provider Abstraction ───────────────────────────────────────
// Swap providers by setting AI_PROVIDER env var: 'anthropic', 'xai', 'openai'
// Falls back automatically based on which API keys are present.
// All endpoints share this — change the env var once, everything follows.

function getProvider(override) {
    if (override) return override;
    if (process.env.AI_PROVIDER) return process.env.AI_PROVIDER;
    if (process.env.ANTHROPIC_API_KEY) return 'anthropic';
    if (process.env.XAI_API_KEY || process.env.GROK_API_KEY) return 'xai';
    if (process.env.OPENAI_API_KEY) return 'openai';
    throw new Error('No AI provider configured. Set AI_PROVIDER env var and the matching API key.');
}

function getProviderInfo() {
    try {
        const provider = getProvider();
        const models = {
            anthropic: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6',
            xai:       process.env.XAI_MODEL       || 'grok-3',
            openai:    process.env.OPENAI_MODEL     || 'gpt-4o',
        };
        return { provider, model: models[provider] || 'unknown', configured: true };
    } catch {
        return { provider: null, model: null, configured: false };
    }
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

    throw new Error(`Unknown AI provider: "${provider}". Valid options: anthropic, xai, openai`);
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

module.exports = { callAIRound, runAgentLoop, getProvider, getProviderInfo };

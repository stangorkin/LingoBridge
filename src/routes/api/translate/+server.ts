import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getStyleById } from '$lib/styles';

const MAX_INPUT_LENGTH = 2000;

const CORS_HEADERS = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'POST, OPTIONS',
	'Access-Control-Allow-Headers': 'Content-Type'
};

export const OPTIONS: RequestHandler = async () => {
	return new Response(null, { status: 204, headers: CORS_HEADERS });
};

const MODELS = {
	balanced: '@cf/meta/llama-3.1-8b-instruct',
	creative: '@cf/mistralai/mistral-small-3.1-24b-instruct',
	quality: '@cf/meta/llama-3.3-70b-instruct-fp8-fast'
} as const;

type ModelPreference = keyof typeof MODELS;

type TranslationResult = {
	translation: string;
	usedModel: ModelPreference;
	warning?: string;
};

function sanitizeModelOutput(output: string): string {
	// Remove common wrapper phrases while keeping the translated content.
	return output
		.replace(/^\s*(Here(?:'s| is) (?:the )?translation:?|Translation:)\s*/i, '')
		.replace(/^\s*"([\s\S]*)"\s*$/, '$1')
		.trim();
}

function extractCriticalTokens(input: string): string[] {
	const patterns = [
		/https?:\/\/\S+/g,
		/[\w.%+-]+@[\w.-]+\.[A-Za-z]{2,}/g,
		/\b\d+(?:[.,:]\d+)?%?\b/g,
		/\$\d+(?:[.,]\d+)?/g,
		/\b[A-Z]{2,}\b/g
	];

	const tokens = new Set<string>();
	for (const pattern of patterns) {
		for (const match of input.match(pattern) ?? []) {
			tokens.add(match);
		}
	}

	return [...tokens];
}

function hasMeaningDrift(source: string, transformed: string): boolean {
	const criticalTokens = extractCriticalTokens(source);
	if (criticalTokens.length === 0) return false;

	const lowerOutput = transformed.toLowerCase();
	const missingCount = criticalTokens.filter((token) => !lowerOutput.includes(token.toLowerCase())).length;

	return missingCount > 0;
}

function buildMessages(
	systemPrompt: string,
	guardrailPrompt: string,
	userText: string,
	examples: Array<{ input: string; output: string }>
) {
	const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
		{
			role: 'system',
			content:
				`${systemPrompt}\n\n` +
				`${guardrailPrompt}\n` +
				'Hard constraints: Preserve original meaning exactly. Keep names, dates, numbers, URLs, and key facts unchanged unless style requires grammar normalization. Output transformed text only, with no preface or explanation.'
		}
	];

	for (const example of examples) {
		messages.push({ role: 'user', content: example.input });
		messages.push({ role: 'assistant', content: example.output });
	}

	messages.push({ role: 'user', content: userText });
	return messages;
}

export const POST: RequestHandler = async ({ request, platform }) => {
	const { text, styleId, direction, modelPreference, customStyleDescription } = await request.json();

	if (!text || typeof text !== 'string' || text.trim().length === 0) {
		return json({ error: 'Text is required' }, { status: 400, headers: CORS_HEADERS });
	}

	if (text.length > MAX_INPUT_LENGTH) {
		return json({ error: `Text must be under ${MAX_INPUT_LENGTH} characters` }, { status: 400, headers: CORS_HEADERS });
	}

	const style = getStyleById(styleId);
	if (!style) {
		return json({ error: 'Invalid style' }, { status: 400, headers: CORS_HEADERS });
	}

	if (direction !== 'to' && direction !== 'from') {
		return json({ error: 'Direction must be "to" or "from"' }, { status: 400, headers: CORS_HEADERS });
	}

	if (styleId === 'custom') {
		if (!customStyleDescription || typeof customStyleDescription !== 'string' || customStyleDescription.trim().length === 0) {
			return json({ error: 'A style description is required for Custom mode.' }, { status: 400, headers: CORS_HEADERS });
		}
		if (customStyleDescription.length > 200) {
			return json({ error: 'Style description must be under 200 characters.' }, { status: 400, headers: CORS_HEADERS });
		}
	}

	const selectedModel: ModelPreference =
		modelPreference === 'quality'
			? 'quality'
			: modelPreference === 'creative'
				? 'creative'
				: 'balanced';

	const systemPrompt =
		styleId === 'custom'
			? direction === 'to'
				? `Translate this text in the following style: ${customStyleDescription.trim()}. Output only the translated text.`
				: `The following text was written in this style: ${customStyleDescription.trim()}. Translate it back to plain standard English. Output only the translated text.`
			: direction === 'to'
				? style.systemPrompt
				: style.reverseSystemPrompt;
	const examples = direction === 'to' ? style.toExamples : style.fromExamples;
	const guardrailPrompt = direction === 'to' ? style.guardrails.to : style.guardrails.from;

	if (!platform?.env?.AI) {
		return json(
			{ error: 'AI service not available. Deploy to Cloudflare to enable translations.' },
			{ status: 503, headers: CORS_HEADERS }
		);
	}

	try {
		const sourceText = text.trim();
		const messages = buildMessages(systemPrompt, guardrailPrompt, sourceText, examples);
		const retryTemperature =
			direction === 'to'
				? Math.max(0.45, style.generation.temperature - 0.12)
				: Math.min(0.35, style.generation.temperature);
		const retryTopP =
			direction === 'to'
				? Math.max(0.82, style.generation.topP - 0.08)
				: Math.min(0.8, style.generation.topP);

		const runModel = async (modelChoice: ModelPreference): Promise<string> => {
			const result = await platform.env.AI.run(MODELS[modelChoice], {
				messages,
				temperature: style.generation.temperature,
				top_p: style.generation.topP,
				max_tokens: style.generation.maxTokens
			});

			let translation = sanitizeModelOutput(result.response ?? '');

			const shouldRetry =
				!translation ||
				translation.length < Math.min(8, Math.floor(sourceText.length * 0.2)) ||
				hasMeaningDrift(sourceText, translation);

			if (shouldRetry) {
				const retry = await platform.env.AI.run(MODELS[modelChoice], {
					messages,
					temperature: retryTemperature,
					top_p: retryTopP,
					max_tokens: style.generation.maxTokens
				});
				translation = sanitizeModelOutput(retry.response ?? '');
			}

			if (!translation) {
				throw new Error('Translation came back empty');
			}

			return translation;
		};

		let payload: TranslationResult;

		const fallbackChain: Record<ModelPreference, ModelPreference[]> = {
			quality: ['creative', 'balanced'],
			creative: ['balanced'],
			balanced: []
		};

		const fallbackWarnings: Partial<Record<ModelPreference, string>> = {
			creative: 'Quality model was unavailable; this result was generated with Creative mode.',
			balanced: 'The requested model was unavailable; this result was generated with Balanced mode.'
		};

		try {
			const translation = await runModel(selectedModel);
			payload = { translation, usedModel: selectedModel };
		} catch {
			const chain = fallbackChain[selectedModel];
			if (chain.length === 0) throw new Error('Translation failed on all available models.');

			let fallbackTranslation: string | undefined;
			let usedFallback: ModelPreference | undefined;

			for (const fallback of chain) {
				try {
					fallbackTranslation = await runModel(fallback);
					usedFallback = fallback;
					break;
				} catch {
					continue;
				}
			}

			if (!fallbackTranslation || !usedFallback) {
				throw new Error('Translation failed on all available models.');
			}

			payload = {
				translation: fallbackTranslation,
				usedModel: usedFallback,
				warning: fallbackWarnings[usedFallback]
			};
		}

		return json(payload, { headers: CORS_HEADERS });
	} catch (err) {
		console.error('AI translation error:', err);
		return json({ error: 'Translation failed. Please try again.' }, { status: 500, headers: CORS_HEADERS });
	}
};

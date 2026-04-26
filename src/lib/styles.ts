export interface TranslationStyle {
	id: string;
	name: string;
	emoji: string;
	description: string;
	systemPrompt: string;
	reverseSystemPrompt: string;
	placeholder: string;
	guardrails: {
		to: string;
		from: string;
	};
	toExamples: Array<{ input: string; output: string }>;
	fromExamples: Array<{ input: string; output: string }>;
	generation: {
		temperature: number;
		topP: number;
		maxTokens: number;
	};
}

export const styles: TranslationStyle[] = [
	{
		id: 'genz',
		name: 'Gen Z',
		emoji: '💀',
		description: 'No cap, fr fr',
		systemPrompt: `Translate this to terminally online Gen Z speak. Output only the translated text.`,
		reverseSystemPrompt: `Translate this Gen Z text to plain English. Output only the translated text.`,
		placeholder: 'Type something normal and watch it get the Gen Z treatment...',
		guardrails: {
			to: 'Sound genuinely Gen Z, not just plain English with one slang word dropped in.',
			from: 'Return clean standard English with no slang.'
		},
		toExamples: [],
		fromExamples: [],
		generation: {
			temperature: 0.84,
			topP: 0.9,
			maxTokens: 900
		}
	},
	{
		id: 'corporate',
		name: 'Corporate',
		emoji: '📊',
		description: 'Let\'s circle back on this',
		systemPrompt: `Rewrite this in polished corporate business language. Output only the rewritten text.`,
		reverseSystemPrompt: `Translate this corporate jargon into plain direct English. Output only the translated text.`,
		placeholder: 'Type something and let\'s leverage it into corporate synergy...',
		guardrails: {
			to: 'Sound professional but not absurd. Avoid stuffing in buzzwords for no reason.',
			from: 'Return clear plain English that keeps the original intent.'
		},
		toExamples: [],
		fromExamples: [],
		generation: {
			temperature: 0.62,
			topP: 0.85,
			maxTokens: 850
		}
	},
	{
		id: 'eli5',
		name: 'ELI5',
		emoji: '🧒',
		description: 'Explain it like I\'m five',
		systemPrompt: `Explain this like I'm five years old. Use simple words and short sentences. Output only the explanation.`,
		reverseSystemPrompt: `Translate this child-friendly explanation back into clear adult language. Output only the translated text.`,
		placeholder: 'Type something complicated and make it kid-friendly...',
		guardrails: {
			to: 'Keep it simple and accurate. Do not invent facts.',
			from: 'Return precise adult language that matches the original meaning.'
		},
		toExamples: [],
		fromExamples: [],
		generation: {
			temperature: 0.58,
			topP: 0.8,
			maxTokens: 900
		}
	},
	{
		id: 'demonicgoat',
		name: 'Demonic Goat',
		emoji: '🐐',
		description: 'Evil goat with a gas problem',
		systemPrompt: `Rewrite this as a melodramatic demonic goat delivering a monologue, with occasional gas sound interruptions for comedy. Output only the rewritten text.`,
		reverseSystemPrompt: `Translate this demonic goat speech into plain normal English. Output only the translated text.`,
		placeholder: 'Type something and let the Demonic Goat deliver it...',
		guardrails: {
			to: 'Keep gas interruptions to 1-3 maximum. Do not lose the original meaning.',
			from: 'Strip all theatrical language. Return only the plain meaning.'
		},
		toExamples: [],
		fromExamples: [],
		generation: {
			temperature: 0.80,
			topP: 0.95,
			maxTokens: 950
		}
	},
	{
		id: 'caveman',
		name: 'Caveman',
		emoji: '🪨',
		description: 'Ug. Me talk simple.',
		systemPrompt: `Translate this to caveman speak. Short choppy sentences, drop small words, grunt occasionally. Output only the translated text.`,
		reverseSystemPrompt: `Translate this caveman speech into plain modern English. Output only the translated text.`,
		placeholder: 'Type something and let caveman explain...',
		guardrails: {
			to: 'Sound like a caveman. Keep key facts and numbers intact.',
			from: 'Return clean modern English with full grammar.'
		},
		toExamples: [],
		fromExamples: [],
		generation: {
			temperature: 0.68,
			topP: 0.88,
			maxTokens: 900
		}
	},
	{
		id: 'custom',
		name: 'Custom',
		emoji: '✏️',
		description: 'Your own style',
		systemPrompt: '',
		reverseSystemPrompt: '',
		placeholder: 'Type your text here...',
		guardrails: { to: '', from: '' },
		toExamples: [],
		fromExamples: [],
		generation: {
			temperature: 0.75,
			topP: 0.92,
			maxTokens: 950
		}
	}
];

export function getStyleById(id: string): TranslationStyle | undefined {
	return styles.find((s) => s.id === id);
}

// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		interface Platform {
			env: {
				AI: {
					run(
						model: string,
						inputs: {
							messages: Array<{ role: string; content: string }>;
								temperature?: number;
								top_p?: number;
							max_tokens?: number;
							stream?: boolean;
						}
					): Promise<{ response: string }>;
				};
			};
		}
	}
}

export {};

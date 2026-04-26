<script lang="ts">
	import { styles } from '$lib/styles';
	import { browser } from '$app/environment';

	const MAX_LENGTH = 2000;
	const CUSTOM_STYLES_KEY = 'lingobridge_custom_styles';
	const HISTORY_KEY = 'lingobridge_history';
	const HISTORY_MAX = 50;

	interface UserCustomStyle {
		id: string;
		name: string;
		description: string;
	}

	interface HistoryEntry {
		id: string;
		timestamp: number;
		styleId: string;
		styleName: string;
		styleEmoji: string;
		direction: 'to' | 'from';
		inputText: string;
		outputText: string;
		customStyleDescription?: string;
	}

	function loadCustomStyles(): UserCustomStyle[] {
		if (!browser) return [];
		try {
			return JSON.parse(localStorage.getItem(CUSTOM_STYLES_KEY) ?? '[]');
		} catch {
			return [];
		}
	}

	function saveCustomStyles(list: UserCustomStyle[]) {
		if (browser) localStorage.setItem(CUSTOM_STYLES_KEY, JSON.stringify(list));
	}

	function loadHistory(): HistoryEntry[] {
		if (!browser) return [];
		try {
			return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]');
		} catch {
			return [];
		}
	}

	function saveHistory(list: HistoryEntry[]) {
		if (browser) localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
	}

	function historyDateLabel(timestamp: number): string {
		const d = new Date(timestamp);
		const now = new Date();
		const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
		const yesterdayStart = todayStart - 86400000;
		if (timestamp >= todayStart) return 'Today';
		if (timestamp >= yesterdayStart) return 'Yesterday';
		return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
	}

	const builtinStyles = styles.filter((s) => s.id !== 'custom');

	let inputText = $state('');
	let outputText = $state('');
	let selectedStyleId = $state(builtinStyles[0].id);
	let direction = $state<'to' | 'from'>('to');
	let modelPreference = $state<'balanced' | 'creative' | 'quality'>('quality');
	let loading = $state(false);
	let error = $state('');
	let warning = $state('');
	let copied = $state(false);
	let userCustomStyles = $state<UserCustomStyle[]>(loadCustomStyles());
	let historyEntries = $state<HistoryEntry[]>(loadHistory());

	// Group history entries by date label, preserving newest-first order
	let groupedHistory = $derived(() => {
		const groups: { label: string; entries: HistoryEntry[] }[] = [];
		const seen = new Map<string, HistoryEntry[]>();
		for (const entry of historyEntries) {
			const label = historyDateLabel(entry.timestamp);
			if (!seen.has(label)) {
				seen.set(label, []);
				groups.push({ label, entries: seen.get(label)! });
			}
			seen.get(label)!.push(entry);
		}
		return groups;
	});

	let selectedBuiltin = $derived(builtinStyles.find((s) => s.id === selectedStyleId));
	let selectedUserCustom = $derived(userCustomStyles.find((s) => s.id === selectedStyleId));
	let isUserCustomSelected = $derived(!!selectedUserCustom);

	let selectedName = $derived(
		selectedBuiltin?.name ?? selectedUserCustom?.name ?? 'Custom'
	);
	let selectedEmoji = $derived(selectedBuiltin?.emoji ?? '✏️');
	let selectedPlaceholder = $derived(
		selectedBuiltin?.placeholder ?? 'Type your text here...'
	);

	let charCount = $derived(inputText.length);
	let isOverLimit = $derived(charCount > MAX_LENGTH);
	let isCustomMissingDescription = $derived(
		isUserCustomSelected && (selectedUserCustom?.description.trim().length ?? 0) === 0
	);
	let canTranslate = $derived(
		inputText.trim().length > 0 && !isOverLimit && !loading && !isCustomMissingDescription
	);

	let directionLabel = $derived(
		direction === 'to'
			? `Normal → ${selectedName} ${selectedEmoji}`
			: `${selectedName} ${selectedEmoji} → Normal`
	);

	function toggleDirection() {
		direction = direction === 'to' ? 'from' : 'to';
		outputText = '';
		error = '';
	}

	function selectStyle(id: string) {
		selectedStyleId = id;
		outputText = '';
		error = '';
	}

	function addCustomStyle() {
		const id = `custom_${Date.now()}`;
		const newStyle: UserCustomStyle = { id, name: 'My Style', description: '' };
		userCustomStyles = [...userCustomStyles, newStyle];
		saveCustomStyles(userCustomStyles);
		selectStyle(id);
	}

	function updateCustomStyleField(id: string, field: 'name' | 'description', value: string) {
		userCustomStyles = userCustomStyles.map((s) =>
			s.id === id ? { ...s, [field]: value } : s
		);
		saveCustomStyles(userCustomStyles);
	}

	function deleteCustomStyle(id: string) {
		userCustomStyles = userCustomStyles.filter((s) => s.id !== id);
		saveCustomStyles(userCustomStyles);
		if (selectedStyleId === id) {
			selectedStyleId = builtinStyles[0].id;
		}
	}

	function addToHistory(entry: HistoryEntry) {
		historyEntries = [entry, ...historyEntries].slice(0, HISTORY_MAX);
		saveHistory(historyEntries);
	}

	function deleteHistoryEntry(id: string) {
		historyEntries = historyEntries.filter((e) => e.id !== id);
		saveHistory(historyEntries);
	}

	function clearHistory() {
		historyEntries = [];
		saveHistory([]);
	}

	function loadFromHistory(entry: HistoryEntry) {
		inputText = entry.inputText;
		outputText = entry.outputText;
		direction = entry.direction;
		error = '';
		warning = '';

		// Restore style selection if still available
		const builtinMatch = builtinStyles.find((s) => s.id === entry.styleId);
		const customMatch = userCustomStyles.find((s) => s.id === entry.styleId);
		if (builtinMatch) {
			selectedStyleId = builtinMatch.id;
		} else if (customMatch) {
			selectedStyleId = customMatch.id;
		}
		// If the style is gone we leave the current selection as-is
	}

	async function translate() {
		if (!canTranslate) return;

		loading = true;
		error = '';
		warning = '';
		outputText = '';

		try {
			const res = await fetch('/api/translate', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					text: inputText.trim(),
					styleId: isUserCustomSelected ? 'custom' : selectedStyleId,
					direction,
					modelPreference,
					...(isUserCustomSelected && {
						customStyleDescription: selectedUserCustom!.description.trim()
					})
				})
			});

			const data = await res.json();

			if (!res.ok) {
				error = data.error || 'Translation failed.';
				return;
			}

			outputText = data.translation;
			warning = data.warning || '';

			addToHistory({
				id: `h_${Date.now()}`,
				timestamp: Date.now(),
				styleId: isUserCustomSelected ? selectedUserCustom!.id : selectedStyleId,
				styleName: selectedName,
				styleEmoji: selectedEmoji,
				direction,
				inputText: inputText.trim(),
				outputText: data.translation,
				...(isUserCustomSelected && {
					customStyleDescription: selectedUserCustom!.description.trim()
				})
			});
		} catch {
			error = 'Network error. Please try again.';
		} finally {
			loading = false;
		}
	}

	async function copyOutput() {
		if (!outputText) return;
		await navigator.clipboard.writeText(outputText);
		copied = true;
		setTimeout(() => (copied = false), 2000);
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && canTranslate) {
			translate();
		}
	}
</script>

<svelte:head>
	<title>LingoBridge — Style Translator</title>
	<meta name="description" content="Translate text between English styles: Gen Z slang, corporate jargon, ELI5, and more." />
</svelte:head>

<div class="app-shell">
	<!-- Sidebar history -->
	<aside class="sidebar">
		<div class="sidebar-header">
			<span class="sidebar-title">🕐 History</span>
			{#if historyEntries.length > 0}
				<button class="history-clear-btn" onclick={clearHistory}>Clear all</button>
			{/if}
		</div>
		<div class="sidebar-body">
			{#if historyEntries.length === 0}
				<p class="history-empty">No translations yet.</p>
			{:else}
				{#each groupedHistory() as group}
					<div class="history-group">
						<p class="history-group-label">{group.label}</p>
						{#each group.entries as entry}
							<div class="history-entry">
								<button class="history-entry-body" onclick={() => loadFromHistory(entry)}>
									<span class="history-entry-style">{entry.styleEmoji} {entry.styleName} {entry.direction === 'to' ? '→' : '←'}</span>
									<span class="history-entry-preview">{entry.inputText.slice(0, 60)}{entry.inputText.length > 60 ? '…' : ''}</span>
								</button>
								<button class="history-entry-delete" onclick={() => deleteHistoryEntry(entry.id)} aria-label="Remove">✕</button>
							</div>
						{/each}
					</div>
				{/each}
			{/if}
		</div>
	</aside>

	<div class="translator">
	<!-- Style selector -->
	<div class="style-selector">
		{#each builtinStyles as style}
			<button
				class="style-btn"
				class:active={selectedStyleId === style.id}
				onclick={() => selectStyle(style.id)}
			>
				<span class="style-emoji">{style.emoji}</span>
				<span class="style-name">{style.name}</span>
				<span class="style-desc">{style.description}</span>
			</button>
		{/each}

		{#each userCustomStyles as cs}
			<div class="style-btn custom-card" class:active={selectedStyleId === cs.id}>
				<button
					class="custom-card-select"
					onclick={() => selectStyle(cs.id)}
					aria-label="Select {cs.name}"
				>
					<span class="style-emoji">✏️</span>
					<span class="style-name">{cs.name}</span>
					<span class="style-desc">{cs.description || 'No description yet'}</span>
				</button>
				<button
					class="custom-card-delete"
					onclick={() => deleteCustomStyle(cs.id)}
					aria-label="Delete {cs.name}"
				>✕</button>
			</div>
		{/each}

		<button class="style-btn add-style-btn" onclick={addCustomStyle}>
			<span class="style-emoji">＋</span>
			<span class="style-name">New Style</span>
			<span class="style-desc">Create your own</span>
		</button>
	</div>

	{#if isUserCustomSelected && selectedUserCustom}
		<div class="custom-style-input">
			<div class="custom-fields">
				<div class="custom-field">
					<label for="custom-style-name">Style name</label>
					<input
						id="custom-style-name"
						type="text"
						value={selectedUserCustom.name}
						oninput={(e) => updateCustomStyleField(selectedUserCustom!.id, 'name', (e.target as HTMLInputElement).value)}
						placeholder="Style name"
						maxlength={40}
					/>
				</div>
				<div class="custom-field custom-field-grow">
					<label for="custom-style-desc">Describe the style</label>
					<input
						id="custom-style-desc"
						type="text"
						value={selectedUserCustom.description}
						oninput={(e) => updateCustomStyleField(selectedUserCustom!.id, 'description', (e.target as HTMLInputElement).value)}
						placeholder="e.g. a pirate, a 1920s newspaper headline, a confused grandparent..."
						maxlength={200}
					/>
				</div>
			</div>
		</div>
	{/if}

	<!-- Direction toggle -->
	<button class="direction-toggle" onclick={toggleDirection}>
		{directionLabel}
		<span class="swap-icon">⇄</span>
	</button>

	<div class="model-toggle">
		<span class="model-label">Model</span>
		<div class="model-buttons" role="group" aria-label="Model quality setting">
			<button
				type="button"
				class="model-btn"
				class:active={modelPreference === 'balanced'}
				onclick={() => (modelPreference = 'balanced')}
			>
				Balanced
			</button>
			<button
				type="button"
				class="model-btn"
				class:active={modelPreference === 'creative'}
				onclick={() => (modelPreference = 'creative')}
			>
				Creative
			</button>
			<button
				type="button"
				class="model-btn"
				class:active={modelPreference === 'quality'}
				onclick={() => (modelPreference = 'quality')}
			>
				Quality
			</button>
		</div>
	</div>

	<!-- Input / Output panels -->
	<div class="panels">
		<div class="panel input-panel">
			<label for="input-text">
				{direction === 'to' ? 'Your text' : `${selectedName} text`}
			</label>
			<textarea
				id="input-text"
				bind:value={inputText}
				onkeydown={handleKeydown}
				placeholder={selectedPlaceholder}
				rows={6}
				maxlength={MAX_LENGTH + 100}
			></textarea>
			<div class="panel-footer">
				<span class="char-count" class:over-limit={isOverLimit}>
					{charCount}/{MAX_LENGTH}
				</span>
				<button class="translate-btn" onclick={translate} disabled={!canTranslate}>
					{#if loading}
						<span class="spinner"></span> Translating...
					{:else}
						Translate
					{/if}
				</button>
			</div>
		</div>

		<div class="panel output-panel">
			<label>
				{direction === 'to' ? `${selectedName} ${selectedEmoji}` : 'Normal English'}
			</label>
			<div class="output-area" class:empty={!outputText && !error}>
				{#if error}
					<p class="error-text">{error}</p>
				{:else if outputText}
					<p>{outputText}</p>
				{:else if loading}
					<p class="placeholder-text">Translating...</p>
				{:else}
					<p class="placeholder-text">Translation will appear here</p>
				{/if}
			</div>
			{#if warning}
				<p class="warning-text">{warning}</p>
			{/if}
			{#if outputText}
				<div class="panel-footer">
					<button class="copy-btn" onclick={copyOutput}>
						{copied ? '✓ Copied!' : '📋 Copy'}
					</button>
				</div>
			{/if}
		</div>
	</div>

	<p class="hint">Ctrl+Enter to translate</p>
	</div>
</div>

<style>
	.translator {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}

	/* Style selector */
	.style-selector {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 0.75rem;
	}

	.custom-style-input {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.custom-fields {
		display: flex;
		gap: 0.75rem;
	}

	.custom-field {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		min-width: 0;
	}

	.custom-field-grow {
		flex: 1;
	}

	.custom-style-input label {
		font-size: 0.8rem;
		font-weight: 600;
		color: var(--color-muted);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.custom-style-input input {
		width: 100%;
		background: var(--color-input-bg);
		border: 1px solid var(--color-border);
		border-radius: 8px;
		color: var(--color-text);
		font-family: inherit;
		font-size: 0.95rem;
		padding: 0.65rem 0.85rem;
		transition: border-color 0.15s;
		box-sizing: border-box;
	}

	.custom-style-input input:focus {
		outline: none;
		border-color: var(--color-accent);
	}

	.custom-style-input input::placeholder {
		color: var(--color-muted);
		opacity: 0.6;
	}

	/* Custom style cards */
	.custom-card {
		position: relative;
		padding: 0;
		overflow: hidden;
	}

	.custom-card-select {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.25rem;
		padding: 0.85rem 0.5rem 0.5rem;
		width: 100%;
		background: transparent;
		border: none;
		color: var(--color-text);
		cursor: pointer;
		font-family: inherit;
	}

	.custom-card-delete {
		position: absolute;
		top: 0.3rem;
		right: 0.3rem;
		background: transparent;
		border: none;
		color: var(--color-muted);
		font-size: 0.7rem;
		cursor: pointer;
		padding: 0.15rem 0.3rem;
		border-radius: 4px;
		line-height: 1;
		opacity: 0;
		transition: opacity 0.15s, color 0.15s;
	}

	.custom-card:hover .custom-card-delete {
		opacity: 1;
	}

	.custom-card-delete:hover {
		color: var(--color-error);
	}

	.add-style-btn {
		border-style: dashed;
		opacity: 0.65;
	}

	.add-style-btn:hover {
		opacity: 1;
	}

	.style-btn {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.25rem;
		padding: 0.85rem 0.5rem;
		background: var(--color-surface);
		border: 2px solid var(--color-border);
		border-radius: 10px;
		color: var(--color-text);
		cursor: pointer;
		transition: all 0.15s;
		font-family: inherit;
	}

	.style-btn:hover {
		background: var(--color-surface-hover);
		border-color: var(--color-accent);
	}

	.style-btn.active {
		border-color: var(--color-accent);
		background: rgba(167, 139, 250, 0.1);
	}

	.style-emoji {
		font-size: 1.5rem;
	}

	.style-name {
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--color-heading);
	}

	.style-desc {
		font-size: 0.7rem;
		color: var(--color-muted);
	}

	/* Direction toggle */
	.direction-toggle {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		padding: 0.6rem 1rem;
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: 8px;
		color: var(--color-text);
		font-size: 0.9rem;
		font-weight: 500;
		font-family: inherit;
		cursor: pointer;
		transition: all 0.15s;
	}

	.direction-toggle:hover {
		border-color: var(--color-accent);
		background: var(--color-surface-hover);
	}

	.swap-icon {
		font-size: 1.1rem;
	}

	.model-toggle {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 0.6rem;
	}

	.model-label {
		font-size: 0.8rem;
		color: var(--color-muted);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.model-buttons {
		display: inline-flex;
		border: 1px solid var(--color-border);
		border-radius: 8px;
		overflow: hidden;
	}

	.model-btn {
		padding: 0.45rem 0.75rem;
		background: var(--color-surface);
		border: none;
		color: var(--color-text);
		font-size: 0.8rem;
		cursor: pointer;
		font-family: inherit;
	}

	.model-btn + .model-btn {
		border-left: 1px solid var(--color-border);
	}

	.model-btn.active {
		background: rgba(167, 139, 250, 0.2);
		color: var(--color-heading);
	}

	/* Panels */
	.panels {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
	}

	.panel {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.panel label {
		font-size: 0.8rem;
		font-weight: 600;
		color: var(--color-muted);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	textarea {
		width: 100%;
		background: var(--color-input-bg);
		border: 1px solid var(--color-border);
		border-radius: 8px;
		color: var(--color-text);
		font-family: inherit;
		font-size: 0.95rem;
		line-height: 1.6;
		padding: 0.85rem;
		resize: vertical;
		min-height: 160px;
		transition: border-color 0.15s;
	}

	textarea:focus {
		outline: none;
		border-color: var(--color-accent);
	}

	textarea::placeholder {
		color: var(--color-muted);
		opacity: 0.6;
	}

	.output-area {
		background: var(--color-input-bg);
		border: 1px solid var(--color-border);
		border-radius: 8px;
		padding: 0.85rem;
		min-height: 160px;
		font-size: 0.95rem;
		line-height: 1.6;
	}

	.output-area.empty {
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.placeholder-text {
		color: var(--color-muted);
		opacity: 0.5;
		font-style: italic;
	}

	.error-text {
		color: var(--color-error);
	}

	.warning-text {
		margin-top: 0.5rem;
		font-size: 0.8rem;
		line-height: 1.4;
		color: #fbbf24;
	}

	/* Footer / actions */
	.panel-footer {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.char-count {
		font-size: 0.75rem;
		color: var(--color-muted);
	}

	.char-count.over-limit {
		color: var(--color-error);
		font-weight: 600;
	}

	.translate-btn {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.55rem 1.25rem;
		background: var(--color-accent);
		color: #0c0f1a;
		border: none;
		border-radius: 6px;
		font-size: 0.9rem;
		font-weight: 600;
		font-family: inherit;
		cursor: pointer;
		transition: background 0.15s;
	}

	.translate-btn:hover:not(:disabled) {
		background: var(--color-accent-hover);
	}

	.translate-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.copy-btn {
		margin-left: auto;
		padding: 0.4rem 0.85rem;
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: 6px;
		color: var(--color-text);
		font-size: 0.8rem;
		font-weight: 500;
		font-family: inherit;
		cursor: pointer;
		transition: all 0.15s;
	}

	.copy-btn:hover {
		border-color: var(--color-success);
		color: var(--color-success);
	}

	.spinner {
		display: inline-block;
		width: 14px;
		height: 14px;
		border: 2px solid rgba(12, 15, 26, 0.3);
		border-top-color: #0c0f1a;
		border-radius: 50%;
		animation: spin 0.6s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.hint {
		text-align: center;
		font-size: 0.75rem;
		color: var(--color-muted);
		opacity: 0.5;
	}

	/* Responsive */
	@media (max-width: 640px) {
		.app-shell {
			flex-direction: column;
		}

		.sidebar {
			width: 100%;
			position: static;
			max-height: 220px;
		}

		.style-selector {
			grid-template-columns: repeat(2, 1fr);
		}

		.panels {
			grid-template-columns: 1fr;
		}

		.style-desc {
			display: none;
		}
	}

	/* App shell & sidebar */
	.app-shell {
		display: flex;
		align-items: flex-start;
		gap: 1.5rem;
	}

	.sidebar {
		width: 240px;
		flex-shrink: 0;
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: 12px;
		display: flex;
		flex-direction: column;
		position: sticky;
		top: 1rem;
		max-height: calc(100vh - 6rem);
		overflow: hidden;
	}

	.sidebar-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.75rem 1rem;
		border-bottom: 1px solid var(--color-border);
		flex-shrink: 0;
	}

	.sidebar-title {
		font-size: 0.82rem;
		font-weight: 600;
		color: var(--color-muted);
	}

	.sidebar-body {
		flex: 1;
		overflow-y: auto;
	}

	.history-clear-btn {
		background: none;
		border: none;
		color: var(--color-muted);
		font-size: 0.75rem;
		font-family: inherit;
		cursor: pointer;
		padding: 0.2rem 0.5rem;
		border-radius: 4px;
		transition: color 0.15s;
	}

	.history-clear-btn:hover {
		color: var(--color-error);
	}

	.history-empty {
		padding: 1.25rem;
		text-align: center;
		color: var(--color-muted);
		font-size: 0.85rem;
		font-style: italic;
	}

	.history-group {
		border-bottom: 1px solid var(--color-border);
	}

	.history-group:last-child {
		border-bottom: none;
	}

	.history-group-label {
		font-size: 0.7rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--color-muted);
		padding: 0.5rem 1rem 0.25rem;
	}

	.history-entry {
		display: flex;
		align-items: stretch;
		border-top: 1px solid var(--color-border);
	}

	.history-entry:first-of-type {
		border-top: none;
	}

	.history-entry-body {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		padding: 0.6rem 1rem;
		background: none;
		border: none;
		text-align: left;
		cursor: pointer;
		font-family: inherit;
		transition: background 0.15s;
		min-width: 0;
	}

	.history-entry-body:hover {
		background: var(--color-surface-hover);
	}

	.history-entry-style {
		font-size: 0.72rem;
		font-weight: 600;
		color: var(--color-accent);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.history-entry-preview {
		font-size: 0.82rem;
		color: var(--color-text);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.history-entry-delete {
		flex-shrink: 0;
		background: none;
		border: none;
		color: var(--color-muted);
		font-size: 0.65rem;
		padding: 0 0.85rem;
		cursor: pointer;
		opacity: 0;
		transition: opacity 0.15s, color 0.15s;
	}

	.history-entry:hover .history-entry-delete {
		opacity: 1;
	}

	.history-entry-delete:hover {
		color: var(--color-error);
	}
</style>

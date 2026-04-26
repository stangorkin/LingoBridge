<script lang="ts">
	let { children } = $props();
</script>

<svelte:head>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link
		href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
		rel="stylesheet"
	/>
</svelte:head>

<div class="app">
	<header>
		<h1><span class="logo-emoji">🌐</span> LingoBridge</h1>
		<p class="tagline">Translate your text into any vibe</p>
	</header>

	<main>
		{@render children()}
	</main>

	<footer>
		<p>
			Built by <a href="https://github.com/stangorkin" target="_blank" rel="noopener noreferrer">Stan Gorkin</a>
			&middot; Powered by Cloudflare Workers AI
		</p>
	</footer>
</div>

<style>
	:global(*) {
		margin: 0;
		padding: 0;
		box-sizing: border-box;
	}

	:global(:root) {
		--color-bg: #0c0f1a;
		--color-surface: #161b2e;
		--color-surface-hover: #1c2340;
		--color-border: #2a3150;
		--color-text: #e2e8f0;
		--color-heading: #f8fafc;
		--color-muted: #8892b0;
		--color-accent: #a78bfa;
		--color-accent-hover: #c4b5fd;
		--color-success: #34d399;
		--color-error: #f87171;
		--color-input-bg: #1a2038;
	}

	:global(body) {
		font-family: 'Inter', system-ui, -apple-system, sans-serif;
		background: var(--color-bg);
		color: var(--color-text);
		line-height: 1.6;
		min-height: 100vh;
	}

	:global(html) {
		scroll-behavior: smooth;
	}

	.app {
		min-height: 100vh;
		display: flex;
		flex-direction: column;
		max-width: min(1200px, 95vw);
		margin: 0 auto;
		padding: 0 1.5rem;
	}

	header {
		text-align: center;
		padding: 2.5rem 0 1.5rem;
	}

	header h1 {
		font-size: 2rem;
		font-weight: 800;
		color: var(--color-heading);
		letter-spacing: -0.02em;
	}

	.logo-emoji {
		font-size: 1.8rem;
	}

	.tagline {
		color: var(--color-muted);
		font-size: 1rem;
		margin-top: 0.25rem;
	}

	main {
		flex: 1;
	}

	footer {
		text-align: center;
		padding: 2rem 0;
		color: var(--color-muted);
		font-size: 0.8rem;
	}

	footer a {
		color: var(--color-accent);
		text-decoration: none;
	}

	footer a:hover {
		text-decoration: underline;
	}
</style>

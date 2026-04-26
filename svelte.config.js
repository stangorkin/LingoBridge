import adapterAuto from '@sveltejs/adapter-auto';
import adapterCloudflare from '@sveltejs/adapter-cloudflare';

// Use auto adapter for dev (avoids debugger conflicts), Cloudflare for deployment
const adapter = process.env.NODE_ENV === 'production' ? adapterCloudflare() : adapterAuto();

/** @type {import('@sveltejs/kit').Config} */
const config = {
	compilerOptions: {
		runes: true
	},
	kit: {
		adapter: adapter
	}
};

export default config;

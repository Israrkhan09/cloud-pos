import '../css/app.css';
import './lib/i18n';

import { createInertiaApp, router } from '@inertiajs/react';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import { createRoot } from 'react-dom/client';
import { initializeTheme } from './hooks/use-appearance';

const appName = import.meta.env.VITE_APP_NAME || 'Vegetable POS';

// Global router listener to keep tenant context synced across navigations
router.on('navigate', (event) => {
    const page = event.detail.page;
    const bizId = (page.props as any)?.business?.id || (page.props as any)?.auth?.user?.business_id;
    if (bizId) {
        (window as any).__ACTIVE_BUSINESS_ID__ = bizId;
        const meta = document.querySelector('meta[name="business-id"]');
        if (meta) meta.setAttribute('content', bizId);
    }
});

createInertiaApp({
    title: (title) => title ? `${title} - ${appName}` : appName,
    resolve: (name) => resolvePageComponent(`./pages/${name}.tsx`, import.meta.glob('./pages/**/*.tsx')),
    setup({ el, App, props }) {
        const root = createRoot(el);
        const initialBizId = (props.initialPage.props as any)?.business?.id || (props.initialPage.props as any)?.auth?.user?.business_id;
        if (initialBizId) {
            (window as any).__ACTIVE_BUSINESS_ID__ = initialBizId;
        }

        root.render(<App {...props} />);
        delete el.dataset.page
    },
    progress: {
        color: '#4B5563',
    },
});

// This will set light / dark mode on load...
initializeTheme();

// js/core/app.js - Core application module with shared patterns

class BudgetApp {
    constructor() {
        this.isInitialized = false;
        this.currentUser = null;
        this.subscriptions = new Map();
        this.components = new Map();
        this.services = new Map();
    }

    // Common initialization pattern for all pages
    async init(pageConfig = {}) {
        if (this.isInitialized) return;

        try {
            // Authenticate user
            this.currentUser = await this.requireAuth();
            if (!this.currentUser) return;

            // Load core components
            await this.loadComponents(['navbar', 'settingsModal']);
            
            // Initialize month navigation if needed
            if (pageConfig.useMonthNav !== false) {
                this.initMonthNavigation();
            }

            // Setup realtime subscriptions
            if (pageConfig.realtimeConfig) {
                this.setupRealtime(pageConfig.realtimeConfig);
            }

            // Page-specific initialization
            if (pageConfig.initCallback) {
                await pageConfig.initCallback();
            }

            this.setupPageLifecycle(pageConfig);
            this.isInitialized = true;
            
            console.log(`✅ ${pageConfig.pageName || 'Page'} initialized successfully`);
            
        } catch (error) {
            console.error('❌ App initialization failed:', error);
        }
    }

    // Centralized authentication
    async requireAuth() {
        try {
            const { data: { session }, error } = await supabase.auth.getSession();
            if (error) throw error;
            
            if (!session) {
                console.log('No session found, redirecting to login...');
                window.location.href = 'index.html';
                return null;
            }
            
            console.log('User authenticated:', session.user.email);
            return session.user;
            
        } catch (error) {
            console.error('Auth check error:', error);
            window.location.href = 'index.html';
            return null;
        }
    }

    // Component loading system
    async loadComponents(componentNames) {
        const loadPromises = componentNames.map(async (name) => {
            if (this.components.has(name)) return;

            try {
                const response = await fetch(`components/${name}.html`);
                const html = await response.text();
                
                // Insert component
                if (name === 'navbar') {
                    document.body.insertAdjacentHTML('afterbegin', html);
                } else {
                    document.body.insertAdjacentHTML('beforeend', html);
                }

                // Initialize component
                const initFunction = window[`init${name.charAt(0).toUpperCase() + name.slice(1)}`];
                if (initFunction) {
                    await initFunction();
                }

                this.components.set(name, true);
                console.log(`📦 Component '${name}' loaded`);

            } catch (error) {
                console.error(`Failed to load component '${name}':`, error);
            }
        });

        await Promise.all(loadPromises);
    }

    // Centralized realtime subscriptions
    setupRealtime(config) {
        const userId = this.currentUser.id;
        
        config.forEach(({ table, callback, channelName }) => {
            const channel = supabase
                .channel(channelName || `app-${table}`)
                .on('postgres_changes', {
                    event: '*',
                    schema: 'public',
                    table: table,
                    filter: `user_id=eq.${userId}`
                }, (payload) => {
                    console.log(`✨ ${table} changed:`, payload.eventType);
                    callback(payload);
                })
                .subscribe((status, err) => {
                    console.log(`📡 ${table} subscription:`, status);
                    if (err) console.error('❌ Error:', err);
                });

            this.subscriptions.set(channelName || table, channel);
        });
    }

    // Common page lifecycle handlers
    setupPageLifecycle(config) {
        // Handle page visibility changes
        document.addEventListener('visibilitychange', async () => {
            if (!document.hidden && this.isInitialized && config.onVisible) {
                console.log('👁️ Page visible, refreshing data...');
                await config.onVisible();
            }
        });

        // Handle browser back/forward cache
        window.addEventListener('pageshow', async (event) => {
            if (event.persisted && config.onCacheRestore) {
                console.log('🔄 Page restored from cache...');
                this.isInitialized = false;
                await this.init(config);
            }
        });

        // Handle window focus
        window.addEventListener('focus', async () => {
            if (this.isInitialized && config.onFocus) {
                console.log('🎯 Window focused, refreshing...');
                await config.onFocus();
            }
        });

        // Cleanup on unload
        window.addEventListener('beforeunload', () => {
            this.cleanup();
        });
    }

    // Month navigation system
    initMonthNavigation() {
        if (typeof MonthNavigation !== 'undefined') {
            MonthNavigation.init();
            
            // Dispatch ready event
            setTimeout(() => {
                window.dispatchEvent(new CustomEvent('monthNavReady'));
            }, 100);
        }
    }

    // Service registry
    registerService(name, service) {
        this.services.set(name, service);
        return service;
    }

    getService(name) {
        return this.services.get(name);
    }

    // Utility methods
    formatCurrency(amount) {
        const value = parseFloat(amount) || 0;
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(value);
    }

    debounce(func, delay) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), delay);
        };
    }

    // Cleanup
    cleanup() {
        this.subscriptions.forEach((channel) => {
            supabase.removeChannel(channel);
        });
        this.subscriptions.clear();
        console.log('🧹 App cleanup completed');
    }
}

// Global app instance
window.budgetApp = new BudgetApp();

// Common modal utilities
window.showModal = (modalId) => {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('active');
        // Initialize Lucide icons after modal is shown
        setTimeout(() => lucide.createIcons(), 10);
    }
};

window.hideModal = (modalId) => {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('active');
};

// Enhanced console logging for development
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    window.budgetApp.debug = true;
    console.log('🚀 BudgetApp initialized in debug mode');
}
// js/supabaseClient.js

const SUPABASE_URL = 'https://ozherbfevdunekopxwli.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im96aGVyYmZldmR1bmVrb3B4d2xpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzMzM5NDQsImV4cCI6MjA3NDkwOTk0NH0.hoNyQldyGh-xe3D_JYl3R2MH3GD9QHNxTYMOAuDaIA8';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

console.log('Supabase client initialized');

// This function protects pages from unauthenticated users
async function requireAuth() {
    try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) throw error;
        
        // If there is NO session, redirect to the login page
        if (!session) {
            console.log('No session found, redirecting to login...');
            window.location.href = 'login.html'; // CORRECTED: Redirect to login.html
            return null;
        }
        
        // User is authenticated, return the user object
        console.log('User authenticated:', session.user.email);
        return session.user;
        
    } catch (error) {
        console.error('Auth check error:', error);
        window.location.href = 'login.html'; // CORRECTED: Redirect to login.html on error
        return null;
    }
}
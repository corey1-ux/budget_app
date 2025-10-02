const BudgetData = {
    // Get data for a specific month from Supabase
    async getMonthData(monthKey) {
        try {
            // --- THIS IS THE CRITICAL FIX ---
            // First, get the current user to know who we're fetching data for.
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return { income: 0, expenses: [] }; // If no user, return empty budget

            const { data, error } = await supabase
                .from('budgets')
                .select('data')
                .eq('user_id', user.id) // Specify the user
                .eq('month_key', monthKey) // And the month
                .single(); 

            if (error && error.code !== 'PGRST116') { // PGRST116 = "No rows found" which is okay
                throw error;
            }

            return data ? data.data : { income: 0, expenses: [] };

        } catch (err) {
            console.error('Error fetching budget data:', err);
            return { income: 0, expenses: [] };
        }
    },
    
    // Save data for a specific month to Supabase
    async saveMonthData(monthKey, dataToSave) {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("User not authenticated");

            const { error } = await supabase
                .from('budgets')
                .upsert({
                    user_id: user.id,
                    month_key: monthKey,
                    data: dataToSave
                }, {
                    onConflict: 'user_id, month_key' 
                });

            if (error) throw error;

        } catch (err) {
            console.error('Error saving budget data:', err);
        }
    }
};
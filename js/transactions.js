// ============================================
// LEARNING SYSTEM FOR MERCHANT CATEGORIZATION
// ============================================

// Save learned merchant categorizations
async function saveMerchantLearning(merchant, category) {
    if (!currentUser || !merchant || !category || category === 'Uncategorized') return;
    
    try {
        // Normalize merchant name (remove numbers, extra spaces)
        const normalizedMerchant = merchant.toLowerCase().trim().replace(/\d+/g, '').replace(/\s+/g, ' ');
        
        await supabase.from('merchant_categories').upsert({
            user_id: currentUser.id,
            merchant_normalized: normalizedMerchant,
            merchant_original: merchant,
            category: category,
            updated_at: new Date().toISOString()
        }, {
            onConflict: 'user_id,merchant_normalized'
        });
        
        console.log(`✓ Learned: "${merchant}" → "${category}"`);
    } catch (err) {
        console.error('Error saving merchant learning:', err);
        // Non-critical error, don't throw
    }
}

// Get learned category for a merchant
async function getLearnedCategory(merchant) {
    if (!currentUser || !merchant) return null;
    
    try {
        const normalizedMerchant = merchant.toLowerCase().trim().replace(/\d+/g, '').replace(/\s+/g, ' ');
        
        const { data, error } = await supabase
            .from('merchant_categories')
            .select('category')
            .eq('user_id', currentUser.id)
            .eq('merchant_normalized', normalizedMerchant)
            .maybeSingle();
        
        if (error) throw error;
        return data?.category || null;
    } catch (err) {
        console.error('Error getting learned category:', err);
        return null;
    }
}

// Apply learned categorizations to transactions
async function applyLearnedCategories(transactions) {
    if (!currentUser || !transactions || transactions.length === 0) return transactions;
    
    try {
        // Get all learned mappings for this user
        const { data: learnedMappings, error } = await supabase
            .from('merchant_categories')
            .select('merchant_normalized, category')
            .eq('user_id', currentUser.id);
        
        if (error) throw error;
        
        if (!learnedMappings || learnedMappings.length === 0) return transactions;
        
        // Create a map for quick lookups
        const learningMap = new Map();
        learnedMappings.forEach(mapping => {
            learningMap.set(mapping.merchant_normalized, mapping.category);
        });
        
        // Apply learned categories
        let learnedCount = 0;
        const updatedTransactions = transactions.map(t => {
            const normalizedMerchant = t.merchant.toLowerCase().trim().replace(/\d+/g, '').replace(/\s+/g, ' ');
            const learnedCategory = learningMap.get(normalizedMerchant);
            
            if (learnedCategory) {
                learnedCount++;
                return { ...t, category: learnedCategory, learned: true };
            }
            return t;
        });
        
        if (learnedCount > 0) {
            console.log(`🧠 Applied ${learnedCount} learned categorization(s)`);
        }
        
        return updatedTransactions;
    } catch (err) {
        console.error('Error applying learned categories:', err);
        return transactions;
    }
}

// ============================================
// GLOBAL VARIABLES
// ============================================
let transactions = [];
let allCategories = [];
let currentUser = null;
let currentEditingTransaction = null;

// CSV Import Variables
let parsedCsvData = null;
let currentImportStep = 1;

// ============================================
// INITIALIZATION
// ============================================
async function initializeTransactionsPage() {
    currentUser = await requireAuth();
    if (!currentUser) return;
    
    setupEventListeners();
    setupRealtime(currentUser.id);
    await loadPageData();
}

function setupRealtime(userId) {
    supabase
        .channel('transactions-page')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions', filter: `user_id=eq.${userId}` },
            payload => loadTransactions()
        )
        .subscribe();
}

function setupEventListeners() {
    window.addEventListener('monthChanged', loadPageData);
    window.addEventListener('monthNavReady', loadPageData);
    document.getElementById('transactionForm')?.addEventListener('submit', handleFormSubmit);
    document.getElementById('searchFilter')?.addEventListener('input', renderTransactions);
    document.getElementById('import-csv-btn')?.addEventListener('click', openCsvImportModal);
    document.getElementById('closeCsvModal')?.addEventListener('click', closeCsvImportModal);
    document.getElementById('csvImportModal')?.addEventListener('click', (e) => {
        if (e.target.id === 'csvImportModal') closeCsvImportModal();
    });
    
    // Setup drag-and-drop for CSV
    setupCsvDragAndDrop();
}

// ============================================
// TOAST NOTIFICATION SYSTEM
// ============================================
function showToast(message, type = 'info', duration = 3000) {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <div style="display: flex; align-items: center; gap: 0.75rem;">
            <i data-lucide="${type === 'success' ? 'check-circle' : type === 'error' ? 'x-circle' : 'info'}"></i>
            <span>${message}</span>
        </div>
    `;
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 1rem 1.25rem;
        background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
        color: white;
        border-radius: 12px;
        box-shadow: 0 10px 25px rgba(0,0,0,0.2);
        z-index: 10001;
        animation: slideIn 0.3s ease;
        min-width: 300px;
        font-weight: 500;
    `;
    document.body.appendChild(toast);
    lucide.createIcons();
    
    if (duration > 0) {
        setTimeout(() => closeToast(toast), duration);
    }
    return toast;
}

function updateToast(toast, message, type) {
    if (toast && toast.parentNode) {
        const icon = type === 'success' ? 'check-circle' : type === 'error' ? 'x-circle' : 'info';
        const bg = type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6';
        toast.innerHTML = `
            <div style="display: flex; align-items: center; gap: 0.75rem;">
                <i data-lucide="${icon}"></i>
                <span>${message}</span>
            </div>
        `;
        toast.style.background = bg;
        lucide.createIcons();
    }
}

function closeToast(toast) {
    if (toast && toast.parentNode) {
        toast.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }
}

// ============================================
// CSV IMPORT FUNCTIONS
// ============================================
async function openCsvImportModal() {
    const modal = document.getElementById('csvImportModal');
    const select = document.getElementById('csvAccount');
    if (!modal || !select) return;

    try {
        const { data, error } = await supabase.from('accounts').select('name').order('name');
        if (error) throw error;
        select.innerHTML = data.length > 0
            ? '<option value="">Select Account</option>' + data.map(acc => `<option value="${acc.name}">${acc.name}</option>`).join('')
            : '<option value="">No accounts found</option>';
    } catch (err) {
        console.error('Error fetching accounts:', err);
        select.innerHTML = '<option value="">Error loading accounts</option>';
    }
    
    parsedCsvData = null;
    currentImportStep = 1;
    modal.classList.add('active');
}

function closeCsvImportModal() {
    const modal = document.getElementById('csvImportModal');
    if (modal) modal.classList.remove('active');
    const csvUpload = document.getElementById('csv-upload');
    if (csvUpload) csvUpload.value = '';
    parsedCsvData = null;
    currentImportStep = 1;
}

function parseCsvDate(dateString) {
    if (!dateString || typeof dateString !== 'string') return new Date().toISOString().slice(0, 10);
    const parsedDate = new Date(dateString);
    if (!isNaN(parsedDate)) return parsedDate.toISOString().slice(0, 10);
    const parts = dateString.split('/');
    if (parts.length === 3) {
        const [month, day, year] = parts;
        return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
    return new Date().toISOString().slice(0, 10);
}

function findHeader(fields, possibleNames) {
    for (const name of possibleNames) {
        const found = fields.find(f => f.toLowerCase() === name.toLowerCase());
        if (found) return found;
    }
    return null;
}

async function handleCsvUpload(file, account) {
    if (!account) {
        showToast('Please select an account first', 'error');
        return;
    }
    
    // Check if categories are loaded
    if (!allCategories || allCategories.length === 0) {
        showToast('Please wait for budget categories to load...', 'error');
        await loadCategories();
        if (allCategories.length === 0) {
            showToast('No budget categories found. Please create some categories in the Budget page first.', 'error', 5000);
            return;
        }
    }

    const loadingToast = showToast('Parsing CSV file...', 'info', 0);

    Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: false,
        beforeFirstChunk: chunk => {
            const lines = chunk.split('\n');
            const headerIndex = lines.findIndex(line => 
                line.toLowerCase().includes('date') && 
                line.toLowerCase().includes('amount')
            );
            return headerIndex !== -1 ? lines.slice(headerIndex).join('\n') : chunk;
        },
        complete: async (results) => {
            try {
                const headerMap = {
                    date: findHeader(results.meta.fields, ['Date', 'Transaction Date', 'Posting Date', 'Posted Date']),
                    merchant: findHeader(results.meta.fields, ['Description', 'Merchant', 'Payee', 'Name', 'Memo']),
                    amount: findHeader(results.meta.fields, ['Amount', 'Value', 'Debit', 'Credit', 'Transaction Amount']),
                };

                if (!headerMap.date || !headerMap.merchant || !headerMap.amount) {
                    closeToast(loadingToast);
                    showToast('CSV must contain Date, Description, and Amount columns', 'error');
                    return;
                }

                const uncategorized = results.data
                    .map(row => {
                        let amount = parseFloat(row[headerMap.amount]);
                        
                        if (isNaN(amount)) {
                            const cleanAmount = row[headerMap.amount]?.toString().replace(/[$,\s]/g, '');
                            amount = parseFloat(cleanAmount);
                        }
                        
                        return {
                            merchant: (row[headerMap.merchant] || 'Unspecified').trim(),
                            amount: amount,
                            day: parseCsvDate(row[headerMap.date]),
                        };
                    })
                    .filter(t => {
                        if (isNaN(t.amount) || t.amount === 0) return false;
                        const merchant = t.merchant.toLowerCase();
                        return !merchant.includes('beginning balance') && 
                               !merchant.includes('ending balance') &&
                               !merchant.includes('balance forward');
                    });

                if (uncategorized.length === 0) {
                    closeToast(loadingToast);
                    showToast('No valid transactions found in CSV', 'error');
                    return;
                }

                const existingSignatures = new Set(
                    transactions.map(t => `${t.day}|${t.merchant.toLowerCase().trim()}|${Math.abs(t.amount).toFixed(2)}`)
                );

                const withDuplicateFlag = uncategorized.map(t => ({
                    ...t,
                    isDuplicate: existingSignatures.has(
                        `${t.day}|${t.merchant.toLowerCase().trim()}|${Math.abs(t.amount).toFixed(2)}`
                    )
                }));

                // Apply learned categorizations first
                updateToast(loadingToast, `Checking learned patterns...`, 'info');
                const withLearnedCategories = await applyLearnedCategories(withDuplicateFlag);
                
                // Separate learned vs needs AI
                const alreadyCategorized = withLearnedCategories.filter(t => t.learned);
                const needsAI = withLearnedCategories.filter(t => !t.learned);
                
                console.log(`🧠 ${alreadyCategorized.length} auto-categorized from learning`);
                console.log(`🤖 ${needsAI.length} need AI categorization`);

                let aiCategorized = [];
                let stats = null;
                
                // Only call AI if there are uncategorized transactions
                if (needsAI.length > 0) {
                    updateToast(loadingToast, `Categorizing ${needsAI.length} transactions with AI...`, 'info');

                    const { data: { session } } = await supabase.auth.getSession();
                    
                    console.log('Calling AI with:', {
                        transactionCount: needsAI.length,
                        categoryCount: allCategories.length,
                        categories: allCategories
                    });
                    
                    const { data: categorizedData, error: aiError } = await supabase.functions.invoke('swift-function', {
                        headers: { 'Authorization': `Bearer ${session.access_token}` },
                        body: { 
                            transactions: needsAI.map(t => ({ ...t, amount: Math.abs(t.amount) })),
                            categories: allCategories 
                        },
                    });

                    if (aiError) {
                        console.error('AI Error:', aiError);
                        throw aiError;
                    }
                    
                    console.log('AI Response:', categorizedData);

                    if (!categorizedData || !categorizedData.transactions) {
                        throw new Error('Invalid response from AI categorization service');
                    }
                    
                    aiCategorized = needsAI.map((t, i) => ({
                        ...t,
                        category: categorizedData.transactions[i]?.category || 'Uncategorized'
                    }));
                    
                    stats = categorizedData.stats;
                } else {
                    console.log('✓ All transactions auto-categorized from learning!');
                }

                // Combine learned and AI categorized
                parsedCsvData = [...alreadyCategorized, ...aiCategorized].map(t => ({
                    ...t,
                    account: account
                }));
                
                // Update stats to include learned count
                if (stats) {
                    stats.learned = alreadyCategorized.length;
                    stats.total = parsedCsvData.length;
                    stats.categorized = stats.categorized + alreadyCategorized.length;
                } else {
                    stats = {
                        total: parsedCsvData.length,
                        categorized: alreadyCategorized.length,
                        uncategorized: parsedCsvData.filter(t => t.category === 'Uncategorized').length,
                        learned: alreadyCategorized.length
                    };
                }

                console.log('Parsed CSV Data:', parsedCsvData);

                closeToast(loadingToast);
                
                try {
                    showCsvPreview(parsedCsvData, stats);
                } catch (previewError) {
                    console.error('Error showing preview:', previewError);
                    showToast('Error displaying preview. Check console for details.', 'error', 5000);
                }

            } catch (err) {
                console.error('CSV Processing Error:', err);
                closeToast(loadingToast);
                showToast(`Failed to process CSV: ${err.message}`, 'error', 5000);
            }
        },
        error: (err) => {
            console.error('CSV Parse Error:', err);
            showToast('Failed to parse CSV file. Please check the file format.', 'error');
        }
    });
}

function showCsvPreview(data, stats) {
    console.log('showCsvPreview called with:', { dataLength: data.length, stats });
    
    const modal = document.getElementById('csvImportModal');
    const modalBody = modal.querySelector('.modal-body');
    
    if (!modal || !modalBody) {
        console.error('Modal or modal body not found!');
        return;
    }
    
    const duplicateCount = data.filter(t => t.isDuplicate).length;
    const uncategorizedCount = data.filter(t => t.category === 'Uncategorized').length;
    const validCount = data.filter(t => !t.isDuplicate).length;

    modalBody.innerHTML = `
        <div class="csv-preview-container" style="display: block;">
            <div class="csv-stats">
                <div class="csv-stat-box">
                    <div class="csv-stat-number">${data.length}</div>
                    <div class="csv-stat-label">Total Transactions</div>
                </div>
                <div class="csv-stat-box">
                    <div class="csv-stat-number" style="color: #10b981;">${validCount}</div>
                    <div class="csv-stat-label">Ready to Import</div>
                </div>
                <div class="csv-stat-box">
                    <div class="csv-stat-number ${duplicateCount > 0 ? 'warning' : ''}">${duplicateCount}</div>
                    <div class="csv-stat-label">Duplicates</div>
                </div>
                <div class="csv-stat-box">
                    <div class="csv-stat-number ${uncategorizedCount > 0 ? 'warning' : ''}">${uncategorizedCount}</div>
                    <div class="csv-stat-label">Uncategorized</div>
                </div>
            </div>

            ${stats ? `
                <div style="padding: 0.75rem; background: #dbeafe; border-radius: 8px; margin-bottom: 1rem;">
                    <div style="font-size: 0.875rem; color: #1e40af;">
                        <strong>Categorization Results:</strong><br>
                        ${stats.learned > 0 ? `🧠 ${stats.learned} from learning • ` : ''}🤖 ${stats.categorized - (stats.learned || 0)} from AI • ⚠️ ${stats.uncategorized} uncategorized
                    </div>
                </div>
            ` : ''}

            <div class="csv-preview-table-container" style="max-height: 400px; overflow-y: auto; border: 1px solid var(--border); border-radius: 8px; margin-bottom: 1rem;">
                <table class="csv-preview-table" style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr>
                            <th style="padding: 0.75rem; text-align: left; font-weight: 600; border-bottom: 2px solid var(--border); background: var(--bg-secondary); position: sticky; top: 0;">Date</th>
                            <th style="padding: 0.75rem; text-align: left; font-weight: 600; border-bottom: 2px solid var(--border); background: var(--bg-secondary); position: sticky; top: 0;">Merchant</th>
                            <th style="padding: 0.75rem; text-align: left; font-weight: 600; border-bottom: 2px solid var(--border); background: var(--bg-secondary); position: sticky; top: 0;">Amount</th>
                            <th style="padding: 0.75rem; text-align: left; font-weight: 600; border-bottom: 2px solid var(--border); background: var(--bg-secondary); position: sticky; top: 0;">Category</th>
                            <th style="padding: 0.75rem; text-align: left; font-weight: 600; border-bottom: 2px solid var(--border); background: var(--bg-secondary); position: sticky; top: 0;">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.slice(0, 50).map((t, index) => `
                            <tr ${t.isDuplicate ? 'style="background: #fef3c7;"' : ''}>
                                <td style="padding: 0.75rem; border-bottom: 1px solid var(--border);">${new Date(t.day + 'T00:00:00Z').toLocaleDateString()}</td>
                                <td style="padding: 0.75rem; border-bottom: 1px solid var(--border); max-width: 300px; overflow: hidden; text-overflow: ellipsis;">${t.merchant}</td>
                                <td style="padding: 0.75rem; border-bottom: 1px solid var(--border); font-weight: 600;">${formatCurrency(Math.abs(t.amount))}</td>
                                <td style="padding: 0.75rem; border-bottom: 1px solid var(--border);">
                                    <select class="preview-category-select" data-index="${index}" style="
                                        padding: 0.25rem 0.5rem; 
                                        background: ${t.category === 'Uncategorized' ? '#fef3c7' : '#dcfce7'}; 
                                        color: ${t.category === 'Uncategorized' ? '#92400e' : '#166534'};
                                        border: 1px solid ${t.category === 'Uncategorized' ? '#fbbf24' : '#86efac'};
                                        border-radius: 4px; 
                                        font-size: 0.875rem;
                                        font-weight: 500;
                                        cursor: pointer;
                                    ">
                                        <option value="Uncategorized" ${t.category === 'Uncategorized' ? 'selected' : ''}>Uncategorized</option>
                                        ${allCategories.map(cat => `<option value="${cat}" ${t.category === cat ? 'selected' : ''}>${cat}</option>`).join('')}
                                    </select>
                                    ${t.learned ? `<span style="display: inline-block; margin-left: 0.5rem; padding: 0.125rem 0.375rem; background: #a78bfa; color: white; border-radius: 4px; font-size: 0.7rem; font-weight: 600;">🧠 LEARNED</span>` : ''}
                                </td>
                                <td style="padding: 0.75rem; border-bottom: 1px solid var(--border);">
                                    ${t.isDuplicate ? `
                                        <span style="display: inline-flex; align-items: center; gap: 0.25rem; padding: 0.125rem 0.5rem; background: #f59e0b; color: white; border-radius: 12px; font-size: 0.75rem; font-weight: 600;">
                                            <i data-lucide="alert-circle" style="width: 12px; height: 12px;"></i>
                                            Duplicate
                                        </span>
                                    ` : '<span style="color: #10b981; font-weight: 500;">✓ New</span>'}
                                </td>
                            </tr>
                        `).join('')}
                        ${data.length > 50 ? `
                            <tr>
                                <td colspan="5" style="text-align: center; color: var(--text-muted); padding: 1rem; border-bottom: 1px solid var(--border);">
                                    Showing first 50 of ${data.length} transactions
                                </td>
                            </tr>
                        ` : ''}
                    </tbody>
                </table>
            </div>

            <div style="display: flex; flex-direction: column; gap: 1rem; padding: 1rem; background: var(--bg-secondary); border-radius: 8px; margin-bottom: 1.5rem;">
                <div style="display: flex; align-items: center; gap: 0.75rem;">
                    <input type="checkbox" id="skipDuplicates" ${duplicateCount > 0 ? 'checked' : 'disabled'} style="width: 18px; height: 18px; cursor: pointer;">
                    <label for="skipDuplicates" style="cursor: pointer; user-select: none;">Skip ${duplicateCount} duplicate transaction(s)</label>
                </div>
                <div style="display: flex; align-items: center; gap: 0.75rem;">
                    <input type="checkbox" id="tagUncategorized" ${uncategorizedCount > 0 ? 'checked' : 'disabled'} style="width: 18px; height: 18px; cursor: pointer;">
                    <label for="tagUncategorized" style="cursor: pointer; user-select: none;">Tag ${uncategorizedCount} uncategorized transaction(s) for review</label>
                </div>
            </div>

            <div style="display: flex; gap: 0.75rem;">
                <button class="btn-csv-import secondary" onclick="closeCsvImportModal()" style="flex: 1; display: flex; align-items: center; justify-content: center; gap: 0.5rem; padding: 0.875rem; border-radius: 8px; font-weight: 600; cursor: pointer; border: none; font-size: 1rem; background: var(--bg-secondary); color: var(--text-primary); border: 1px solid var(--border);">
                    <i data-lucide="x"></i>
                    Cancel
                </button>
                <button class="btn-csv-import primary" onclick="confirmImport()" style="flex: 1; display: flex; align-items: center; justify-content: center; gap: 0.5rem; padding: 0.875rem; border-radius: 8px; font-weight: 600; cursor: pointer; border: none; font-size: 1rem; background: linear-gradient(135deg, var(--primary), var(--accent)); color: white;">
                    <i data-lucide="check"></i>
                    Import ${validCount} Transaction${validCount !== 1 ? 's' : ''}
                </button>
            </div>
        </div>
    `;

    lucide.createIcons();
    
    // Add event listeners to category dropdowns
    document.querySelectorAll('.preview-category-select').forEach(select => {
        select.addEventListener('change', (e) => {
            const index = parseInt(e.target.dataset.index);
            const newCategory = e.target.value;
            
            // Update the data
            if (parsedCsvData[index]) {
                parsedCsvData[index].category = newCategory;
                
                // Update visual feedback
                const bgColor = newCategory === 'Uncategorized' ? '#fef3c7' : '#dcfce7';
                const textColor = newCategory === 'Uncategorized' ? '#92400e' : '#166534';
                const borderColor = newCategory === 'Uncategorized' ? '#fbbf24' : '#86efac';
                
                e.target.style.background = bgColor;
                e.target.style.color = textColor;
                e.target.style.borderColor = borderColor;
                
                // Update stats
                updatePreviewStats();
            }
        });
    });
    
    console.log('Preview rendered successfully');
}

function updatePreviewStats() {
    if (!parsedCsvData) return;
    
    const uncategorizedCount = parsedCsvData.filter(t => t.category === 'Uncategorized').length;
    const validCount = parsedCsvData.filter(t => !t.isDuplicate).length;
    
    // Update the uncategorized stat box
    const uncatStatBox = document.querySelectorAll('.csv-stat-box')[3];
    if (uncatStatBox) {
        const statNumber = uncatStatBox.querySelector('.csv-stat-number');
        if (statNumber) {
            statNumber.textContent = uncategorizedCount;
            statNumber.className = uncategorizedCount > 0 ? 'csv-stat-number warning' : 'csv-stat-number';
        }
    }
    
    // Update the import button
    const importBtn = document.querySelector('.btn-csv-import.primary');
    if (importBtn) {
        importBtn.innerHTML = `
            <i data-lucide="check"></i>
            Import ${validCount} Transaction${validCount !== 1 ? 's' : ''}
        `;
        lucide.createIcons();
    }
    
    // Update the checkbox label
    const tagCheckboxLabel = document.querySelector('label[for="tagUncategorized"]');
    if (tagCheckboxLabel) {
        tagCheckboxLabel.textContent = `Tag ${uncategorizedCount} uncategorized transaction(s) for review`;
    }
    
    const tagCheckbox = document.getElementById('tagUncategorized');
    if (tagCheckbox) {
        if (uncategorizedCount === 0) {
            tagCheckbox.disabled = true;
            tagCheckbox.checked = false;
        } else {
            tagCheckbox.disabled = false;
            tagCheckbox.checked = true;
        }
    }
}

async function confirmImport() {
    if (!parsedCsvData || parsedCsvData.length === 0) {
        showToast('No data to import', 'error');
        return;
    }

    const skipDuplicates = document.getElementById('skipDuplicates')?.checked ?? true;
    const tagUncategorized = document.getElementById('tagUncategorized')?.checked ?? true;

    const loadingToast = showToast('Importing transactions...', 'info', 0);
    closeCsvImportModal();

    try {
        const toImport = parsedCsvData.filter(t => !skipDuplicates || !t.isDuplicate);

        if (toImport.length === 0) {
            closeToast(loadingToast);
            showToast('No transactions to import after filtering', 'error');
            return;
        }

        const transactionsToInsert = toImport.map(t => ({
            user_id: currentUser.id,
            month_key: MonthNavigation.currentMonth,
            type: t.amount >= 0 ? 'income' : 'expense',
            merchant: t.merchant,
            amount: Math.abs(t.amount),
            day: t.day,
            category: t.category,
            account: t.account,
            recurring: false,
            tags: (tagUncategorized && t.category === 'Uncategorized') ? ['Needs Review', 'AI Import'] : ['AI Import']
        }));

        const { data: inserted, error: insertError } = await supabase
            .from('transactions')
            .insert(transactionsToInsert)
            .select();

        if (insertError) throw insertError;

        updateToast(loadingToast, 'Updating account balances...', 'info');
        for (const t of inserted) {
            await updateAccountBalance(t.account, t.type, t.amount, 'add');
        }

        // Save learning from successful categorizations
        updateToast(loadingToast, 'Saving learning patterns...', 'info');
        const learningPromises = inserted
            .filter(t => t.category !== 'Uncategorized')
            .map(t => saveMerchantLearning(t.merchant, t.category));
        
        await Promise.all(learningPromises);
        
        console.log(`💾 Saved ${learningPromises.length} learning pattern(s)`);

        transactions = [...inserted, ...transactions].sort((a, b) => 
            new Date(b.day) - new Date(a.day)
        );
        renderTransactions();

        closeToast(loadingToast);
        
        const skippedCount = parsedCsvData.length - toImport.length;
        const uncatCount = inserted.filter(t => t.category === 'Uncategorized').length;
        
        let message = `✓ Successfully imported ${inserted.length} transaction${inserted.length !== 1 ? 's' : ''}!`;
        if (skippedCount > 0) {
            message += `\n⏭ ${skippedCount} duplicate${skippedCount !== 1 ? 's' : ''} skipped`;
        }
        if (uncatCount > 0) {
            message += `\n⚠ ${uncatCount} marked "Uncategorized" - please review`;
        }
        
        showToast(message, 'success', 5000);

    } catch (err) {
        console.error('Import Error:', err);
        closeToast(loadingToast);
        showToast(`Import failed: ${err.message}`, 'error', 5000);
    }
}

function setupCsvDragAndDrop() {
    const uploadArea = document.getElementById('csvUploadArea');
    const fileInput = document.getElementById('csv-upload');
    
    if (!uploadArea || !fileInput) return;
    
    uploadArea.addEventListener('click', () => {
        const account = document.getElementById('csvAccount')?.value;
        if (!account) {
            showToast('Please select an account first', 'error');
            return;
        }
        fileInput.click();
    });
    
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    });
    
    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('dragover');
    });
    
    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
        
        const account = document.getElementById('csvAccount')?.value;
        if (!account) {
            showToast('Please select an account first', 'error');
            return;
        }
        
        const files = e.dataTransfer.files;
        if (files.length > 0 && files[0].name.endsWith('.csv')) {
            handleCsvUpload(files[0], account);
        } else {
            showToast('Please drop a valid CSV file', 'error');
        }
    });
    
    fileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        const account = document.getElementById('csvAccount').value;
        if (file && account) {
            handleCsvUpload(file, account);
        }
    });
}

// ============================================
// DATA LOADING
// ============================================
async function loadPageData() {
    if (!MonthNavigation.currentMonth) return;
    lucide.createIcons();
    await loadCategories();
    await populateAccountsDropdowns();
    await loadTransactions();
}

async function loadTransactions() {
    try {
        const { data, error } = await supabase.from('transactions').select('*').eq('month_key', MonthNavigation.currentMonth).order('day', { ascending: false });
        if (error) throw error;
        transactions = data || [];
        renderTransactions();
    } catch (err) {
        console.error('Error loading transactions:', err);
    }
}

async function loadCategories() {
    try {
        const budgetData = await BudgetData.getMonthData(MonthNavigation.currentMonth);
        allCategories = (budgetData.expenses || []).map(exp => exp.name).filter(Boolean);
        populateCategoryDropdown();
    } catch (err) {
        console.error('Error loading categories:', err);
    }
}

// ============================================
// FORM HANDLING
// ============================================
async function handleFormSubmit(event) {
    event.preventDefault();
    
    if (!currentUser) {
        alert('You must be logged in to add a transaction.');
        return;
    }
    
    const type = document.getElementById('type').value;
    const account = document.getElementById('account').value;
    const amount = parseFloat(document.getElementById('amount').value);
    
    const transaction = {
        user_id: currentUser.id,
        month_key: MonthNavigation.currentMonth,
        type: type,
        merchant: document.getElementById('merchant').value,
        amount: amount,
        day: document.getElementById('day').value,
        category: type === 'transfer' ? 'Transfer' : document.getElementById('category').value,
        account: account,
        recurring: document.getElementById('recurring').checked,
        transfer_to_account: null,
        tags: []
    };
    
    if (type === 'transfer') {
        const transferToAccount = document.getElementById('transferToAccount').value;
        
        if (!transferToAccount) {
            alert('Please select a destination account for the transfer.');
            return;
        }
        
        if (account === transferToAccount) {
            alert('Cannot transfer to the same account.');
            return;
        }
        
        transaction.transfer_to_account = transferToAccount;
    }
    
    try {
        const { error } = await supabase
            .from('transactions')
            .insert([transaction]);
        
        if (error) throw error;
        
        if (type === 'transfer') {
            await updateAccountBalanceForTransfer(account, transaction.transfer_to_account, amount, 'add');
        } else {
            await updateAccountBalance(account, type, amount, 'add');
        }
        
        resetForm();
        await loadTransactions();
        
    } catch (err) {
        console.error('Error adding transaction:', err);
        alert('Failed to add transaction. Check console for details.');
    }
}

function resetForm() {
    const transactionForm = document.getElementById('transactionForm');
    if (transactionForm) {
        transactionForm.reset();
    }
    
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    
    const dateInput = document.getElementById('day');
    if (dateInput) {
        dateInput.value = `${yyyy}-${mm}-${dd}`;
    }
    
    const typeButtons = document.querySelectorAll('.type-toggle .toggle-btn');
    typeButtons.forEach(btn => btn.classList.remove('active'));
    
    const expenseBtn = document.querySelector('.toggle-btn[data-type="expense"]');
    if (expenseBtn) {
        expenseBtn.classList.add('active');
    }
    
    const typeInput = document.getElementById('type');
    if (typeInput) {
        typeInput.value = 'expense';
    }
    
    populateCategoryDropdown();
}

// ============================================
// EDIT TRANSACTION MODAL
// ============================================
function openEditModal(transaction) {
    currentEditingTransaction = transaction;
    
    const modal = document.getElementById('editTransactionModal');
    if (!modal) return;
    
    document.getElementById('editMerchant').value = transaction.merchant;
    document.getElementById('editAmount').value = transaction.amount;
    document.getElementById('editDay').value = transaction.day;
    document.getElementById('editCategory').value = transaction.category || '';
    document.getElementById('editAccount').value = transaction.account;
    document.getElementById('editRecurring').checked = transaction.recurring;
    
    const typeButtons = document.querySelectorAll('#editTransactionModal .toggle-btn');
    typeButtons.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.type === transaction.type);
    });
    
    if (transaction.type === 'transfer') {
        document.getElementById('editTransferToAccountGroup').style.display = 'block';
        document.getElementById('editCategoryGroup').style.display = 'none';
        document.getElementById('editTransferToAccount').value = transaction.transfer_to_account || '';
    } else {
        document.getElementById('editTransferToAccountGroup').style.display = 'none';
        document.getElementById('editCategoryGroup').style.display = 'block';
    }
    
    modal.classList.add('active');
    lucide.createIcons();
}

async function handleEditSubmit(event) {
    event.preventDefault();
    
    if (!currentEditingTransaction) return;
    
    const oldTransaction = {...currentEditingTransaction};
    const type = document.querySelector('#editTransactionModal .toggle-btn.active').dataset.type;
    const account = document.getElementById('editAccount').value;
    const amount = parseFloat(document.getElementById('editAmount').value);
    
    const updates = {
        type: type,
        merchant: document.getElementById('editMerchant').value,
        amount: amount,
        day: document.getElementById('editDay').value,
        category: type === 'transfer' ? 'Transfer' : document.getElementById('editCategory').value,
        account: account,
        recurring: document.getElementById('editRecurring').checked,
        transfer_to_account: null
    };
    
    if (type === 'transfer') {
        updates.transfer_to_account = document.getElementById('editTransferToAccount').value;
    }
    
    try {
        if (oldTransaction.type === 'transfer') {
            await updateAccountBalanceForTransfer(oldTransaction.account, oldTransaction.transfer_to_account, oldTransaction.amount, 'reverse');
        } else {
            await updateAccountBalance(oldTransaction.account, oldTransaction.type, oldTransaction.amount, 'reverse');
        }
        
        const { error } = await supabase.from('transactions').update(updates).eq('id', currentEditingTransaction.id);
        if (error) throw error;
        
        if (type === 'transfer') {
            await updateAccountBalanceForTransfer(account, updates.transfer_to_account, amount, 'add');
        } else {
            await updateAccountBalance(account, type, amount, 'add');
        }
        
        closeEditModal();
        await loadTransactions();
        
    } catch (err) {
        console.error('Error updating transaction:', err);
        alert('Failed to update transaction.');
    }
}

function closeEditModal() {
    const modal = document.getElementById('editTransactionModal');
    if (modal) modal.classList.remove('active');
    currentEditingTransaction = null;
}

// ============================================
// TAG TRANSACTION MODAL
// ============================================
function openTagModal(transaction) {
    currentEditingTransaction = transaction;
    
    const modal = document.getElementById('tagTransactionModal');
    if (!modal) return;
    
    const tagContainer = document.getElementById('tagInputContainer');
    tagContainer.innerHTML = '';
    
    (transaction.tags || []).forEach(tag => addTagToContainer(tag, tagContainer));
    
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'tag-input';
    input.placeholder = 'Type tags separated by commas...';
    tagContainer.appendChild(input);
    
    modal.classList.add('active');
    input.focus();
}

function addTagToContainer(tagText, container) {
    const tagItem = document.createElement('div');
    tagItem.className = 'tag-item';
    tagItem.innerHTML = `<span>${tagText}</span><button type="button" class="tag-remove">×</button>`;
    tagItem.querySelector('.tag-remove').addEventListener('click', () => tagItem.remove());
    container.insertBefore(tagItem, container.querySelector('.tag-input'));
}

async function handleTagSubmit() {
    if (!currentEditingTransaction) return;
    
    const tagContainer = document.getElementById('tagInputContainer');
    const existingTags = Array.from(tagContainer.querySelectorAll('.tag-item span')).map(span => span.textContent);
    const input = tagContainer.querySelector('.tag-input');
    const newTags = input ? input.value.trim().split(',').map(t => t.trim()).filter(Boolean) : [];
    const tags = [...new Set([...existingTags, ...newTags])];
    
    try {
        const { error } = await supabase.from('transactions').update({ tags }).eq('id', currentEditingTransaction.id);
        if (error) throw error;
        closeTagModal();
        await loadTransactions();
    } catch (err) {
        console.error('Error updating tags:', err);
        alert('Failed to update tags.');
    }
}

function closeTagModal() {
    const modal = document.getElementById('tagTransactionModal');
    if (modal) modal.classList.remove('active');
    currentEditingTransaction = null;
}

// ============================================
// SPLIT TRANSACTION MODAL
// ============================================
function openSplitModal(transaction) {
    currentEditingTransaction = transaction;
    
    const modal = document.getElementById('splitTransactionModal');
    if (!modal) return;
    
    document.getElementById('splitOriginalAmount').textContent = formatCurrency(transaction.amount);
    const splitsContainer = document.getElementById('splitsContainer');
    splitsContainer.innerHTML = '';
    
    addSplitItem(transaction.amount / 2);
    addSplitItem(transaction.amount / 2);
    
    updateSplitSummary();
    modal.classList.add('active');
    lucide.createIcons();
}

function addSplitItem(amount = 0) {
    const splitsContainer = document.getElementById('splitsContainer');
    const splitItem = document.createElement('div');
    splitItem.className = 'split-item';
    splitItem.innerHTML = `
        <select class="split-category" required><option value="">Category</option>${allCategories.map(c => `<option value="${c}">${c}</option>`).join('')}</select>
        <input type="number" class="split-amount" placeholder="0.00" step="0.01" value="${amount}" required>
        <button type="button" class="btn-remove-split"><i data-lucide="x"></i></button>`;
    
    splitItem.querySelector('.btn-remove-split').addEventListener('click', () => {
        if (splitsContainer.children.length > 2) {
            splitItem.remove();
            updateSplitSummary();
        } else {
            alert('You must have at least 2 splits.');
        }
    });
    
    splitItem.querySelector('.split-amount').addEventListener('input', updateSplitSummary);
    splitsContainer.appendChild(splitItem);
    lucide.createIcons();
}

function updateSplitSummary() {
    if (!currentEditingTransaction) return;
    
    const originalAmount = currentEditingTransaction.amount;
    const totalSplit = Array.from(document.querySelectorAll('.split-item .split-amount'))
                           .reduce((sum, input) => sum + (parseFloat(input.value) || 0), 0);
    
    document.getElementById('splitSummary').textContent = formatCurrency(totalSplit);
    document.getElementById('splitDifference').textContent = formatCurrency(originalAmount - totalSplit);
    document.querySelector('.split-summary').classList.toggle('error', Math.abs(originalAmount - totalSplit) > 0.001);
}

async function handleSplitSubmit(event) {
    event.preventDefault();
    if (!currentEditingTransaction) return;

    const originalAmount = currentEditingTransaction.amount;
    let totalSplit = 0;
    const splitData = Array.from(document.querySelectorAll('.split-item')).map(split => {
        const category = split.querySelector('.split-category').value;
        const amount = parseFloat(split.querySelector('.split-amount').value) || 0;
        totalSplit += amount;
        return { category, amount };
    });

    if (Math.abs(originalAmount - totalSplit) > 0.001) {
        alert('Split amounts must equal the original transaction amount.');
        return;
    }

    try {
        await supabase.from('transactions').delete().eq('id', currentEditingTransaction.id);
        await updateAccountBalance(currentEditingTransaction.account, currentEditingTransaction.type, currentEditingTransaction.amount, 'reverse');

        const newTransactions = splitData.map(split => ({
            ...currentEditingTransaction,
            id: undefined,
            amount: split.amount,
            category: split.category,
            tags: [...(currentEditingTransaction.tags || []), 'Split Transaction'],
        }));
        
        const { error: insertError } = await supabase.from('transactions').insert(newTransactions);
        if (insertError) throw insertError;

        for (const split of splitData) {
            await updateAccountBalance(currentEditingTransaction.account, currentEditingTransaction.type, split.amount, 'add');
        }
        
        closeSplitModal();
        await loadTransactions();
    } catch (err) {
        console.error('Error splitting transaction:', err);
        alert('Failed to split transaction.');
    }
}

function closeSplitModal() {
    const modal = document.getElementById('splitTransactionModal');
    if (modal) modal.classList.remove('active');
    currentEditingTransaction = null;
}

// ============================================
// DELETE TRANSACTION
// ============================================
async function handleTransactionDelete(transactionId) {
    const transaction = transactions.find(t => t.id === parseInt(transactionId));
    if (!transaction || !confirm('Are you sure you want to delete this transaction?')) return;

    try {
        const { error } = await supabase.from('transactions').delete().eq('id', transactionId);
        if (error) throw error;

        if (transaction.type === 'transfer') {
            await updateAccountBalanceForTransfer(transaction.account, transaction.transfer_to_account, transaction.amount, 'reverse');
        } else {
            await updateAccountBalance(transaction.account, transaction.type, transaction.amount, 'reverse');
        }
        await loadTransactions();
    } catch (err) {
        console.error("Error deleting transaction:", err);
        alert('Failed to delete transaction.');
    }
}

// ============================================
// ACCOUNT BALANCE MANAGEMENT
// ============================================
async function updateAccountBalance(accountName, transactionType, amount, operation) {
    if (!accountName) return;

    try {
        const { data: account, error: fetchError } = await supabase.from('accounts').select('balance, type').eq('name', accountName).maybeSingle();
        if (fetchError || !account) throw fetchError || new Error("Account not found");

        const currentBalance = parseFloat(account.balance) || 0;
        const transactionAmount = parseFloat(amount) || 0;
        let newBalance;

        const opMultiplier = (operation === 'add') ? 1 : -1;
        const typeMultiplier = (transactionType === 'income') ? 1 : -1;
        const accountMultiplier = (account.type === 'debt') ? -1 : 1;

        newBalance = currentBalance + (opMultiplier * typeMultiplier * accountMultiplier * transactionAmount);
        
        const { error: updateError } = await supabase.from('accounts').update({ balance: newBalance }).eq('name', accountName);
        if (updateError) throw updateError;
    } catch (err) {
        console.error('Error updating account balance:', err);
        throw err;
    }
}

async function updateAccountBalanceForTransfer(fromAccount, toAccount, amount, operation) {
    try {
        await Promise.all([
            updateAccountBalance(fromAccount, 'expense', amount, operation),
            updateAccountBalance(toAccount, 'income', amount, operation)
        ]);
    } catch (err) {
        console.error('Error updating balances for transfer:', err);
        throw err;
    }
}

// ============================================
// UI RENDERING
// ============================================
async function populateAccountsDropdowns() {
    try {
        const { data, error } = await supabase.from('accounts').select('name, type').order('name');
        if (error) throw error;
        const options = data && data.length > 0
            ? '<option value="">Select Account</option>' + data.map(acc => `<option value="${acc.name}">${acc.name}</option>`).join('')
            : '<option value="">No accounts available</option>';
        ['account', 'transferToAccount', 'editAccount', 'editTransferToAccount'].forEach(id => {
            const select = document.getElementById(id);
            if (select) select.innerHTML = options;
        });
    } catch (err) {
        console.error("Error fetching accounts:", err);
    }
}

function populateCategoryDropdown() {
    const type = document.getElementById('type')?.value;
    const categorySelect = document.getElementById('category');
    if (!categorySelect) return;
    
    let options = '<option value="">Select Category</option>';
    if (type === 'income') {
        options += '<option value="Salary">Salary</option><option value="Other Income">Other Income</option>';
    } else {
        options += allCategories.map(c => `<option value="${c}">${c}</option>`).join('') + '<option value="Other">Other</option>';
    }
    categorySelect.innerHTML = options;
}

function renderTransactions() {
    const transactionsListEl = document.getElementById('transactionsList');
    if (!transactionsListEl) return;
    
    const searchTerm = document.getElementById('searchFilter')?.value.toLowerCase() || '';
    const filtered = transactions.filter(t => 
        Object.values(t).some(val => val && val.toString().toLowerCase().includes(searchTerm))
    );

    if (filtered.length === 0) {
        transactionsListEl.innerHTML = '<li class="list-item-empty"><p>No transactions found for this month.</p></li>';
        return;
    }

    transactionsListEl.innerHTML = filtered.map(t => {
        let type, icon, accountInfo;
        if (t.type === 'transfer') {
            type = 'transfer'; icon = 'arrow-right-left'; accountInfo = `${t.account} → ${t.transfer_to_account}`;
        } else {
            type = t.type; icon = (type === 'income' ? 'plus' : 'minus'); accountInfo = t.account || 'No account';
        }
        
        const tagsHtml = t.tags && t.tags.length > 0 ? `<div class="transaction-tags">${t.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}</div>` : '';
        const date = new Date(t.day + 'T00:00:00Z');
        
        return `
            <li class="transaction-item" data-id="${t.id}">
                <div class="transaction-icon ${type}"><i data-lucide="${icon}"></i></div>
                <div class="transaction-details">
                    <div class="name">${t.merchant}</div>
                    <div class="category">${accountInfo}</div>
                    ${tagsHtml}
                </div>
                <div class="transaction-info">
                    <div class="amount ${type}">${formatCurrency(t.amount)}</div>
                    <div class="date">${date.toLocaleDateString(undefined, { timeZone: 'UTC' })}</div>
                </div>
                <button class="transaction-menu-btn"><i data-lucide="more-vertical"></i></button>
                <div class="transaction-dropdown">
                    <button class="transaction-dropdown-item" data-action="edit"><i data-lucide="edit-2"></i><span>Edit</span></button>
                    <button class="transaction-dropdown-item" data-action="tag"><i data-lucide="tag"></i><span>Tag</span></button>
                    <button class="transaction-dropdown-item" data-action="split"><i data-lucide="split"></i><span>Split</span></button>
                    <button class="transaction-dropdown-item danger" data-action="delete"><i data-lucide="trash-2"></i><span>Delete</span></button>
                </div>
            </li>`;
    }).join('');
    
    lucide.createIcons();
    
    document.querySelectorAll('.transaction-menu-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const dropdown = btn.nextElementSibling;
            document.querySelectorAll('.transaction-dropdown.visible').forEach(d => {
                if (d !== dropdown) d.classList.remove('visible');
            });
            dropdown.classList.toggle('visible');
        });
    });
    
    document.querySelectorAll('.transaction-dropdown-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.stopPropagation();
            const action = item.dataset.action;
            const transactionId = item.closest('.transaction-item').dataset.id;
            const transaction = transactions.find(t => t.id === parseInt(transactionId));
            if (!transaction) return;
            
            switch(action) {
                case 'edit': openEditModal(transaction); break;
                case 'tag': openTagModal(transaction); break;
                case 'split': openSplitModal(transaction); break;
                case 'delete': handleTransactionDelete(transactionId); break;
            }
        });
    });
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount || 0);
}

// ============================================
// INITIALIZE ON PAGE LOAD
// ============================================
window.addEventListener('DOMContentLoaded', initializeTransactionsPage);

// Add toast CSS animations
const toastStyles = document.createElement('style');
toastStyles.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(400px);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(400px);
            opacity: 0;
        }
    }
    .toast i {
        width: 20px;
        height: 20px;
    }
`;
document.head.appendChild(toastStyles);
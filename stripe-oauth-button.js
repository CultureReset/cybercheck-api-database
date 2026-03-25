// ============================================
// Stripe OAuth Button Component
// Add this to your dashboard's connections/settings page
// ============================================

/**
 * Initialize Stripe OAuth Button
 * Call this on your connections page
 */
async function initStripeOAuth() {
    const connectBtn = document.getElementById('stripe-connect-btn');
    const manualKeyForm = document.getElementById('stripe-manual-key-form');
    const statusDiv = document.getElementById('stripe-status');

    if (!connectBtn) return;

    // Load current status
    await loadStripeStatus();

    // Connect with Stripe button
    connectBtn.addEventListener('click', async () => {
        try {
            connectBtn.disabled = true;
            connectBtn.textContent = 'Redirecting to Stripe...';

            const response = await fetch('/api/stripe/connect-url', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to get Stripe OAuth URL');
            }

            const { url } = await response.json();
            window.location.href = url; // Redirect to Stripe OAuth
        } catch (err) {
            connectBtn.disabled = false;
            connectBtn.textContent = 'Connect with Stripe';
            alert('Error: ' + err.message);
        }
    });

    // Manual key form submission
    if (manualKeyForm) {
        manualKeyForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const keyInput = document.getElementById('stripe-secret-key');
            const submitBtn = manualKeyForm.querySelector('button[type="submit"]');

            try {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Saving...';

                const response = await fetch('/api/stripe/save-key', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                    },
                    body: JSON.stringify({
                        secret_key: keyInput.value.trim()
                    })
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error || 'Failed to save key');
                }

                alert(`✅ ${data.mode === 'live' ? 'Live' : 'Test'} key saved successfully!`);
                keyInput.value = '';
                await loadStripeStatus();
            } catch (err) {
                alert('❌ Error: ' + err.message);
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Save Key';
            }
        });
    }
}

/**
 * Load and display Stripe connection status
 */
async function loadStripeStatus() {
    const statusDiv = document.getElementById('stripe-status');
    if (!statusDiv) return;

    try {
        const response = await fetch('/api/stripe/status', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
            }
        });

        if (!response.ok) throw new Error('Failed to load status');

        const data = await response.json();
        let html = '<h3>Stripe Status</h3>';

        // OAuth Connection Status
        if (data.connected) {
            html += `
                <div class="stripe-connected">
                    <p>✅ <strong>Connected via Stripe Connect</strong></p>
                    <p>Account ID: ${data.accountId}</p>
                    <p>Connected: ${new Date(data.connectedAt).toLocaleDateString()}</p>
                    <button onclick="disconnectStripe()" class="btn-danger">Disconnect</button>
                </div>
            `;
        } else {
            html += `<p>Not connected via OAuth</p>`;
        }

        // Manual Key Status
        if (data.manualKey) {
            html += `
                <div class="stripe-manual">
                    <p>✅ <strong>Manual Key Added</strong></p>
                    <p>Added: ${new Date(data.manualKeyAt).toLocaleDateString()}</p>
                    <button onclick="deleteStripeKey()" class="btn-danger">Remove Key</button>
                </div>
            `;
        }

        statusDiv.innerHTML = html;
    } catch (err) {
        console.error('Status load error:', err);
    }
}

/**
 * Disconnect Stripe OAuth
 */
async function disconnectStripe() {
    if (!confirm('Are you sure? This will disconnect your Stripe account.')) return;

    try {
        const response = await fetch('/api/stripe/disconnect', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
            }
        });

        if (!response.ok) throw new Error('Failed to disconnect');

        alert('✅ Disconnected from Stripe');
        await loadStripeStatus();
    } catch (err) {
        alert('❌ Error: ' + err.message);
    }
}

/**
 * Delete manual Stripe key
 */
async function deleteStripeKey() {
    if (!confirm('Are you sure? Your saved Stripe key will be removed.')) return;

    try {
        const response = await fetch('/api/stripe/delete-key', {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
            }
        });

        if (!response.ok) throw new Error('Failed to delete key');

        alert('✅ Stripe key removed');
        await loadStripeStatus();
    } catch (err) {
        alert('❌ Error: ' + err.message);
    }
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', initStripeOAuth);

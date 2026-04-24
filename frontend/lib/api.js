const API_BASE = typeof window !== 'undefined'
    ? (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
        ? 'http://127.0.0.1:8080'
        : ''
    : '';

async function apiRequest(endpoint, body) {
    const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.details || err.error || `Server responded with ${res.status}`);
    }

    return res.json();
}

export async function generateTimeline(context) {
    return apiRequest('/api/timeline', context);
}

export async function sendChatMessage(message, userContext = {}, conversationHistory = []) {
    return apiRequest('/api/chat', { message, userContext, conversationHistory });
}

export async function getElectionData(address) {
    return apiRequest('/api/election-data', { address });
}

export async function explainStep(step, userContext = {}) {
    return apiRequest('/api/explain-step', { step, userContext });
}

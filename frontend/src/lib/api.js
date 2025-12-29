const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1'

async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`

  // Destructure to avoid spreading headers twice
  const { headers: optionHeaders, ...restOptions } = options

  const config = {
    ...restOptions,
    headers: {
      'Content-Type': 'application/json',
      ...optionHeaders
    }
  }

  console.log('API Request:', url, config)

  try {
    const response = await fetch(url, config)
    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.message || 'Request failed')
    }

    return data
  } catch (error) {
    if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
      throw new Error('Unable to connect to server. Please ensure the backend is running.')
    }
    throw error
  }
}

export const api = {
  // Health check
  health: () => request('/health', { method: 'GET' }),

  // Credentials
  issueCredential: (data) => request('/credentials/issue', {
    method: 'POST',
    body: JSON.stringify(data)
  }),

  verifyCommitment: (commitment) => request(`/credentials/verify-commitment/${commitment}`, {
    method: 'GET'
  }),

  getIssuers: () => request('/credentials/issuers', { method: 'GET' }),

  // Verification
  verifyProof: (type, data) => request(`/verify/${type}`, {
    method: 'POST',
    body: JSON.stringify(data)
  }),

  generateProof: (type, privateInputs, publicInputs) => request('/verify/generate-proof', {
    method: 'POST',
    body: JSON.stringify({ type, privateInputs, publicInputs })
  }),

  getVerificationHistory: (limit = 50, offset = 0) =>
    request(`/verify/history?limit=${limit}&offset=${offset}`, { method: 'GET' }),

  getVerificationStatus: () => request('/verify/status', { method: 'GET' }),

  // QR Code verification flow
  createVerificationRequest: (verificationType, verifierName) =>
    request('/verify/request', {
      method: 'POST',
      body: JSON.stringify({ verificationType, verifierName })
    }),

  getVerificationRequest: (requestId) =>
    request(`/verify/request/${requestId}`, { method: 'GET' }),

  completeVerificationRequest: (requestId, data) =>
    request(`/verify/request/${requestId}/complete`, {
      method: 'POST',
      body: JSON.stringify(data)
    })
}

export default api

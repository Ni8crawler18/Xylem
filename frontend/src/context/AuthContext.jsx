import { createContext, useContext, useState, useEffect } from 'react'

const AuthContext = createContext(null)

// Preset users
const USERS = {
  'user@eigenparse.com': {
    password: 'eigenparse',
    role: 'user',
    name: 'Demo User'
  },
  'verifier@eigenparse.com': {
    password: 'zkproof',
    role: 'verifier',
    name: 'Demo Verifier'
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check localStorage for existing session
    const savedUser = localStorage.getItem('eigenparse_user')
    if (savedUser) {
      setUser(JSON.parse(savedUser))
    }
    setLoading(false)
  }, [])

  const login = (email, password) => {
    const userRecord = USERS[email]

    if (!userRecord) {
      return { success: false, error: 'User not found' }
    }

    if (userRecord.password !== password) {
      return { success: false, error: 'Invalid password' }
    }

    const userData = {
      email,
      role: userRecord.role,
      name: userRecord.name
    }

    setUser(userData)
    localStorage.setItem('eigenparse_user', JSON.stringify(userData))

    return { success: true, user: userData }
  }

  const logout = () => {
    setUser(null)
    localStorage.removeItem('eigenparse_user')
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

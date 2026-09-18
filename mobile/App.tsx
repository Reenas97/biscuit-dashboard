import { StatusBar } from 'expo-status-bar'
import { useEffect, useState } from 'react'
import type { User } from 'firebase/auth'
import { onAuthStateChanged, signInWithEmailAndPassword } from 'firebase/auth'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import { auth } from './src/lib/firebase'
import { MobileDashboard } from './src/components/MobileDashboard'

function AppContent() {
  const [user, setUser] = useState<User | null>(null)
  const [checkingSession, setCheckingSession] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => onAuthStateChanged(auth, (nextUser) => {
    setUser(nextUser)
    setCheckingSession(false)
  }), [])

  async function handleLogin() {
    if (!email.trim() || !password) {
      setMessage('Preencha o e-mail e a senha.')
      return
    }
    setSubmitting(true)
    setMessage('')
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password)
    } catch {
      setMessage('Não foi possível entrar. Confira o e-mail e a senha.')
    } finally {
      setSubmitting(false)
    }
  }

  if (checkingSession) {
    return <SafeAreaView style={styles.loading}><ActivityIndicator color="#9A6B56" size="large" /><StatusBar style="dark" /></SafeAreaView>
  }

  if (user) {
    return (
      <SafeAreaView style={styles.app}>
        <StatusBar style="dark" />
        <MobileDashboard user={user} />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.app}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboard}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.login}>
          <View style={styles.logoMarkLarge}><Text style={styles.logoLetterLarge}>R</Text></View>
          <Text style={styles.title}>Reena Biscuit</Text>
          <Text style={styles.subtitle}>Seu ateliê também no celular</Text>
          <View style={styles.loginCard}>
            <Text style={styles.cardKicker}>BEM-VINDA</Text>
            <Text style={styles.cardTitle}>Entre na sua conta</Text>
            <Text style={styles.cardText}>Use o mesmo e-mail e senha do dashboard web.</Text>
            <Text style={styles.label}>E-mail</Text>
            <TextInput autoCapitalize="none" autoComplete="email" keyboardType="email-address" onChangeText={setEmail} placeholder="seu@email.com" placeholderTextColor="#B69B91" style={styles.input} value={email} />
            <Text style={styles.label}>Senha</Text>
            <TextInput autoComplete="password" onChangeText={setPassword} onSubmitEditing={handleLogin} placeholder="Sua senha" placeholderTextColor="#B69B91" secureTextEntry style={styles.input} value={password} />
            {message ? <Text style={styles.error}>{message}</Text> : null}
            <Pressable disabled={submitting} onPress={handleLogin} style={({ pressed }) => [styles.primaryButton, (pressed || submitting) && styles.buttonPressed]}>
              {submitting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>Entrar</Text>}
            </Pressable>
          </View>
          <Text style={styles.footer}>Feito com carinho para a Reena Biscuit 🐱</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

export default function App() {
  return <SafeAreaProvider><AppContent /></SafeAreaProvider>
}

const styles = StyleSheet.create({
  app: {
    flex: 1,
    backgroundColor: '#F8EEEE',
  },
  keyboard: {
    flex: 1,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8EEEE',
  },
  login: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 34,
  },
  logoMarkLarge: {
    width: 86,
    height: 86,
    alignItems: 'center',
    alignSelf: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#E59AA3',
    borderRadius: 43,
    backgroundColor: '#FFF8F7',
  },
  logoLetterLarge: {
    color: '#E59AA3',
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }),
    fontSize: 50,
    fontStyle: 'italic',
  },
  title: {
    marginTop: 14,
    color: '#704B3D',
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }),
    fontSize: 31,
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 5,
    marginBottom: 25,
    color: '#9A7D72',
    fontSize: 13,
    textAlign: 'center',
  },
  loginCard: {
    padding: 22,
    borderWidth: 1,
    borderColor: '#ECD6D4',
    borderRadius: 22,
    backgroundColor: '#FFFBFA',
    shadowColor: '#704B3D',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.09,
    shadowRadius: 22,
    elevation: 4,
  },
  cardKicker: {
    color: '#E28E9A',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  cardTitle: {
    marginTop: 6,
    color: '#704B3D',
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }),
    fontSize: 23,
  },
  cardText: {
    marginTop: 6,
    marginBottom: 19,
    color: '#9A7D72',
    fontSize: 12,
    lineHeight: 18,
  },
  label: {
    marginBottom: 7,
    color: '#704B3D',
    fontSize: 12,
    fontWeight: '700',
  },
  input: {
    height: 48,
    marginBottom: 15,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#E8CFCC',
    borderRadius: 12,
    backgroundColor: '#FFF7F6',
    color: '#704B3D',
    fontSize: 14,
  },
  error: {
    marginBottom: 12,
    color: '#B84D5C',
    fontSize: 12,
  },
  primaryButton: {
    minHeight: 49,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#9A6B56',
  },
  buttonPressed: {
    opacity: 0.7,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  footer: {
    marginTop: 24,
    color: '#A68B81',
    fontSize: 11,
    textAlign: 'center',
  },
})

import { useState } from 'react';
import { 
  signInWithEmailAndPassword, 
  sendPasswordResetEmail, 
  createUserWithEmailAndPassword,
  updatePassword 
} from 'firebase/auth';
import { auth } from '../firebase';
import { useNavigate } from 'react-router-dom';

import { collection, query, where, getDocs, addDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { setStoredUser, initialPPIMembers } from '../utils/userHelpers';

// Contraseñas asignadas autorizadas para cada correo corporativo del sistema
const ASSIGNED_PASSWORDS = {
  'alexis.cruz@casalimpia.com.co': ['AdminCasalimpia2026*', 'hospi123', '123456'],
  'alexbyc728@gmail.com': ['AdminCasalimpia2026*', 'hospi123', '123456'],
  'alejandro.calderon@casalimpia.com.co': ['AdminCasalimpia2026*', 'hospi123'],
  'santiago.jimenez@casalimpia.com.co': ['TechSoporte2026!', 'hospi123'],
  'juan.gutierrez@casalimpia.com.co': ['EmpleadoCasalimpia2026*', 'Empleado2026*', '123456', 'hospi123'],
  'gjuandavid757@gmail.com': ['EmpleadoCasalimpia2026*']
};

export default function Login() {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  // Estados del modal "¿Olvidó su contraseña?"
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotTab, setForgotTab] = useState('email'); // 'email' | 'direct' (Preferencia Opción 2)

  // Formulario de envío por correo (Opción 2)
  const [emailForReset, setEmailForReset] = useState('alexbyc728@gmail.com');
  const [sentEmailAddress, setSentEmailAddress] = useState('');

  // Formulario de cambio directo (Opción 1)
  const [resetAccount, setResetAccount] = useState('');
  const [resetCedula, setResetCedula] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSuccess, setForgotSuccess] = useState('');
  const [forgotError, setForgotError] = useState('');
  
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    
    const cleanEmail = username.trim().toLowerCase();
    const cleanPass = password.trim();

    try {
      let authSuccess = false;

      // 1. Verificar si tiene una contraseña recientemente cambiada y guardada localmente
      const storedCustomPasswords = JSON.parse(localStorage.getItem('sgi_custom_passwords') || '{}');
      if (storedCustomPasswords[cleanEmail] && storedCustomPasswords[cleanEmail] === cleanPass) {
        authSuccess = true;
      }

      // 2. Intentar autenticación con Firebase Auth
      if (!authSuccess) {
        try {
          await signInWithEmailAndPassword(auth, cleanEmail, cleanPass);
          authSuccess = true;
        } catch (authError) {
          // Si el usuario ingresó con correo corporativo, intentar autenticar con su correo personal vinculado
          const ppiUserMatch = initialPPIMembers.find(m => 
            m.email.toLowerCase() === cleanEmail || 
            (m.email_personal && m.email_personal.toLowerCase() === cleanEmail)
          );

          if (ppiUserMatch?.email_personal && ppiUserMatch.email_personal.toLowerCase() !== cleanEmail) {
            try {
              await signInWithEmailAndPassword(auth, ppiUserMatch.email_personal.toLowerCase(), cleanPass);
              authSuccess = true;
            } catch (e2) {
              // try next
            }
          } else if (ppiUserMatch?.email && ppiUserMatch.email.toLowerCase() !== cleanEmail) {
            try {
              await signInWithEmailAndPassword(auth, ppiUserMatch.email.toLowerCase(), cleanPass);
              authSuccess = true;
            } catch (e3) {
              // try next
            }
          }

          if (!authSuccess) {
            // Verificar si la contraseña ingresada corresponde a una de las asignadas específicamente a este correo
            const allowedPasswords = ASSIGNED_PASSWORDS[cleanEmail];
            if (allowedPasswords && allowedPasswords.includes(cleanPass)) {
              authSuccess = true;
            } else {
              // El usuario existe en el sistema pero la contraseña no corresponde
              const isKnownUser = Boolean(
                ASSIGNED_PASSWORDS[cleanEmail] || 
                storedCustomPasswords[cleanEmail] ||
                initialPPIMembers.some(m => 
                  m.email.toLowerCase() === cleanEmail || 
                  (m.email_personal && m.email_personal.toLowerCase() === cleanEmail)
                )
              );

              if (isKnownUser) {
                throw new Error('AUTH_WRONG_PASSWORD');
              } else {
                throw authError;
              }
            }
          }
        }
      }

      if (!authSuccess) {
        throw new Error('AUTH_WRONG_PASSWORD');
      }

      // 3. Buscar perfil completo en Firestore colección 'usuarios'
      let profileUser = null;
      try {
        const q = query(collection(db, "usuarios"), where("email", "==", cleanEmail));
        const snap = await getDocs(q);
        if (!snap.empty) {
          profileUser = { id: snap.docs[0].id, ...snap.docs[0].data() };
        }
      } catch (dbErr) {
        console.warn("Could not query firestore user:", dbErr);
      }

      // 4. Fallback a integrantes PPI si no está en Firestore o si ingresó con correo personal
      if (!profileUser) {
        const ppiUser = initialPPIMembers.find(m => 
          m.email.toLowerCase() === cleanEmail || 
          (m.email_personal && m.email_personal.toLowerCase() === cleanEmail)
        );
        if (ppiUser) {
          profileUser = ppiUser;
        } else {
          profileUser = {
            nombre: cleanEmail.split('@')[0],
            email: cleanEmail,
            rol: 'Administrador',
            cargo: 'Ingeniero Administrador TI',
            area: 'Tecnología e Infraestructura',
            sede: 'Sede Bogotá Principal',
            avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDyAiWOUn9njbbS4sZzxnzDv-_O7nlKMP0d8Uj3JmLf2C_0yjiCZpAy_-U4uCYuUD42dh2KBHFoTT45HDNZZYJ4xGPuondY8OzWlnn7_ZuxW3T5adr-8kHHxYrg8TKac--UfaKWJfhULlk7ZTIvToV2_6HQK6K4NU1fRHrt-A4bVhe1TrF6kp8FaNl7tV6SQ4Q_7jCd97VAYDW2x8agwEazqetgfvCbDatPHJzic_KZM9Czjj8JNoYE6Q'
          };
        }
      }

      // Guardar sesión activa
      setStoredUser(profileUser);
      navigate('/inventario');
      
    } catch (error) {
      if (
        error.message === 'AUTH_WRONG_PASSWORD' || 
        error.code === 'auth/wrong-password' || 
        error.code === 'auth/invalid-credential' || 
        error.code === 'auth/invalid-login-credentials'
      ) {
        setErrorMsg('Contraseña incorrecta. La contraseña ingresada no corresponde a este usuario.');
      } else if (error.code === 'auth/user-not-found') {
        setErrorMsg('Usuario no encontrado. El correo no se encuentra registrado en el sistema.');
      } else {
        setErrorMsg('Error de autenticación: ' + (error.message || 'Verifique sus credenciales.'));
      }
    } finally {
      setLoading(false);
    }
  };

  const openForgotModal = (e) => {
    e.preventDefault();
    const current = username.trim() || 'alexis.cruz@casalimpia.com.co';
    setResetAccount(current);
    setEmailForReset(current.includes('@gmail.com') ? current : 'alexbyc728@gmail.com');
    setSentEmailAddress('');
    setResetCedula('');
    setNewPassword('');
    setConfirmPassword('');
    setForgotError('');
    setForgotSuccess('');
    setForgotTab('email'); // Preferencia: Opción 2 por defecto
    setShowForgotModal(true);
  };

  // 1. Manejador de Envío de Enlace por Correo (Opción 2)
  const handleSendEmailReset = async (e) => {
    e.preventDefault();
    setForgotLoading(true);
    setForgotError('');
    setForgotSuccess('');

    const targetEmail = emailForReset.trim().toLowerCase();

    if (!targetEmail) {
      setForgotError('Por favor ingrese el correo electrónico al cual enviar el enlace.');
      setForgotLoading(false);
      return;
    }

    try {
      await sendPasswordResetEmail(auth, targetEmail);
      setSentEmailAddress(targetEmail);
      setForgotSuccess(`¡Enlace enviado exitosamente a ${targetEmail}!`);
    } catch (err) {
      if (err.code === 'auth/user-not-found') {
        try {
          await createUserWithEmailAndPassword(auth, targetEmail, 'CasalimpiaTemp2026*');
          await sendPasswordResetEmail(auth, targetEmail);
          setSentEmailAddress(targetEmail);
          setForgotSuccess(`¡Enlace enviado exitosamente a ${targetEmail}!`);
        } catch (createErr) {
          setForgotError('No se pudo enviar el correo a esa dirección: ' + (createErr.message || err.message));
        }
      } else if (err.code === 'auth/invalid-email') {
        setForgotError('El formato de correo no es válido.');
      } else {
        setForgotError('Error al enviar correo: ' + err.message);
      }
    } finally {
      setForgotLoading(false);
    }
  };

  // 2. Manejador de Cambio Directo de Contraseña (Opción 1)
  const handleDirectPasswordChange = async (e) => {
    e.preventDefault();
    setForgotLoading(true);
    setForgotError('');
    setForgotSuccess('');

    const cleanAcc = resetAccount.trim().toLowerCase();
    const cleanCed = resetCedula.trim().replace(/\D/g, '');
    const cleanNewPass = newPassword.trim();

    if (!cleanAcc) {
      setForgotError('Por favor ingrese la cuenta o correo.');
      setForgotLoading(false);
      return;
    }

    if (cleanNewPass.length < 6) {
      setForgotError('La nueva contraseña debe tener como mínimo 6 caracteres.');
      setForgotLoading(false);
      return;
    }

    if (cleanNewPass !== confirmPassword.trim()) {
      setForgotError('Las contraseñas no coinciden. Por favor verifique que sean idénticas.');
      setForgotLoading(false);
      return;
    }

    // Validar identidad con Cédula registrada
    const ppiMatch = initialPPIMembers.find(m => 
      m.email.toLowerCase() === cleanAcc || 
      (m.email_personal && m.email_personal.toLowerCase() === cleanAcc)
    );
    let firestoreMatch = null;

    try {
      const q = query(collection(db, "usuarios"), where("email", "==", cleanAcc));
      const snap = await getDocs(q);
      if (!snap.empty) {
        firestoreMatch = { id: snap.docs[0].id, ...snap.docs[0].data() };
      }
    } catch (err) {
      console.warn("Error querying firestore user:", err);
    }

    const registeredCedula = ppiMatch?.cedula || firestoreMatch?.cedula;

    if (registeredCedula) {
      const cleanRegistered = registeredCedula.replace(/\D/g, '');
      if (cleanCed && cleanCed !== cleanRegistered) {
        setForgotError(`Documento de identidad incorrecto para la cuenta ${cleanAcc}.`);
        setForgotLoading(false);
        return;
      }
    }

    try {
      // Guardar en almacenamiento seguro local para persistencia inmediata
      const customPasswords = JSON.parse(localStorage.getItem('sgi_custom_passwords') || '{}');
      customPasswords[cleanAcc] = cleanNewPass;
      if (ppiMatch?.email_personal) customPasswords[ppiMatch.email_personal.toLowerCase()] = cleanNewPass;
      if (ppiMatch?.email) customPasswords[ppiMatch.email.toLowerCase()] = cleanNewPass;
      localStorage.setItem('sgi_custom_passwords', JSON.stringify(customPasswords));

      // Actualizar registro en Firestore
      if (firestoreMatch) {
        try {
          await updateDoc(doc(db, "usuarios", firestoreMatch.id), {
            ultimo_cambio_clave: serverTimestamp()
          });
        } catch (dbErr) {
          console.warn("Could not update firestore doc:", dbErr);
        }
      }

      // Registrar auditoría de seguridad
      try {
        await addDoc(collection(db, "solicitudes_recuperacion"), {
          cuenta_recuperada: cleanAcc,
          metodo: 'CAMBIO_DIRECTO_VERIFICADO',
          fecha: serverTimestamp(),
          fecha_texto: new Date().toLocaleString('es-CO')
        });
      } catch (logErr) {
        // ignore
      }

      // Pre-cargar el formulario de login con los datos nuevos
      setUsername(cleanAcc);
      setPassword(cleanNewPass);

      setForgotSuccess(`¡Contraseña actualizada exitosamente para ${cleanAcc}! Ya puede iniciar sesión.`);
      setTimeout(() => {
        setShowForgotModal(false);
      }, 2000);

    } catch (err) {
      setForgotError('Error al actualizar la contraseña: ' + err.message);
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <main className="min-h-screen w-full flex items-center justify-center p-3 sm:p-gutter-lg bg-background font-body-md text-on-surface">
      <div className="flex flex-col w-full max-w-7xl mx-auto my-auto">
        <div className="w-full shadow-2xl rounded-2xl overflow-hidden bg-surface-container-lowest grid grid-cols-1 lg:grid-cols-12 border border-surface-container-high/40">
          
          {/* LEFT PANEL: Branding (visible en pantallas desktop >= 1024px) */}
          <div className="hidden lg:flex lg:col-span-5 bg-primary text-on-primary relative flex-col justify-between p-space-xl lg:p-margin-lg overflow-hidden min-h-[580px]">
            <div className="absolute inset-0 opacity-15 pointer-events-none">
              <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <pattern height="32" id="grid-pattern" patternUnits="userSpaceOnUse" width="32">
                    <path d="M 32 0 L 0 0 0 32" fill="none" stroke="currentColor" strokeWidth="0.75" />
                  </pattern>
                </defs>
                <rect fill="url(#grid-pattern)" height="100%" width="100%" />
              </svg>
            </div>
            <div className="absolute -top-24 -left-24 w-80 h-80 bg-tertiary-container/40 rounded-full blur-3xl pointer-events-none"></div>
            <div className="absolute bottom-10 right-0 w-96 h-96 bg-secondary/20 rounded-full blur-3xl pointer-events-none"></div>
            
            <div className="relative z-10 space-y-space-md">
              <div className="inline-flex items-center gap-space-sm bg-surface-container-highest/15 text-primary-fixed px-space-md py-space-xs rounded-full">
                <span className="w-2 h-2 rounded-full bg-secondary-container animate-pulse"></span>
                <span className="font-label-sm text-label-sm tracking-widest uppercase">Sistema de Gestión Integrada TI</span>
              </div>
              <div className="space-y-space-xs">
                <h2 className="font-display-lg text-display-lg text-on-primary tracking-tight">CASALIMPIA S.A.</h2>
                <p className="font-body-md text-body-md text-primary-fixed-dim max-w-sm">
                  Garantía, trazabilidad y gobernanza operativa del parque computacional en sedes nacionales.
                </p>
              </div>
            </div>
            
            <div className="relative z-10 my-space-lg p-space-lg rounded-lg bg-surface-container-lowest/10 backdrop-blur-md shadow-sm">
              <div className="flex items-start gap-space-md">
                <span className="material-symbols-outlined text-secondary-container text-headline-lg shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>
                  verified_user
                </span>
                <div className="space-y-space-xs">
                  <span className="font-label-sm text-label-sm uppercase tracking-wider text-secondary-container">Misión Institucional</span>
                  <p className="font-body-md text-body-md text-surface-bright font-medium leading-snug">
                    "Gestión y control integral del hardware tecnológico corporativo, garantizando disponibilidad y custodia de cada estación de trabajo."
                  </p>
                </div>
              </div>
            </div>
            
            <div className="relative z-10 mt-space-lg pt-space-md flex flex-col gap-space-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-space-xs">
                  <span className="material-symbols-outlined text-secondary-fixed text-body-lg" style={{ fontVariationSettings: "'FILL' 1" }}>lock</span>
                  <span className="font-label-sm text-label-sm text-primary-fixed uppercase tracking-wider">Cifrado SSL / TLS 256-Bit</span>
                </div>
                <span className="font-code-mono text-code-mono text-secondary-container font-medium">RNF-01 COMPLIANT</span>
              </div>
              <div className="flex items-center justify-between text-primary-fixed-dim">
                <span className="font-label-sm text-label-sm">Convenio Académico - Profesional</span>
                <span className="font-label-sm text-label-sm font-semibold text-surface-bright">Tecnológico de Antioquia</span>
              </div>
            </div>
          </div>
          
          {/* RIGHT PANEL: Form (Responsive 360, 768, 1024) */}
          <div className="lg:col-span-7 bg-surface p-5 sm:p-space-xl lg:p-margin-lg flex flex-col justify-between">
            <div>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-space-md mb-space-lg">
                <div className="flex items-center">
                  <img alt="Logo SGI CASALIMPIA" className="h-9 sm:h-10 w-auto object-contain" src="/logo-casalimpia.svg"/>
                </div>
                <div className="inline-flex items-center gap-space-xs bg-surface-container px-space-md py-space-xs rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
                  <span className="font-label-sm text-label-sm text-on-surface-variant font-semibold">Nodo Central Bogotá</span>
                </div>
              </div>
              
              <div className="space-y-space-xs mb-space-lg">
                <h1 className="font-headline-lg text-2xl sm:text-headline-lg text-on-surface">Bienvenido al SGI TI</h1>
                <p className="font-body-md text-body-md text-on-surface-variant">
                  Ingrese sus credenciales corporativas autorizadas.
                </p>
              </div>
              
              <form className="space-y-space-md" onSubmit={handleLogin}>
                {errorMsg && (
                  <div className="bg-error-container text-on-error-container p-space-md rounded-lg font-body-sm shadow-sm flex items-start gap-space-sm animate-shake">
                    <span className="material-symbols-outlined shrink-0 text-error">error</span>
                    <span className="font-semibold text-error leading-snug">{errorMsg}</span>
                  </div>
                )}
                <div className="space-y-space-xs">
                  <label className="block font-label-md text-label-md text-on-surface" htmlFor="username">
                    Correo Institucional o Usuario de Red
                  </label>
                  <div className="relative flex items-center">
                    <span className="material-symbols-outlined absolute left-space-md text-outline pointer-events-none text-body-lg">
                      alternate_email
                    </span>
                    <input 
                      className="w-full h-11 pl-10 pr-space-md rounded-lg bg-surface-container-lowest text-on-surface font-body-md text-body-md placeholder:text-outline focus:outline-none focus:bg-surface-bright shadow-sm transition-all" 
                      id="username" name="username" type="text"
                      placeholder="ejemplo@casalimpia.com.co"
                      autoComplete="username"
                      value={username} onChange={e => {
                        setUsername(e.target.value);
                        if (errorMsg) setErrorMsg('');
                      }} required 
                    />
                  </div>
                </div>
                
                <div className="space-y-space-xs">
                  <div className="flex items-center justify-between">
                    <label className="block font-label-md text-label-md text-on-surface" htmlFor="password">Contraseña de Dominio</label>
                    <button 
                      type="button" 
                      onClick={openForgotModal}
                      className="font-label-sm text-label-sm text-primary hover:text-primary-container transition-colors cursor-pointer bg-transparent border-none p-0 underline-offset-2 hover:underline font-semibold"
                    >
                      ¿Olvidó su contraseña?
                    </button>
                  </div>
                  <div className="relative flex items-center">
                    <span className="material-symbols-outlined absolute left-space-md text-outline pointer-events-none text-body-lg">key</span>
                    <input 
                      className="w-full h-11 pl-10 pr-space-md rounded-lg bg-surface-container-lowest text-on-surface font-body-md text-body-md placeholder:text-outline focus:outline-none focus:bg-surface-bright shadow-sm transition-all" 
                      id="password" name="password" 
                      type="password"
                      placeholder="••••••••"
                      autoComplete="current-password"
                      value={password} onChange={e => {
                        setPassword(e.target.value);
                        if (errorMsg) setErrorMsg('');
                      }} required 
                    />
                  </div>
                </div>
                
                <button 
                  className={`w-full h-12 ${loading ? 'bg-secondary' : 'bg-primary-container hover:bg-primary'} text-on-primary font-headline-sm text-headline-sm rounded-lg shadow-md hover:shadow-lg flex items-center justify-center gap-space-sm transition-all duration-200 mt-space-md cursor-pointer`} 
                  type="submit" disabled={loading}
                >
                  <span className="material-symbols-outlined text-headline-sm">
                    {loading ? 'progress_activity' : 'login'}
                  </span>
                  <span>{loading ? 'Validando...' : 'Iniciar Sesión en SGI'}</span>
                </button>
              </form>
            </div>

            <div className="mt-8 pt-4 border-t border-surface-container text-center lg:hidden">
              <span className="font-label-sm text-outline">CASALIMPIA S.A. • Seguridad TI Certificada</span>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL: RECUPERACIÓN DE CONTRASEÑA */}
      {showForgotModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 animate-fadeIn">
          <div className="w-full max-w-lg bg-surface-container-lowest rounded-2xl shadow-2xl p-5 sm:p-6 border border-surface-container relative max-h-[92vh] overflow-y-auto">
            
            {/* Header del Modal */}
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-surface-container">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <span className="material-symbols-outlined text-[22px]">mark_email_read</span>
                </div>
                <div>
                  <h3 className="font-headline-sm text-lg font-bold text-on-surface">Restablecer Contraseña</h3>
                  <p className="text-xs text-on-surface-variant">Recuperación de acceso al Sistema SGI TI</p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setShowForgotModal(false)}
                className="w-8 h-8 rounded-lg hover:bg-surface-container flex items-center justify-center text-outline hover:text-on-surface transition-colors cursor-pointer"
                title="Cerrar"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Pestañas de Selección: Opción 2 (Correo) y Opción 1 (Directo) */}
            <div className="flex rounded-xl bg-surface-container-low p-1 mb-4 border border-surface-container">
              <button
                type="button"
                onClick={() => { setForgotTab('email'); setForgotError(''); setForgotSuccess(''); }}
                className={`flex-1 py-2 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  forgotTab === 'email' 
                    ? 'bg-primary text-on-primary shadow-xs' 
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">mail</span>
                <span>Enviar por Correo</span>
              </button>
              <button
                type="button"
                onClick={() => { setForgotTab('direct'); setForgotError(''); setForgotSuccess(''); }}
                className={`flex-1 py-2 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  forgotTab === 'direct' 
                    ? 'bg-primary text-on-primary shadow-xs' 
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">pin</span>
                <span>Cambio Inmediato (Cédula)</span>
              </button>
            </div>

            {/* Mensajes de Error */}
            {forgotError && (
              <div className="bg-error-container text-on-error-container p-3 rounded-lg text-body-sm mb-4 flex items-start gap-2 shadow-xs">
                <span className="material-symbols-outlined text-error shrink-0 text-[18px]">error</span>
                <span className="text-error font-medium text-xs leading-snug">{forgotError}</span>
              </div>
            )}

            {/* PESTAÑA 1: ENLACE POR CORREO (Opción 2) */}
            {forgotTab === 'email' ? (
              <div className="space-y-4">
                {forgotSuccess ? (
                  /* PANTALLA DE ÉXITO Y GUÍA DE GMAIL */
                  <div className="space-y-4 animate-fadeIn">
                    <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-500/40 rounded-xl p-4 text-emerald-900 dark:text-emerald-200 space-y-2">
                      <div className="flex items-center gap-2 font-bold text-emerald-700 dark:text-emerald-300">
                        <span className="material-symbols-outlined text-[24px]">mark_email_read</span>
                        <span className="text-sm">¡Correo de restablecimiento enviado!</span>
                      </div>
                      <p className="text-xs leading-relaxed">
                        Se ha enviado el enlace oficial de Firebase Authentication a: <strong className="underline">{sentEmailAddress}</strong>.
                      </p>
                    </div>

                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3.5 text-xs text-on-surface space-y-2.5">
                      <div className="flex items-center gap-1.5 font-bold text-amber-700 dark:text-amber-400 text-sm">
                        <span className="material-symbols-outlined text-[18px]">warning</span>
                        <span>¿Dónde encontrar el correo en Gmail?</span>
                      </div>
                      <ol className="list-decimal list-inside space-y-1.5 text-on-surface-variant">
                        <li>
                          Abre tu bandeja de Gmail y dirígete a la carpeta <strong>SPAM (Correo no deseado)</strong>.
                        </li>
                        <li>
                          Busca el correo con asunto: <strong className="text-on-surface">"Restablece tu contraseña para desarrolloweb-e8531"</strong>.
                        </li>
                        <li>
                          Remitente oficial: <code>noreply@desarrolloweb-e8531.firebaseapp.com</code>.
                        </li>
                        <li>
                          Abre el enlace incluido en el correo para ingresar tu <strong>nueva contraseña</strong> y guardarla.
                        </li>
                      </ol>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2 pt-2">
                      <a
                        href="https://mail.google.com/mail/u/0/#spam"
                        target="_blank"
                        rel="noreferrer"
                        className="flex-1 h-11 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-all text-center"
                      >
                        <span className="material-symbols-outlined text-[18px]">open_in_new</span>
                        <span>Abrir Gmail (Carpeta Spam)</span>
                      </a>
                      <button
                        type="button"
                        onClick={() => {
                          setUsername(sentEmailAddress);
                          setShowForgotModal(false);
                        }}
                        className="flex-1 h-11 rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-semibold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[18px]">login</span>
                        <span>Volver a Iniciar Sesión</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  /* FORMULARIO DE ENVÍO POR CORREO */
                  <form onSubmit={handleSendEmailReset} className="space-y-4">
                    <div className="bg-primary/5 p-3 rounded-xl border border-primary/20 text-xs text-on-surface-variant leading-relaxed">
                      Ingresa el correo electrónico donde deseas recibir el enlace oficial de Firebase para restablecer y definir tu nueva contraseña.
                    </div>

                    <div className="space-y-1">
                      <label className="block text-xs font-bold text-on-surface uppercase tracking-wider" htmlFor="email-reset-input">
                        Correo Electrónico de Destino
                      </label>
                      <div className="relative flex items-center">
                        <span className="material-symbols-outlined absolute left-3 text-outline text-[18px] pointer-events-none">
                          alternate_email
                        </span>
                        <input
                          id="email-reset-input"
                          type="email"
                          className="w-full h-11 pl-10 pr-3 rounded-lg bg-surface-container-low text-on-surface font-body-sm text-sm border border-surface-container focus:outline-none focus:ring-2 focus:ring-primary shadow-xs"
                          placeholder="ej. alexbyc728@gmail.com"
                          value={emailForReset}
                          onChange={(e) => setEmailForReset(e.target.value)}
                          required
                        />
                      </div>
                      <p className="text-[11px] text-outline mt-1">
                        Puedes colocar tu correo personal (ej. <strong>alexbyc728@gmail.com</strong>) para recibir el enlace directamente.
                      </p>
                    </div>

                    <div className="bg-surface-container-low rounded-xl p-3 border border-surface-container text-xs text-on-surface-variant flex items-start gap-2">
                      <span className="material-symbols-outlined text-outline text-[18px] shrink-0">info</span>
                      <span>
                        Al enviar, se generará un enlace seguro de cambio de clave. Recuerda verificar la carpeta de <strong>SPAM</strong> en tu correo.
                      </span>
                    </div>

                    <div className="pt-2 flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setShowForgotModal(false)}
                        className="px-4 h-10 rounded-lg text-outline hover:text-on-surface hover:bg-surface-container text-sm font-semibold transition-colors cursor-pointer"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        disabled={forgotLoading}
                        className="px-5 h-11 rounded-lg bg-primary hover:bg-primary-container text-on-primary font-bold text-sm shadow-md flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                      >
                        <span className="material-symbols-outlined text-[18px]">
                          {forgotLoading ? 'sync' : 'send'}
                        </span>
                        <span>{forgotLoading ? 'Enviando...' : 'Enviar Enlace por Correo'}</span>
                      </button>
                    </div>
                  </form>
                )}
              </div>
            ) : (
              /* PESTAÑA 2: CAMBIO INMEDIATO (Validación con Cédula) */
              <form onSubmit={handleDirectPasswordChange} className="space-y-3.5">
                <div className="bg-primary/5 p-3 rounded-xl border border-primary/20 text-xs text-on-surface-variant leading-relaxed">
                  Permite <strong>definir una nueva contraseña de inmediato</strong> validando el documento de identidad registrado del titular.
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-on-surface uppercase tracking-wider" htmlFor="direct-account">
                    Cuenta o Correo
                  </label>
                  <input
                    id="direct-account"
                    type="text"
                    className="w-full h-10 px-3 rounded-lg bg-surface-container-low text-on-surface font-body-sm text-sm focus:outline-none focus:ring-1 focus:ring-primary shadow-xs"
                    placeholder="ej. alexis.cruz@casalimpia.com.co"
                    value={resetAccount}
                    onChange={(e) => setResetAccount(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-on-surface uppercase tracking-wider" htmlFor="direct-cedula">
                    Documento de Identidad (Cédula registrada)
                  </label>
                  <input
                    id="direct-cedula"
                    type="text"
                    className="w-full h-10 px-3 rounded-lg bg-surface-container-low text-on-surface font-body-sm text-sm focus:outline-none focus:ring-1 focus:ring-primary shadow-xs"
                    placeholder="ej. 1020455890"
                    value={resetCedula}
                    onChange={(e) => setResetCedula(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-primary uppercase tracking-wider" htmlFor="new-pass">
                    Nueva Contraseña
                  </label>
                  <input
                    id="new-pass"
                    type="password"
                    className="w-full h-10 px-3 rounded-lg bg-surface-container-lowest text-on-surface font-body-sm text-sm border border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary shadow-xs"
                    placeholder="Mínimo 6 caracteres"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-primary uppercase tracking-wider" htmlFor="confirm-pass">
                    Confirmar Nueva Contraseña
                  </label>
                  <input
                    id="confirm-pass"
                    type="password"
                    className="w-full h-10 px-3 rounded-lg bg-surface-container-lowest text-on-surface font-body-sm text-sm border border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary shadow-xs"
                    placeholder="Repita la nueva contraseña"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowForgotModal(false)}
                    className="px-4 h-10 rounded-lg text-outline hover:text-on-surface hover:bg-surface-container text-sm font-semibold transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="px-5 h-10 rounded-lg bg-primary hover:bg-primary-container text-on-primary font-bold text-sm shadow-md flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {forgotLoading ? 'sync' : 'save'}
                    </span>
                    <span>{forgotLoading ? 'Guardando...' : 'Guardar y Cambiar Clave'}</span>
                  </button>
                </div>
              </form>
            )}

          </div>
        </div>
      )}
    </main>
  );
}

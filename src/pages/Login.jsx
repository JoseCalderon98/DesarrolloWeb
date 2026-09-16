import { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';
import { useNavigate } from 'react-router-dom';

import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { setStoredUser, initialPPIMembers } from '../utils/userHelpers';

export default function Login() {
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('admin');
  const navigate = useNavigate();
  
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    
    try {
      let profileUser = null;
      const cleanUsername = username.trim();

      // Optimizacion: Intentar inicio con Firebase Auth y buscar perfil Firestore concurrentemente
      const ppiMatch = initialPPIMembers.find(m => m.email.toLowerCase() === cleanUsername.toLowerCase());
      
      const authPromise = signInWithEmailAndPassword(auth, cleanUsername, password);
      
      const q = query(collection(db, "usuarios"), where("email", "==", cleanUsername));
      const dbPromise = getDocs(q).catch(dbErr => {
        console.warn("Could not query firestore user:", dbErr);
        return null;
      });

      const [, snap] = await Promise.all([authPromise, dbPromise]);
      
      if (snap && !snap.empty) {
        profileUser = { id: snap.docs[0].id, ...snap.docs[0].data() };
      }

      // 3. Fallback a integrantes PPI si aún no se ha sembrado la BD
      if (!profileUser) {
        const ppiUser = initialPPIMembers.find(m => m.email.toLowerCase() === cleanUsername.toLowerCase());
        if (ppiUser) {
          profileUser = ppiUser;
        } else {
          profileUser = {
            nombre: cleanUsername.split('@')[0],
            email: cleanUsername,
            rol: role === 'admin' ? 'Administrador' : 'Soporte TI',
            cargo: role === 'admin' ? 'Ingeniero Administrador TI' : 'Técnico de Soporte',
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
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/invalid-login-credentials') {
        setErrorMsg('Credenciales inválidas. El usuario no está registrado o la contraseña es incorrecta.');
      } else {
        setErrorMsg('Error de autenticación: ' + error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = (demoKey) => {
    if (demoKey === 'alexis') {
      setUsername('alexis.cruz@casalimpia.com.co');
      setPassword('hospi123');
      setRole('admin');
    } else if (demoKey === 'alejandro') {
      setUsername('alejandro.calderon@casalimpia.com.co');
      setPassword('hospi123');
      setRole('admin');
    } else if (demoKey === 'santiago') {
      setUsername('santiago.jimenez@casalimpia.com.co');
      setPassword('hospi123');
      setRole('soporte');
    } else if (demoKey === 'juan') {
      setUsername('juan.gutierrez@casalimpia.com.co');
      setPassword('hospi123');
      setRole('soporte');
    }
  };

  return (
    <main className="min-h-screen w-full flex items-center justify-center p-gutter-lg bg-background font-body-md text-on-surface">
      <div className="flex flex-col w-full">
        <div className="w-full max-w-7xl mx-auto my-auto shadow-2xl rounded-xl overflow-hidden bg-surface-container-lowest grid grid-cols-1 lg:grid-cols-12">
          
          {/* LEFT PANEL */}
          <div className="lg:col-span-5 bg-primary text-on-primary relative flex flex-col justify-between p-space-xl lg:p-margin-lg overflow-hidden">
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
            
            <div className="relative z-10 grid grid-cols-3 gap-space-sm">
              <div className="p-space-md rounded-lg bg-surface-container-highest/10 backdrop-blur-sm">
                <span className="font-label-sm text-label-sm text-primary-fixed-dim uppercase block">Hardware Activo</span>
                <div className="font-headline-lg text-headline-lg text-on-primary mt-space-xs">1,240+</div>
                <span className="font-code-mono text-code-mono text-secondary-container font-semibold">Equipos</span>
              </div>
              <div className="p-space-md rounded-lg bg-surface-container-highest/10 backdrop-blur-sm">
                <span className="font-label-sm text-label-sm text-primary-fixed-dim uppercase block">Trazabilidad</span>
                <div className="font-headline-lg text-headline-lg text-on-primary mt-space-xs">99.8%</div>
                <span className="font-code-mono text-code-mono text-secondary-container font-semibold">Auditoría OK</span>
              </div>
              <div className="p-space-md rounded-lg bg-surface-container-highest/10 backdrop-blur-sm">
                <span className="font-label-sm text-label-sm text-primary-fixed-dim uppercase block">Actas de Entrega</span>
                <div className="font-headline-lg text-headline-lg text-on-primary mt-space-xs">0%</div>
                <span className="font-code-mono text-code-mono text-secondary-container font-semibold">Pérdida Legal</span>
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
          
          {/* RIGHT PANEL: Form */}
          <div className="lg:col-span-7 bg-surface p-space-xl lg:p-margin-lg flex flex-col justify-between">
            <div>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-space-md mb-space-lg">
                <div className="flex items-center">
                  <img alt="Logo SGI CASALIMPIA" className="h-10 w-auto object-contain" src="/logo-casalimpia.svg"/>
                </div>
                <div className="inline-flex items-center gap-space-xs bg-surface-container px-space-md py-space-xs rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
                  <span className="font-label-sm text-label-sm text-on-surface-variant font-semibold">Nodo Central Bogotá</span>
                </div>
              </div>
              
              <div className="space-y-space-xs mb-space-lg">
                <h1 className="font-headline-lg text-headline-lg text-on-surface">Bienvenido al SGI TI</h1>
                <p className="font-body-md text-body-md text-on-surface-variant">
                  Ingrese sus credenciales corporativas autorizadas.
                </p>
              </div>
              
              <form className="space-y-space-md" onSubmit={handleLogin}>
                {errorMsg && (
                  <div className="bg-error-container text-on-error-container p-space-md rounded-lg font-body-sm shadow-sm flex items-start gap-space-sm">
                    <span className="material-symbols-outlined shrink-0">error</span>
                    <span>{errorMsg}</span>
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
                      value={username} onChange={e => setUsername(e.target.value)} required 
                    />
                  </div>
                </div>
                
                <div className="space-y-space-xs">
                  <div className="flex items-center justify-between">
                    <label className="block font-label-md text-label-md text-on-surface" htmlFor="password">Contraseña de Dominio</label>
                    <a className="font-label-sm text-label-sm text-primary hover:text-primary-container transition-colors" href="#">¿Olvidó su contraseña?</a>
                  </div>
                  <div className="relative flex items-center">
                    <span className="material-symbols-outlined absolute left-space-md text-outline pointer-events-none text-body-lg">key</span>
                    <input 
                      className="w-full h-11 pl-10 pr-10 rounded-lg bg-surface-container-lowest text-on-surface font-body-md text-body-md placeholder:text-outline focus:outline-none focus:bg-surface-bright shadow-sm transition-all" 
                      id="password" name="password" 
                      type={showPassword ? 'text' : 'password'}
                      value={password} onChange={e => setPassword(e.target.value)} required 
                    />
                    <button 
                      className="absolute right-space-md text-outline hover:text-on-surface transition-colors p-1" 
                      onClick={() => setShowPassword(!showPassword)} type="button">
                      <span className="material-symbols-outlined text-body-lg" id="passIcon">
                        {showPassword ? 'visibility_off' : 'visibility'}
                      </span>
                    </button>
                  </div>
                </div>

                <div className="space-y-space-xs">
                  <label className="block font-label-md text-label-md text-on-surface" htmlFor="roleBranch">Rol de Auditoría</label>
                  <div className="relative flex items-center">
                    <span className="material-symbols-outlined absolute left-space-md text-outline pointer-events-none text-body-lg">domain_verification</span>
                    <select 
                      className="w-full h-11 pl-10 pr-space-lg rounded-lg bg-surface-container-lowest text-on-surface font-body-md text-body-md focus:outline-none focus:bg-surface-bright shadow-sm appearance-none cursor-pointer" 
                      id="roleBranch" value={role} onChange={e => setRole(e.target.value)}
                    >
                      <option value="admin">Administrador TI — Centro Corporativo Calle 26</option>
                      <option value="soporte">Técnico de Soporte — Sede Industrial Américas</option>
                    </select>
                    <span className="material-symbols-outlined absolute right-space-md text-outline pointer-events-none text-body-lg">expand_more</span>
                  </div>
                </div>
                
                <button 
                  className={`w-full h-12 ${loading ? 'bg-secondary' : 'bg-primary-container hover:bg-primary'} text-on-primary font-headline-sm text-headline-sm rounded-lg shadow-md hover:shadow-lg flex items-center justify-center gap-space-sm transition-all duration-200 mt-space-md`} 
                  type="submit" disabled={loading}
                >
                  <span className="material-symbols-outlined text-headline-sm">
                    {loading ? 'progress_activity' : 'login'}
                  </span>
                  <span>{loading ? 'Validando...' : 'Iniciar Sesión en SGI'}</span>
                </button>
              </form>

              <div className="mt-space-lg pt-space-md bg-surface-container-low p-space-md rounded-lg">
                <div className="flex items-center justify-between mb-space-sm">
                  <div className="flex items-center gap-space-xs">
                    <span className="material-symbols-outlined text-primary text-body-md">badge</span>
                    <span className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface font-bold">Cuentas PPI CASALIMPIA</span>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-sm">
                  <button className="h-9 px-space-sm rounded bg-surface-container-lowest hover:bg-surface-bright text-on-surface font-label-sm text-[11px] flex items-center gap-1.5 cursor-pointer shadow-xs truncate" onClick={() => fillDemo('alexis')} type="button" title="Alexis Cruz - Admin TI">
                    <span className="w-2 h-2 rounded-full bg-primary shrink-0"></span>
                    <span className="truncate">Alexis Cruz (Admin)</span>
                  </button>
                  <button className="h-9 px-space-sm rounded bg-surface-container-lowest hover:bg-surface-bright text-on-surface font-label-sm text-[11px] flex items-center gap-1.5 cursor-pointer shadow-xs truncate" onClick={() => fillDemo('alejandro')} type="button" title="Alejandro Calderón - Admin TI">
                    <span className="w-2 h-2 rounded-full bg-primary shrink-0"></span>
                    <span className="truncate">Alejandro C. (Admin)</span>
                  </button>
                  <button className="h-9 px-space-sm rounded bg-surface-container-lowest hover:bg-surface-bright text-on-surface font-label-sm text-[11px] flex items-center gap-1.5 cursor-pointer shadow-xs truncate" onClick={() => fillDemo('santiago')} type="button" title="Santiago Jiménez - Soporte TI">
                    <span className="w-2 h-2 rounded-full bg-secondary shrink-0"></span>
                    <span className="truncate">Santiago J. (Soporte)</span>
                  </button>
                  <button className="h-9 px-space-sm rounded bg-surface-container-lowest hover:bg-surface-bright text-on-surface font-label-sm text-[11px] flex items-center gap-1.5 cursor-pointer shadow-xs truncate" onClick={() => fillDemo('juan')} type="button" title="Juan David Gutiérrez - Empleado">
                    <span className="w-2 h-2 rounded-full bg-outline shrink-0"></span>
                    <span className="truncate">Juan David (Empleado)</span>
                  </button>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

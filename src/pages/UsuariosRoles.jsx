import React, { useState, useEffect, useMemo } from 'react';
import { 
  collection, 
  onSnapshot, 
  query, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  writeBatch,
  serverTimestamp 
} from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { db, auth } from '../firebase';
import { ROLES, ROLE_INFO, initialPPIMembers, getStoredUser, setStoredUser } from '../utils/userHelpers';

export default function UsuariosRoles() {
  const navigate = useNavigate();
  const currentUser = getStoredUser();

  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Filtros
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterSede, setFilterSede] = useState('all');

  // Modales
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [userToEdit, setUserToEdit] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Formulario de nuevo usuario
  const [newUser, setNewUser] = useState({
    nombre: '',
    cedula: '',
    email: '',
    rol: 'Soporte TI',
    cargo: '',
    area: 'Tecnología e Infraestructura',
    sede: 'Bogotá - Av. El Dorado',
    estado: 'ACTIVO'
  });

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/');
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  // 1. Suscripción en tiempo real a la colección 'usuarios'
  useEffect(() => {
    const q = query(collection(db, "usuarios"));
    const unsub = onSnapshot(q, (snapshot) => {
      const list = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      setUsuarios(list);
      setLoading(false);
      setErrorMsg(null);
    }, (err) => {
      console.error("Error Firestore Usuarios:", err);
      setErrorMsg(err.message);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  // 2. Cálculos de Métricas de Usuarios
  const totalUsuarios = usuarios.length;
  const totalAdmins = usuarios.filter(u => u.rol === 'Administrador').length;
  const totalSoporte = usuarios.filter(u => u.rol === 'Soporte TI').length;
  const totalEmpleados = usuarios.filter(u => u.rol === 'Empleado' && u.estado === 'ACTIVO').length;

  // 3. Filtrado de Usuarios
  const filteredUsuarios = useMemo(() => {
    return usuarios.filter((user) => {
      if (searchQuery.trim()) {
        const qLower = searchQuery.toLowerCase().trim();
        const matchNombre = (user.nombre || '').toLowerCase().includes(qLower);
        const matchCedula = (user.cedula || '').toLowerCase().includes(qLower);
        const matchEmail = (user.email || '').toLowerCase().includes(qLower);
        const matchCargo = (user.cargo || '').toLowerCase().includes(qLower);
        if (!matchNombre && !matchCedula && !matchEmail && !matchCargo) return false;
      }

      if (filterRole !== 'all' && user.rol !== filterRole) return false;
      if (filterStatus !== 'all' && user.estado !== filterStatus) return false;
      if (filterSede !== 'all' && !(user.sede || '').toLowerCase().includes(filterSede.toLowerCase())) return false;

      return true;
    });
  }, [usuarios, searchQuery, filterRole, filterStatus, filterSede]);

  // Cargar los 4 Integrantes del PPI a Firestore
  const handleSeedPPIMembers = async () => {
    try {
      setIsProcessing(true);
      const batch = writeBatch(db);
      initialPPIMembers.forEach((member) => {
        const newRef = doc(collection(db, "usuarios"));
        batch.set(newRef, {
          ...member,
          createdAt: serverTimestamp()
        });
      });
      await batch.commit();
      setSuccessMsg("Integrantes del PPI cargados exitosamente a Firestore.");
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (err) {
      alert("Error al cargar integrantes: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // Crear Usuario (RF-01)
  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      setIsProcessing(true);
      const randomAvatarNum = Math.floor(1 + Math.random() * 50);
      const avatarUrl = `https://i.pravatar.cc/150?img=${randomAvatarNum}`;

      await addDoc(collection(db, "usuarios"), {
        ...newUser,
        avatar: avatarUrl,
        createdAt: serverTimestamp()
      });

      setShowCreateModal(false);
      setNewUser({
        nombre: '',
        cedula: '',
        email: '',
        rol: 'Soporte TI',
        cargo: '',
        area: 'Tecnología e Infraestructura',
        sede: 'Bogotá - Av. El Dorado',
        estado: 'ACTIVO'
      });
      setSuccessMsg(`Usuario ${newUser.nombre} registrado con éxito.`);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      alert("Error al crear usuario: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // Guardar Edición de Usuario y Rol (RF-10)
  const handleSaveEditUser = async (e) => {
    e.preventDefault();
    if (!userToEdit) return;
    try {
      setIsProcessing(true);
      const userRef = doc(db, "usuarios", userToEdit.id);
      await updateDoc(userRef, {
        nombre: userToEdit.nombre || '',
        cedula: userToEdit.cedula || '',
        email: userToEdit.email || '',
        rol: userToEdit.rol || 'Empleado',
        cargo: userToEdit.cargo || '',
        area: userToEdit.area || '',
        sede: userToEdit.sede || '',
        estado: userToEdit.estado || 'ACTIVO',
        updatedAt: serverTimestamp()
      });

      // Si se editó el usuario activo, actualizar localStorage
      if (currentUser && currentUser.email === userToEdit.email) {
        setStoredUser({ ...currentUser, ...userToEdit });
      }

      setUserToEdit(null);
      setSuccessMsg("Rol y datos de usuario actualizados correctamente.");
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      alert("Error al actualizar usuario: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // Eliminar Usuario
  const handleDeleteUser = async (user) => {
    if (window.confirm(`¿Estás seguro de eliminar el usuario ${user.nombre}? Perderá el acceso al sistema.`)) {
      try {
        await deleteDoc(doc(db, "usuarios", user.id));
        setSuccessMsg(`Usuario ${user.nombre} eliminado.`);
        setTimeout(() => setSuccessMsg(null), 3000);
      } catch (err) {
        alert("Error al eliminar usuario: " + err.message);
      }
    }
  };

  return (
    <div className="bg-background font-body-md text-on-surface antialiased min-h-screen">
      
      {/* Toast Notification */}
      {successMsg && (
        <div className="fixed bottom-5 right-5 z-50 bg-secondary text-on-secondary px-space-lg py-space-sm rounded-xl shadow-xl flex items-center gap-space-sm animate-bounce">
          <span className="material-symbols-outlined text-[20px]">verified</span>
          <span className="font-label-md font-bold">{successMsg}</span>
        </div>
      )}

      {/* ASIDE / SIDEBAR */}
      <aside className="fixed left-0 top-0 h-full w-72 bg-surface-container-low z-50 flex flex-col justify-between shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
        <div className="flex flex-col flex-1 overflow-y-auto">
          <div className="h-16 px-space-xl flex items-center gap-space-md bg-surface-container-low">
            <img 
              alt="Logo SGI CASALIMPIA" 
              className="h-9 w-9 object-contain shrink-0" 
              src="/logo-icon.svg"
            />
            <div className="flex flex-col">
              <span className="font-headline-sm text-headline-sm text-primary leading-none font-bold">SGI CASALIMPIA</span>
              <span className="font-label-sm text-label-sm text-outline tracking-wider uppercase">Activos TI</span>
            </div>
          </div>
          <div className="px-space-xl py-space-sm">
            <span className="font-label-sm text-label-sm uppercase tracking-wider text-outline">Menú Principal</span>
          </div>
          <nav className="px-space-md space-y-space-xs flex-1">
            <a 
              className="flex items-center gap-space-md px-space-md py-space-sm text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface rounded-lg transition-colors cursor-pointer"
              onClick={() => navigate('/inventario')}
            >
              <span className="material-symbols-outlined text-[20px]">grid_view</span>
              <span className="font-body-md text-body-md">Dashboard</span>
            </a>
            <a 
              className="flex items-center justify-between px-space-md py-space-sm text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface rounded-lg transition-colors cursor-pointer"
              onClick={() => navigate('/inventario')}
            >
              <div className="flex items-center gap-space-md">
                <span className="material-symbols-outlined text-[20px]">devices</span>
                <span className="font-body-md text-body-md">Inventario de Activos</span>
              </div>
            </a>
            <div className="pt-space-xs">
              <div className="flex items-center justify-between px-space-md py-space-sm text-on-surface-variant rounded-lg">
                <div className="flex items-center gap-space-md">
                  <span className="material-symbols-outlined text-[20px]">assignment_return</span>
                  <span className="font-body-md text-body-md font-semibold text-on-surface">Entrega y Recepción</span>
                </div>
                <span className="material-symbols-outlined text-[16px] text-outline">expand_more</span>
              </div>
              <div className="ml-space-lg pl-space-md space-y-space-xs mt-space-xs">
                <a 
                  className="flex items-center gap-space-sm px-space-md py-space-xs text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface rounded-lg transition-colors cursor-pointer" 
                  onClick={() => navigate('/entrega-hardware')}
                >
                  <span className="material-symbols-outlined text-[16px]">post_add</span>
                  <span className="font-body-sm text-body-sm">Nueva Entrega / Acta</span>
                </a>
                <a 
                  className="flex items-center gap-space-sm px-space-md py-space-xs text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface rounded-lg transition-colors cursor-pointer"
                  onClick={() => navigate('/devoluciones')}
                >
                  <span className="material-symbols-outlined text-[16px]">keyboard_return</span>
                  <span className="font-body-sm text-body-sm">Devoluciones (Reintegro)</span>
                </a>
                <a 
                  className="flex items-center gap-space-sm px-space-md py-space-xs text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface rounded-lg transition-colors cursor-pointer"
                  onClick={() => navigate('/historial')}
                >
                  <span className="material-symbols-outlined text-[16px]">history</span>
                  <span className="font-body-sm text-body-sm">Historial y Auditoría</span>
                </a>
              </div>
            </div>
            <a 
              className="flex items-center gap-space-md px-space-md py-space-sm text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface rounded-lg transition-colors cursor-pointer" 
              onClick={() => navigate('/inventario')}
            >
              <span className="material-symbols-outlined text-[20px]">build_circle</span>
              <span className="font-body-md text-body-md">Novedades y Mantenimiento</span>
            </a>
            <a 
              className="flex items-center gap-space-md px-space-md py-space-sm bg-primary-container text-on-primary font-headline-sm rounded-lg transition-colors cursor-pointer"
              onClick={() => {}}
            >
              <span className="material-symbols-outlined text-[20px]">admin_panel_settings</span>
              <span className="font-body-md text-body-md font-bold">Gestión de Usuarios y Roles</span>
            </a>
            <a 
              className="flex items-center gap-space-md px-space-md py-space-sm text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface rounded-lg transition-colors cursor-pointer"
              onClick={() => navigate('/inventario')}
            >
              <span className="material-symbols-outlined text-[20px]">verified_user</span>
              <span className="font-body-md text-body-md">Reportes y Auditoría</span>
            </a>
          </nav>
        </div>
        <div className="p-space-lg m-space-md bg-surface-container rounded-xl flex items-center gap-space-md">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center text-on-primary">
            <span className="material-symbols-outlined text-[18px]">verified</span>
          </div>
          <div className="flex flex-col overflow-hidden">
            <span className="font-label-sm text-label-sm text-primary uppercase font-bold truncate">SGI Conectado</span>
            <span className="font-body-sm text-body-sm text-outline truncate">Auditoría Legal ISO</span>
          </div>
        </div>
      </aside>

      {/* CONTENIDO PRINCIPAL */}
      <div className="pl-72 flex flex-col min-h-screen">
        
        {/* HEADER SUPERIOR */}
        <header className="fixed top-0 left-72 right-0 h-16 bg-surface/90 backdrop-blur-xl z-40 shadow-[0_1px_8px_rgba(0,0,0,0.04)] px-space-xl flex items-center justify-between gap-space-lg">
          <div className="flex items-center gap-space-lg flex-1 max-w-2xl">
            <div className="hidden xl:flex items-center gap-space-xs text-on-surface-variant bg-surface-container px-space-md py-space-xs rounded-full shrink-0">
              <span className="material-symbols-outlined text-[16px] text-secondary">location_on</span>
              <span className="font-label-sm text-label-sm font-semibold truncate">
                {currentUser?.sede || 'Sede Principal Av. El Dorado #100-80, Bogotá'}
              </span>
            </div>
            <div className="relative w-full max-w-md">
              <span className="material-symbols-outlined absolute left-space-md top-1/2 -translate-y-1/2 text-outline text-[18px]">search</span>
              <input 
                className="w-full h-9 pl-9 pr-space-md bg-surface-container-lowest text-on-surface rounded-lg font-body-sm text-body-sm placeholder:text-outline focus:outline-none focus:ring-1 focus:ring-primary shadow-[0_1px_2px_0_rgba(15,23,42,0.04)]" 
                placeholder="Buscar usuarios por cédula, nombre o correo..." 
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center gap-space-md shrink-0">
            <button 
              aria-label="Notificaciones" 
              className="relative h-9 w-9 flex items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors cursor-pointer" 
              type="button"
            >
              <span className="material-symbols-outlined text-[20px]">notifications</span>
              <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-secondary"></span>
            </button>
            <div className="h-6 w-px bg-surface-container-highest"></div>
            <div className="flex items-center gap-space-md pl-space-xs">
              <div className="flex flex-col text-right hidden sm:flex">
                <span className="font-label-md text-label-md text-on-surface">{currentUser?.nombre || 'Ing. Alexis Cruz'}</span>
                <span className="font-label-sm text-label-sm text-secondary font-semibold">
                  {currentUser?.cargo || currentUser?.rol || 'Administrador TI'}
                </span>
              </div>
              <img 
                alt="Profile" 
                className="w-8 h-8 rounded-full object-cover ring-2 ring-primary/20" 
                src={currentUser?.avatar || 'https://lh3.googleusercontent.com/aida-public/AB6AXuDyAiWOUn9njbbS4sZzxnzDv-_O7nlKMP0d8Uj3JmLf2C_0yjiCZpAy_-U4uCYuUD42dh2KBHFoTT45HDNZZYJ4xGPuondY8OzWlnn7_ZuxW3T5adr-8kHHxYrg8TKac--UfaKWJfhULlk7ZTIvToV2_6HQK6K4NU1fRHrt-A4bVhe1TrF6kp8FaNl7tV6SQ4Q_7jCd97VAYDW2x8agwEazqetgfvCbDatPHJzic_KZM9Czjj8JNoYE6Q'}
              />
              <button 
                onClick={handleLogout} 
                className="ml-2 hover:bg-error-container hover:text-error text-outline p-1.5 rounded-full transition-colors cursor-pointer" 
                title="Cerrar Sesión"
              >
                <span className="material-symbols-outlined text-[20px]">logout</span>
              </button>
            </div>
          </div>
        </header>

        {/* CUERPO PRINCIPAL */}
        <main className="relative pt-16 flex-1 w-full px-gutter-lg pb-space-xl bg-background">
          <div className="flex flex-col w-full pt-4">
            
            {/* Header del Módulo */}
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-space-lg mb-space-xl">
              <div className="flex flex-col gap-space-xs">
                <div className="flex items-center gap-space-xs text-outline font-label-sm uppercase tracking-wider">
                  <span>Seguridad y Gobierno TI</span>
                  <span className="material-symbols-outlined text-[14px]">chevron_right</span>
                  <span className="text-primary font-bold">Módulo de Control de Acceso</span>
                  <span className="bg-surface-container-high text-primary px-space-xs rounded font-code-mono text-[10px]">RF-01 • RF-10</span>
                </div>
                <h1 className="font-display-lg text-display-lg text-on-surface tracking-tight">
                  Gestión de Usuarios y Roles
                </h1>
                <p className="font-body-md text-body-md text-on-surface-variant max-w-3xl">
                  Administración centralizada de identidades, privilegios de acceso y asignación de perfiles operativos de CASALIMPIA S.A. Conforme a requerimientos del PPI y normativa ISO/IEC 27001.
                </p>
              </div>

              {/* Botones de Cabecera */}
              <div className="flex flex-wrap items-center gap-space-sm shrink-0">
                <button 
                  onClick={handleSeedPPIMembers}
                  disabled={isProcessing}
                  className="flex items-center gap-space-xs px-space-md h-9 bg-surface-container-lowest text-on-surface rounded-lg font-label-md text-label-md shadow-sm hover:bg-surface-container-high transition-colors cursor-pointer" 
                  type="button"
                >
                  <span className="material-symbols-outlined text-[18px] text-secondary">group_add</span>
                  <span>Cargar Integrantes PPI</span>
                </button>
                <button 
                  onClick={() => setShowCreateModal(true)}
                  className="flex items-center gap-space-xs px-space-lg h-9 bg-primary text-on-primary rounded-lg font-label-md text-label-md shadow-sm hover:bg-primary-container transition-all cursor-pointer" 
                  type="button"
                >
                  <span className="material-symbols-outlined text-[18px]">person_add</span>
                  <span>+ Registrar Nuevo Usuario (RF-01)</span>
                </button>
              </div>
            </div>

            {/* TARJETAS KPI DE USUARIOS */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-space-md mb-space-xl">
              
              <div 
                onClick={() => setFilterRole('all')} 
                className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col justify-between relative overflow-hidden group hover:shadow-md transition-shadow cursor-pointer"
              >
                <div className="flex items-center justify-between mb-space-sm">
                  <span className="font-label-sm text-label-sm uppercase tracking-wider text-outline font-bold">Total Usuarios SGI</span>
                  <div className="w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center text-primary">
                    <span className="material-symbols-outlined text-[18px]">group</span>
                  </div>
                </div>
                <div className="flex items-baseline gap-space-sm mb-space-xs">
                  <span className="font-display-lg text-display-lg text-on-surface font-bold">{totalUsuarios}</span>
                  <span className="font-label-sm text-label-sm text-outline font-code-mono">Perfiles</span>
                </div>
                <span className="font-label-sm text-label-sm text-primary font-semibold">100% Cuentas Institucionales</span>
              </div>

              <div 
                onClick={() => setFilterRole('Administrador')} 
                className={`bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col justify-between relative overflow-hidden group hover:shadow-md transition-shadow cursor-pointer ${filterRole === 'Administrador' ? 'ring-2 ring-primary' : ''}`}
              >
                <div className="flex items-center justify-between mb-space-sm">
                  <span className="font-label-sm text-label-sm uppercase tracking-wider text-outline font-bold">Administradores TI</span>
                  <div className="w-8 h-8 rounded-lg bg-primary-fixed flex items-center justify-center text-primary">
                    <span className="material-symbols-outlined text-[18px]">shield_person</span>
                  </div>
                </div>
                <div className="flex items-baseline gap-space-sm mb-space-xs">
                  <span className="font-display-lg text-display-lg text-primary font-bold">{totalAdmins}</span>
                  <span className="font-label-sm text-label-sm text-outline font-code-mono">Admins</span>
                </div>
                <span className="font-label-sm text-label-sm text-primary font-semibold">Acceso total al sistema</span>
              </div>

              <div 
                onClick={() => setFilterRole('Soporte TI')} 
                className={`bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col justify-between relative overflow-hidden group hover:shadow-md transition-shadow cursor-pointer ${filterRole === 'Soporte TI' ? 'ring-2 ring-secondary' : ''}`}
              >
                <div className="flex items-center justify-between mb-space-sm">
                  <span className="font-label-sm text-label-sm uppercase tracking-wider text-outline font-bold">Soporte Técnico TI</span>
                  <div className="w-8 h-8 rounded-lg bg-secondary-container/40 flex items-center justify-center text-secondary">
                    <span className="material-symbols-outlined text-[18px]">build</span>
                  </div>
                </div>
                <div className="flex items-baseline gap-space-sm mb-space-xs">
                  <span className="font-display-lg text-display-lg text-secondary font-bold">{totalSoporte}</span>
                  <span className="font-label-sm text-label-sm text-outline font-code-mono">Técnicos</span>
                </div>
                <span className="font-label-sm text-label-sm text-secondary font-semibold">Mantenimiento y Entregas</span>
              </div>

              <div 
                onClick={() => setFilterRole('Empleado')} 
                className={`bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col justify-between relative overflow-hidden group hover:shadow-md transition-shadow cursor-pointer ${filterRole === 'Empleado' ? 'ring-2 ring-outline' : ''}`}
              >
                <div className="flex items-center justify-between mb-space-sm">
                  <span className="font-label-sm text-label-sm uppercase tracking-wider text-outline font-bold">Empleados Activos</span>
                  <div className="w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center text-outline">
                    <span className="material-symbols-outlined text-[18px]">badge</span>
                  </div>
                </div>
                <div className="flex items-baseline gap-space-sm mb-space-xs">
                  <span className="font-display-lg text-display-lg text-on-surface font-bold">{totalEmpleados}</span>
                  <span className="font-label-sm text-label-sm text-outline font-code-mono">Colaboradores</span>
                </div>
                <span className="font-label-sm text-label-sm text-outline font-semibold">Custodia de Activos</span>
              </div>

            </div>

            {/* FILTROS Y BÚSQUEDA */}
            <div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm mb-space-lg flex flex-col gap-space-md">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-space-md items-center">
                
                <div className="md:col-span-5 relative">
                  <label className="block font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider mb-1 font-bold">
                    Búsqueda de Usuario
                  </label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-space-md top-1/2 -translate-y-1/2 text-outline text-[18px]">search</span>
                    <input 
                      className="w-full h-9 pl-9 pr-space-md bg-surface-container-low text-on-surface rounded-lg font-body-sm text-body-sm focus:outline-none focus:ring-1 focus:ring-primary shadow-sm" 
                      placeholder="Buscar por nombre, cédula, correo o cargo..." 
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                </div>

                <div className="md:col-span-3">
                  <label className="block font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider mb-1 font-bold">
                    Rol Asignado (RF-10)
                  </label>
                  <div className="relative">
                    <select 
                      className="w-full h-9 px-space-md appearance-none bg-surface-container-low text-on-surface rounded-lg font-body-sm text-body-sm focus:outline-none focus:ring-1 focus:ring-primary shadow-sm cursor-pointer pr-8"
                      value={filterRole}
                      onChange={(e) => setFilterRole(e.target.value)}
                    >
                      <option value="all">Todos los Roles</option>
                      {ROLES.map(r => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                    <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-outline text-[16px] pointer-events-none">expand_more</span>
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="block font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider mb-1 font-bold">
                    Estado
                  </label>
                  <div className="relative">
                    <select 
                      className="w-full h-9 px-space-md appearance-none bg-surface-container-low text-on-surface rounded-lg font-body-sm text-body-sm focus:outline-none focus:ring-1 focus:ring-primary shadow-sm cursor-pointer pr-8"
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value)}
                    >
                      <option value="all">Todos los Estados</option>
                      <option value="ACTIVO">🟢 ACTIVO</option>
                      <option value="INACTIVO">🔴 INACTIVO</option>
                    </select>
                    <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-outline text-[16px] pointer-events-none">expand_more</span>
                  </div>
                </div>

                <div className="md:col-span-2 flex items-end justify-end pt-5">
                  <button 
                    onClick={() => {
                      setSearchQuery('');
                      setFilterRole('all');
                      setFilterStatus('all');
                      setFilterSede('all');
                    }}
                    className="h-9 px-space-md bg-surface-container text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface rounded-lg font-label-sm text-label-sm flex items-center gap-space-xs transition-colors shadow-sm cursor-pointer w-full justify-center"
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[16px]">restart_alt</span>
                    <span>Limpiar Filtros</span>
                  </button>
                </div>

              </div>

              <div className="flex items-center justify-between pt-space-xs border-t border-surface-container-high/40 text-outline font-label-sm">
                <span>Mostrando <strong className="text-primary font-bold">{filteredUsuarios.length}</strong> de <strong>{totalUsuarios}</strong> usuarios registrados en Firestore</span>
              </div>
            </div>

            {/* TABLA DE USUARIOS Y ROLES */}
            <div className="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden mb-space-lg">
              <div className="overflow-x-auto w-full">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-surface-container-low text-outline font-label-sm text-label-sm uppercase tracking-wider select-none">
                      <th className="py-space-md px-space-lg font-bold">Colaborador / Usuario</th>
                      <th className="py-space-md px-space-md font-bold">Documento (C.C.)</th>
                      <th className="py-space-md px-space-md font-bold">Rol en Sistema</th>
                      <th className="py-space-md px-space-lg font-bold">Cargo y Área</th>
                      <th className="py-space-md px-space-md font-bold">Sede</th>
                      <th className="py-space-md px-space-md font-bold">Estado</th>
                      <th className="py-space-md px-space-md text-right font-bold pr-space-lg">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y-0 font-body-sm text-body-sm text-on-surface">
                    {errorMsg ? (
                      <tr>
                        <td colSpan="7" className="text-center py-10 bg-error-container text-on-error-container font-semibold">
                          Error de Firestore: {errorMsg}
                        </td>
                      </tr>
                    ) : loading ? (
                      <tr>
                        <td colSpan="7" className="text-center py-16">
                          <div className="flex flex-col items-center justify-center gap-3">
                            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                            <span className="text-outline font-semibold">Cargando usuarios desde Firestore...</span>
                          </div>
                        </td>
                      </tr>
                    ) : usuarios.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="text-center py-16 bg-surface-container-low/30">
                          <div className="flex flex-col items-center justify-center gap-3 max-w-md mx-auto">
                            <span className="material-symbols-outlined text-[48px] text-outline">group_off</span>
                            <p className="font-bold text-label-lg text-on-surface">No hay usuarios registrados en la base de datos</p>
                            <p className="text-outline text-body-sm">
                              Carga los 4 integrantes oficiales de su proyecto integrador (PPI) de CASALIMPIA para comenzar a gestionar los roles.
                            </p>
                            <button 
                              onClick={handleSeedPPIMembers}
                              disabled={isProcessing}
                              className="mt-2 px-space-lg py-2 bg-primary text-on-primary rounded-lg font-label-md font-semibold hover:bg-primary-container transition-colors flex items-center gap-1 shadow-sm cursor-pointer"
                            >
                              <span className="material-symbols-outlined text-[18px]">group_add</span>
                              Cargar Integrantes del PPI (Casalimpia S.A.)
                            </button>
                          </div>
                        </td>
                      </tr>
                    ) : filteredUsuarios.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="text-center py-12 bg-surface-container-low/20">
                          <span className="material-symbols-outlined text-[36px] text-outline">person_search</span>
                          <p className="font-bold text-on-surface mt-1">No se encontraron usuarios con los filtros aplicados</p>
                        </td>
                      </tr>
                    ) : (
                      filteredUsuarios.map((u) => {
                        const roleMeta = ROLE_INFO[u.rol] || ROLE_INFO['Empleado'];
                        return (
                          <tr key={u.id} className="hover:bg-surface-container transition-colors group">
                            <td className="py-space-md px-space-lg">
                              <div className="flex items-center gap-space-md min-w-0">
                                <img 
                                  alt={u.nombre} 
                                  className="w-10 h-10 rounded-full object-cover shrink-0 ring-2 ring-primary/20 shadow-sm"
                                  src={u.avatar || 'https://i.pravatar.cc/150'}
                                />
                                <div className="flex flex-col min-w-0">
                                  <span className="font-label-md font-bold text-on-surface truncate">{u.nombre}</span>
                                  <span className="font-body-sm text-outline truncate text-[12px]">{u.email}</span>
                                </div>
                              </div>
                            </td>
                            <td className="py-space-md px-space-md font-code-mono text-on-surface-variant font-medium">
                              {u.cedula}
                            </td>
                            <td className="py-space-md px-space-md">
                              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-label-sm text-[11px] font-bold shadow-xs ${roleMeta.badgeClass}`}>
                                <span className="material-symbols-outlined text-[14px]">{roleMeta.icon}</span>
                                {u.rol}
                              </span>
                            </td>
                            <td className="py-space-md px-space-lg">
                              <div className="flex flex-col">
                                <span className="font-label-md font-semibold text-on-surface">{u.cargo || 'Funcionario'}</span>
                                <span className="font-body-sm text-outline text-[12px]">{u.area || 'General'}</span>
                              </div>
                            </td>
                            <td className="py-space-md px-space-md text-on-surface-variant text-body-sm">
                              {u.sede}
                            </td>
                            <td className="py-space-md px-space-md">
                              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full font-label-sm text-[11px] font-bold ${
                                u.estado === 'ACTIVO' ? 'bg-secondary-container text-on-secondary-container' : 'bg-error-container text-error'
                              }`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${u.estado === 'ACTIVO' ? 'bg-secondary' : 'bg-error'}`}></span>
                                {u.estado || 'ACTIVO'}
                              </span>
                            </td>
                            <td className="py-space-md px-space-md text-right pr-space-lg">
                              <div className="flex items-center justify-end gap-1 opacity-90 group-hover:opacity-100">
                                <button 
                                  onClick={() => setUserToEdit(u)}
                                  className="p-1.5 rounded-md hover:bg-surface-container-high text-primary transition-colors cursor-pointer" 
                                  title="Editar Rol y Usuario (RF-10)"
                                >
                                  <span className="material-symbols-outlined text-[18px]">edit</span>
                                </button>
                                <button 
                                  onClick={() => handleDeleteUser(u)}
                                  className="p-1.5 rounded-md hover:bg-error-container text-outline hover:text-error transition-colors cursor-pointer" 
                                  title="Eliminar usuario"
                                >
                                  <span className="material-symbols-outlined text-[18px]">delete</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </main>

        {/* FOOTER */}
        <footer className="w-full bg-surface-container-lowest shadow-[0_-1px_4px_rgba(0,0,0,0.02)] py-space-md px-gutter-lg">
          <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-space-xs text-outline">
            <span className="font-body-sm text-body-sm">CASALIMPIA S.A - Tecnológico de Antioquia PPI 2026</span>
            <div className="flex items-center gap-space-md font-code-mono text-code-mono text-outline-variant">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-secondary"></span>
                Control de Roles Activo
              </span>
              <span>v2.5.0</span>
            </div>
          </div>
        </footer>
      </div>

      {/* MODAL CREAR USUARIO (RF-01) */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            onClick={() => setShowCreateModal(false)} 
            className="fixed inset-0 bg-black/50 backdrop-blur-xs"
          ></div>
          <div className="relative w-full max-w-lg bg-surface-container-lowest rounded-2xl shadow-2xl p-6 z-10">
            <div className="flex items-center justify-between pb-4 border-b border-surface-container mb-4">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[24px]">person_add</span>
                <h2 className="font-headline-sm font-bold text-on-surface">Registrar Nuevo Usuario (RF-01)</h2>
              </div>
              <button 
                onClick={() => setShowCreateModal(false)}
                className="p-1 rounded-lg hover:bg-surface-container text-outline hover:text-on-surface cursor-pointer"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-label-sm font-bold text-outline uppercase mb-1">Nombre Completo</label>
                <input 
                  type="text"
                  required
                  placeholder="Ej. Andrés Camilo Pérez"
                  className="w-full h-9 px-3 bg-surface-container-low rounded-lg text-body-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  value={newUser.nombre}
                  onChange={(e) => setNewUser({ ...newUser, nombre: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-label-sm font-bold text-outline uppercase mb-1">Cédula de Ciudadanía</label>
                  <input 
                    type="text"
                    required
                    placeholder="Ej. 1.020.304.506"
                    className="w-full h-9 px-3 bg-surface-container-low rounded-lg font-code-mono text-body-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    value={newUser.cedula}
                    onChange={(e) => setNewUser({ ...newUser, cedula: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-label-sm font-bold text-outline uppercase mb-1">Rol Asignado (RF-10)</label>
                  <select 
                    className="w-full h-9 px-3 bg-surface-container-low rounded-lg text-body-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    value={newUser.rol}
                    onChange={(e) => setNewUser({ ...newUser, rol: e.target.value })}
                  >
                    {ROLES.map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-label-sm font-bold text-outline uppercase mb-1">Correo Institucional</label>
                <input 
                  type="email"
                  required
                  placeholder="usuario@casalimpia.com.co"
                  className="w-full h-9 px-3 bg-surface-container-low rounded-lg text-body-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-label-sm font-bold text-outline uppercase mb-1">Cargo</label>
                  <input 
                    type="text"
                    placeholder="Ej. Analista de Operaciones"
                    className="w-full h-9 px-3 bg-surface-container-low rounded-lg text-body-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    value={newUser.cargo}
                    onChange={(e) => setNewUser({ ...newUser, cargo: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-label-sm font-bold text-outline uppercase mb-1">Área / Departamento</label>
                  <input 
                    type="text"
                    placeholder="Ej. Tecnología e Infraestructura"
                    className="w-full h-9 px-3 bg-surface-container-low rounded-lg text-body-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    value={newUser.area}
                    onChange={(e) => setNewUser({ ...newUser, area: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-label-sm font-bold text-outline uppercase mb-1">Sede Asignada</label>
                <select 
                  className="w-full h-9 px-3 bg-surface-container-low rounded-lg text-body-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  value={newUser.sede}
                  onChange={(e) => setNewUser({ ...newUser, sede: e.target.value })}
                >
                  <option value="Bogotá - Av. El Dorado">Bogotá - Av. El Dorado</option>
                  <option value="Medellín - Poblado">Medellín - Poblado</option>
                  <option value="Cali - Valle del Lili">Cali - Valle del Lili</option>
                  <option value="Barranquilla - Prado">Barranquilla - Prado</option>
                  <option value="Bucaramanga - Cabecera">Bucaramanga - Cabecera</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-surface-container">
                <button 
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-lg bg-surface-container text-on-surface hover:bg-surface-container-high transition-colors font-label-md cursor-pointer"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  disabled={isProcessing}
                  className="px-5 py-2 rounded-lg bg-primary text-on-primary font-bold hover:bg-primary-container transition-colors shadow-md flex items-center gap-2 cursor-pointer"
                >
                  {isProcessing ? 'Guardando...' : 'Crear Usuario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL EDITAR ROL Y USUARIO (RF-10) */}
      {userToEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            onClick={() => setUserToEdit(null)} 
            className="fixed inset-0 bg-black/50 backdrop-blur-xs"
          ></div>
          <div className="relative w-full max-w-lg bg-surface-container-lowest rounded-2xl shadow-2xl p-6 z-10">
            <div className="flex items-center justify-between pb-4 border-b border-surface-container mb-4">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[24px]">manage_accounts</span>
                <h2 className="font-headline-sm font-bold text-on-surface">Gestión de Rol y Usuario (RF-10)</h2>
              </div>
              <button 
                onClick={() => setUserToEdit(null)}
                className="p-1 rounded-lg hover:bg-surface-container text-outline hover:text-on-surface cursor-pointer"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveEditUser} className="space-y-4">
              <div className="p-3 bg-surface-container rounded-xl flex items-center gap-3">
                <img 
                  alt={userToEdit.nombre} 
                  className="w-12 h-12 rounded-full object-cover ring-2 ring-primary/20"
                  src={userToEdit.avatar || 'https://i.pravatar.cc/150'}
                />
                <div className="flex flex-col">
                  <span className="font-label-md font-bold text-on-surface">{userToEdit.nombre}</span>
                  <span className="text-body-sm text-outline">{userToEdit.email}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-label-sm font-bold text-outline uppercase mb-1">Rol en Sistema</label>
                  <select 
                    className="w-full h-9 px-3 bg-surface-container-low rounded-lg text-body-sm focus:outline-none focus:ring-1 focus:ring-primary font-bold text-primary"
                    value={userToEdit.rol || 'Empleado'}
                    onChange={(e) => setUserToEdit({ ...userToEdit, rol: e.target.value })}
                  >
                    {ROLES.map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-label-sm font-bold text-outline uppercase mb-1">Estado de Acceso</label>
                  <select 
                    className="w-full h-9 px-3 bg-surface-container-low rounded-lg text-body-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    value={userToEdit.estado || 'ACTIVO'}
                    onChange={(e) => setUserToEdit({ ...userToEdit, estado: e.target.value })}
                  >
                    <option value="ACTIVO">🟢 ACTIVO</option>
                    <option value="INACTIVO">🔴 INACTIVO (Bloqueado)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-label-sm font-bold text-outline uppercase mb-1">Cargo</label>
                  <input 
                    type="text"
                    className="w-full h-9 px-3 bg-surface-container-low rounded-lg text-body-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    value={userToEdit.cargo || ''}
                    onChange={(e) => setUserToEdit({ ...userToEdit, cargo: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-label-sm font-bold text-outline uppercase mb-1">Área</label>
                  <input 
                    type="text"
                    className="w-full h-9 px-3 bg-surface-container-low rounded-lg text-body-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    value={userToEdit.area || ''}
                    onChange={(e) => setUserToEdit({ ...userToEdit, area: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-label-sm font-bold text-outline uppercase mb-1">Sede</label>
                <input 
                  type="text"
                  className="w-full h-9 px-3 bg-surface-container-low rounded-lg text-body-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  value={userToEdit.sede || ''}
                  onChange={(e) => setUserToEdit({ ...userToEdit, sede: e.target.value })}
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-surface-container">
                <button 
                  type="button"
                  onClick={() => setUserToEdit(null)}
                  className="px-4 py-2 rounded-lg bg-surface-container text-on-surface hover:bg-surface-container-high transition-colors font-label-md cursor-pointer"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  disabled={isProcessing}
                  className="px-5 py-2 rounded-lg bg-primary text-on-primary font-bold hover:bg-primary-container transition-colors shadow-md flex items-center gap-2 cursor-pointer"
                >
                  {isProcessing ? 'Guardando...' : 'Actualizar Rol y Datos'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, setDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCYQEojGcBE5G-t-fxjzdH7MIHa4fk2kn0",
  authDomain: "desarrolloweb-e8531.firebaseapp.com",
  projectId: "desarrolloweb-e8531"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const usersToCreate = [
  {
    nombre: 'Jhonfer Alexis Cruz Gutiérrez',
    cedula: '1.020.455.890',
    email: 'alexis.cruz@casalimpia.com.co',
    rol: 'Administrador',
    cargo: 'Ingeniero Administrador TI',
    area: 'Tecnología e Infraestructura',
    sede: 'Bogotá - Av. El Dorado',
    estado: 'ACTIVO',
    avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDyAiWOUn9njbbS4sZzxnzDv-_O7nlKMP0d8Uj3JmLf2C_0yjiCZpAy_-U4uCYuUD42dh2KBHFoTT45HDNZZYJ4xGPuondY8OzWlnn7_ZuxW3T5adr-8kHHxYrg8TKac--UfaKWJfhULlk7ZTIvToV2_6HQK6K4NU1fRHrt-A4bVhe1TrF6kp8FaNl7tV6SQ4Q_7jCd97VAYDW2x8agwEazqetgfvCbDatPHJzic_KZM9Czjj8JNoYE6Q'
  },
  {
    nombre: 'José Alejandro Calderón Cuartas',
    cedula: '1.035.890.123',
    email: 'alejandro.calderon@casalimpia.com.co',
    rol: 'Administrador',
    cargo: 'Líder de Desarrollo y Arquitectura TI',
    area: 'Tecnología e Infraestructura',
    sede: 'Medellín - Poblado',
    estado: 'ACTIVO',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'
  },
  {
    nombre: 'Santiago Jiménez Céspedes',
    cedula: '1.017.654.321',
    email: 'santiago.jimenez@casalimpia.com.co',
    rol: 'Soporte TI',
    cargo: 'Coordinador de Soporte TI de Campo',
    area: 'Soporte Técnico y Hardware',
    sede: 'Medellín - Poblado',
    estado: 'ACTIVO',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80'
  },
  {
    nombre: 'Juan David Gutiérrez Zuleta',
    cedula: '1.020.455.891',
    email: 'juan.gutierrez@casalimpia.com.co',
    rol: 'Empleado',
    cargo: 'Analista de Operaciones y Servicios',
    area: 'Servicios Generales',
    sede: 'Bogotá - Av. El Dorado',
    estado: 'ACTIVO',
    avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBGsQE4UpuHooVIQ04f_YXJzXSdny24c9qcuPr1cMP7E4D0fr4H3zy4UOsHO9xZEClCFY1bkk-g_Xpzvn8G3xYhBX7yHYVnzEWjWnGQtd9Eoum0fT7tscs2fRHPj-v0WtIi5uGGU25yihacJ_e5Iv0qXvC7l8NaVI7cnqtD-6vDgu2_3qjKc0QBBw9K8bc3vR_ht51hHYqSMbBUb2y9PlxaMsdkLoFSV8BpGGaugbqPrjso00WxNqWonQ'
  }
];

async function seed() {
  for (const u of usersToCreate) {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, u.email, 'hospi123');
      const uid = userCredential.user.uid;
      await setDoc(doc(db, 'usuarios', uid), u);
      console.log('Created user:', u.email);
    } catch (e) {
      if (e.code === 'auth/email-already-in-use') {
        console.log('User already exists:', u.email);
      } else {
        console.error('Error creating user:', u.email, e.message);
      }
    }
  }
  process.exit(0);
}
seed();

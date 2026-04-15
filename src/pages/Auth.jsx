import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { Radio } from 'lucide-react';
import { storeSessionUser } from '../utils/session';

export default function Auth({ onAuthSuccess }) {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    try {
      if (isLogin) {
        const { data, error: selectError } = await supabase
          .from('users')
          .select('*')
          .eq('phone_number', phone)
          .eq('password', password)
          .single();

        if (selectError || !data) {
           setError('Invalid phone number or password');
        } else {
           storeSessionUser(data);
           onAuthSuccess?.(data);
           navigate('/');
        }
      } else {
        const { error: insertError } = await supabase
          .from('users')
          .insert([{ username, password, phone_number: phone }]);
          
        if (insertError) {
          setError(insertError.message || 'Registration failed. Phone or username may already exist.');
        } else {
          setIsLogin(true);
          setError('');
          setUsername('');
          setPhone('');
          setPassword('');
        }
      }
    } catch (err) {
      setError(err.message || 'Authentication failed');
    }
  };

  return (
    <div className="flex h-screen w-full items-center justify-center bg-neutral-950 text-neutral-100">
      <div className="w-full max-w-md p-8 bg-neutral-900 rounded-2xl border border-neutral-800 shadow-2xl">
        <div className="flex justify-center mb-8">
          <div className="bg-blue-500/20 p-4 rounded-full text-blue-500">
            <Radio size={40} />
          </div>
        </div>
        
        <h2 className="text-2xl font-bold text-center mb-6">
          {isLogin ? 'Login to GSM Node' : 'Register New Node'}
        </h2>
        
        {error && <div className="mb-4 text-red-400 bg-red-400/10 p-3 rounded text-sm text-center border border-red-400/20">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div>
              <label className="block text-sm font-medium mb-1 text-neutral-400">Username</label>
              <input 
                type="text" 
                required
                className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-3 outline-none focus:border-blue-500 transition-colors"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
          )}
          
          <div>
            <label className="block text-sm font-medium mb-1 text-neutral-400">Phone Number (MSISDN)</label>
            <input 
              type="text" 
              required
              className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-3 outline-none focus:border-blue-500 transition-colors"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 text-neutral-400">Password</label>
            <input 
              type="password" 
              required
              className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-3 outline-none focus:border-blue-500 transition-colors"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium p-3 rounded-lg transition-colors mt-6">
            {isLogin ? 'Connect' : 'Register'}
          </button>
        </form>
        
        <div className="mt-6 text-center text-sm text-neutral-500">
          {isLogin ? "Don't have an account? " : "Already registered? "}
          <button onClick={() => { setIsLogin(!isLogin); setError(''); }} className="text-blue-400 hover:underline type-button">
            {isLogin ? 'Register' : 'Login'}
          </button>
        </div>
      </div>
    </div>
  );
}

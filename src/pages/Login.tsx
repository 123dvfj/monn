import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { usePortfolioStore } from '../stores/portfolioStore';

export default function Login() {
  const navigate = useNavigate();
  const { login, loading, error, clearError } = useAuthStore();
  const initUser = usePortfolioStore((s) => s.initUser);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) return;
    clearError();
    const ok = await login(username.trim(), password);
    if (ok) {
      initUser(username.trim());
      navigate('/portfolio');
    }
  };

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100%', padding: 40,
    }}>
      <div style={{ width: 380 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 28, fontWeight: 700, marginBottom: 4 }}>投资模拟</div>
          <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>登录账户开始模拟交易</div>
        </div>

        <form onSubmit={handleSubmit} className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>用户名</label>
            <input
              className="input" autoFocus
              value={username} onChange={(e) => setUsername(e.target.value)}
              placeholder="输入用户名" style={{ width: '100%' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>密码</label>
            <input
              className="input" type="password"
              value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="输入密码" style={{ width: '100%' }}
            />
          </div>
          {error && (
            <div style={{ fontSize: 12, color: 'var(--color-down)', padding: '6px 10px', background: 'var(--color-down-bg)', borderRadius: 4 }}>
              {error}
            </div>
          )}
          <button className="btn btn-primary w-full" type="submit" disabled={loading}>
            {loading ? '登录中...' : '登录'}
          </button>
          <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-tertiary)' }}>
            还没有账户？<Link to="/register" style={{ color: 'var(--color-accent)' }}>注册</Link>
          </div>
        </form>
      </div>
    </div>
  );
}

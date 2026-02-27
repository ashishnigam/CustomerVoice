import { FormEvent, useCallback, useMemo, useState } from 'react';

type Board = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  visibility: 'public' | 'private';
  active: boolean;
};

type Role =
  | 'tenant_admin'
  | 'workspace_admin'
  | 'product_manager'
  | 'engineering_manager'
  | 'contributor'
  | 'viewer';

const defaultApiBase = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000/api/v1';

function requestHeaders(params: {
  workspaceId: string;
  userId: string;
  role: Role;
  userEmail: string;
  accessToken: string;
}): HeadersInit {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-workspace-id': params.workspaceId,
    'x-user-id': params.userId,
    'x-role': params.role,
    'x-user-email': params.userEmail,
  };

  if (params.accessToken.trim().length > 0) {
    headers.authorization = `Bearer ${params.accessToken.trim()}`;
  }

  return headers;
}

export function App(): JSX.Element {
  const [apiBase, setApiBase] = useState(defaultApiBase);
  const [workspaceId, setWorkspaceId] = useState('22222222-2222-2222-2222-222222222222');
  const [userId, setUserId] = useState('33333333-3333-3333-3333-333333333333');
  const [role, setRole] = useState<Role>('workspace_admin');
  const [userEmail, setUserEmail] = useState('admin@customervoice.local');
  const [accessToken, setAccessToken] = useState('');

  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');
  const [creating, setCreating] = useState(false);

  const baseUrl = useMemo(() => apiBase.replace(/\/+$/, ''), [apiBase]);
  const headers = useMemo(
    () => requestHeaders({ workspaceId, userId, role, userEmail, accessToken }),
    [workspaceId, userId, role, userEmail, accessToken],
  );

  const loadBoards = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${baseUrl}/workspaces/${workspaceId}/boards`, {
        headers,
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`load failed (${response.status}): ${body}`);
      }

      const data = (await response.json()) as { items: Board[] };
      setBoards(data.items);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'request_failed');
    } finally {
      setLoading(false);
    }
  }, [baseUrl, headers, workspaceId]);

  const onCreate = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      if (name.trim().length < 2) {
        setError('Board name must be at least 2 characters.');
        return;
      }

      setCreating(true);
      setError(null);
      try {
        const response = await fetch(`${baseUrl}/workspaces/${workspaceId}/boards`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            name: name.trim(),
            description: description.trim().length > 0 ? description.trim() : undefined,
            visibility,
          }),
        });

        if (!response.ok) {
          const body = await response.text();
          throw new Error(`create failed (${response.status}): ${body}`);
        }

        setName('');
        setDescription('');
        setVisibility('public');
        await loadBoards();
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : 'request_failed');
      } finally {
        setCreating(false);
      }
    },
    [baseUrl, description, headers, loadBoards, name, visibility, workspaceId],
  );

  return (
    <main className="container">
      <header>
        <p className="eyebrow">CustomerVoice</p>
        <h1>Boards API Workspace Shell</h1>
        <p className="subtitle">
          This screen is wired to real backend APIs for board list/create.
        </p>
      </header>

      <section className="card">
        <h2>Connection</h2>
        <div className="grid">
          <label>
            API Base URL
            <input value={apiBase} onChange={(event) => setApiBase(event.target.value)} />
          </label>
          <label>
            Workspace ID
            <input
              value={workspaceId}
              onChange={(event) => setWorkspaceId(event.target.value)}
            />
          </label>
          <label>
            User ID
            <input value={userId} onChange={(event) => setUserId(event.target.value)} />
          </label>
          <label>
            User Email
            <input value={userEmail} onChange={(event) => setUserEmail(event.target.value)} />
          </label>
          <label>
            Role
            <select value={role} onChange={(event) => setRole(event.target.value as Role)}>
              <option value="tenant_admin">tenant_admin</option>
              <option value="workspace_admin">workspace_admin</option>
              <option value="product_manager">product_manager</option>
              <option value="engineering_manager">engineering_manager</option>
              <option value="contributor">contributor</option>
              <option value="viewer">viewer</option>
            </select>
          </label>
          <label>
            Access Token (optional)
            <input
              value={accessToken}
              onChange={(event) => setAccessToken(event.target.value)}
              placeholder="For AUTH_MODE=supabase"
            />
          </label>
        </div>
        <div className="actions">
          <button onClick={() => void loadBoards()} disabled={loading}>
            {loading ? 'Loading...' : 'Load Boards'}
          </button>
        </div>
      </section>

      <section className="card">
        <h2>Create Board</h2>
        <form onSubmit={onCreate} className="form">
          <label>
            Name
            <input value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <label>
            Description
            <textarea
              rows={3}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>
          <label>
            Visibility
            <select
              value={visibility}
              onChange={(event) => setVisibility(event.target.value as 'public' | 'private')}
            >
              <option value="public">public</option>
              <option value="private">private</option>
            </select>
          </label>
          <div className="actions">
            <button type="submit" disabled={creating}>
              {creating ? 'Creating...' : 'Create Board'}
            </button>
          </div>
        </form>
      </section>

      <section className="card">
        <h2>Boards</h2>
        {error ? <p className="error">{error}</p> : null}
        {boards.length === 0 ? (
          <p>No boards loaded.</p>
        ) : (
          <ul className="boardList">
            {boards.map((board) => (
              <li key={board.id}>
                <strong>{board.name}</strong>
                <span>{board.visibility}</span>
                <span>{board.slug}</span>
                {board.description ? <p>{board.description}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

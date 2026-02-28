import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

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

type IdeaStatus =
  | 'new'
  | 'under_review'
  | 'accepted'
  | 'planned'
  | 'in_progress'
  | 'completed'
  | 'declined';

type Idea = {
  id: string;
  workspaceId: string;
  boardId: string;
  title: string;
  description: string;
  status: IdeaStatus;
  active: boolean;
  createdBy: string;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
  voteCount: number;
  commentCount: number;
  viewerHasVoted: boolean;
};

type IdeaComment = {
  id: string;
  workspaceId: string;
  ideaId: string;
  userId: string;
  userEmail: string;
  body: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

type Session = {
  workspaceId: string;
  userId: string;
  userEmail: string;
  role: Role;
  accessToken: string;
};

const defaultApiBase = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000/api/v1';
const defaultWorkspaceId = '22222222-2222-2222-2222-222222222222';
const defaultUserId = '33333333-3333-3333-3333-333333333333';
const defaultUserEmail = 'admin@customervoice.local';

const statusOptions: IdeaStatus[] = [
  'new',
  'under_review',
  'accepted',
  'planned',
  'in_progress',
  'completed',
  'declined',
];

const statusLabel: Record<IdeaStatus, string> = {
  new: 'New',
  under_review: 'Under Review',
  accepted: 'Accepted',
  planned: 'Planned',
  in_progress: 'In Progress',
  completed: 'Completed',
  declined: 'Declined',
};

const statusClassName: Record<IdeaStatus, string> = {
  new: 'status status-new',
  under_review: 'status status-under_review',
  accepted: 'status status-accepted',
  planned: 'status status-planned',
  in_progress: 'status status-in_progress',
  completed: 'status status-completed',
  declined: 'status status-declined',
};

const rolesThatCanManageStatus = new Set<Role>([
  'tenant_admin',
  'workspace_admin',
  'product_manager',
  'engineering_manager',
]);

function requestHeaders(params: Session): Record<string, string> {
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

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

export function App(): JSX.Element {
  const [apiBase, setApiBase] = useState(defaultApiBase);

  const [workspaceOptions, setWorkspaceOptions] = useState<string[]>([defaultWorkspaceId]);
  const [workspaceIdInput, setWorkspaceIdInput] = useState(defaultWorkspaceId);
  const [userIdInput, setUserIdInput] = useState(defaultUserId);
  const [userEmailInput, setUserEmailInput] = useState(defaultUserEmail);
  const [roleInput, setRoleInput] = useState<Role>('workspace_admin');
  const [accessTokenInput, setAccessTokenInput] = useState('');

  const [session, setSession] = useState<Session | null>(null);
  const [authNotice, setAuthNotice] = useState<string | null>(null);

  const [boards, setBoards] = useState<Board[]>([]);
  const [boardsLoading, setBoardsLoading] = useState(false);
  const [boardsError, setBoardsError] = useState<string | null>(null);

  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(null);
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [ideasLoading, setIdeasLoading] = useState(false);
  const [ideasError, setIdeasError] = useState<string | null>(null);

  const [selectedIdeaId, setSelectedIdeaId] = useState<string | null>(null);
  const [comments, setComments] = useState<IdeaComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsError, setCommentsError] = useState<string | null>(null);

  const [boardName, setBoardName] = useState('');
  const [boardDescription, setBoardDescription] = useState('');
  const [boardVisibility, setBoardVisibility] = useState<'public' | 'private'>('public');
  const [boardCreateBusy, setBoardCreateBusy] = useState(false);

  const [ideaTitle, setIdeaTitle] = useState('');
  const [ideaDescription, setIdeaDescription] = useState('');
  const [ideaCreateBusy, setIdeaCreateBusy] = useState(false);

  const [commentBody, setCommentBody] = useState('');
  const [commentBusy, setCommentBusy] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);

  const baseUrl = useMemo(() => apiBase.replace(/\/+$/, ''), [apiBase]);
  const headers = useMemo(() => (session ? requestHeaders(session) : null), [session]);

  const selectedBoard = useMemo(
    () => boards.find((board) => board.id === selectedBoardId) ?? null,
    [boards, selectedBoardId],
  );

  const selectedIdea = useMemo(
    () => ideas.find((idea) => idea.id === selectedIdeaId) ?? null,
    [ideas, selectedIdeaId],
  );

  const canManageStatus = session ? rolesThatCanManageStatus.has(session.role) : false;

  const clearWorkspaceView = useCallback(() => {
    setBoards([]);
    setIdeas([]);
    setComments([]);
    setSelectedBoardId(null);
    setSelectedIdeaId(null);
    setBoardsError(null);
    setIdeasError(null);
    setCommentsError(null);
  }, []);

  const handleUnauthorized = useCallback(
    (statusCode: number) => {
      clearWorkspaceView();
      setSession(null);
      setAuthNotice(`Session ended (${statusCode}). Sign in again to continue.`);
    },
    [clearWorkspaceView],
  );

  const apiRequest = useCallback(
    async <T,>(path: string, init?: RequestInit): Promise<T> => {
      if (!headers) {
        throw new Error('not_authenticated');
      }

      const mergedHeaders = {
        ...headers,
        ...(init?.headers as Record<string, string> | undefined),
      };

      const response = await fetch(`${baseUrl}${path}`, {
        ...init,
        headers: mergedHeaders,
      });

      if (response.status === 401 || response.status === 403) {
        handleUnauthorized(response.status);
        throw new Error('unauthorized');
      }

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`${init?.method ?? 'GET'} ${path} failed (${response.status}): ${body}`);
      }

      return (await response.json()) as T;
    },
    [baseUrl, headers, handleUnauthorized],
  );

  const loadBoards = useCallback(async () => {
    if (!session) {
      return;
    }

    setBoardsLoading(true);
    setBoardsError(null);
    try {
      const data = await apiRequest<{ items: Board[] }>(
        `/workspaces/${session.workspaceId}/boards?includeInactive=false`,
      );
      setBoards(data.items);

      if (data.items.length === 0) {
        setSelectedBoardId(null);
        setIdeas([]);
        setSelectedIdeaId(null);
        setComments([]);
        return;
      }

      setSelectedBoardId((current) =>
        current && data.items.some((board) => board.id === current) ? current : data.items[0].id,
      );
    } catch (error) {
      if (error instanceof Error && error.message === 'unauthorized') {
        return;
      }
      setBoardsError(error instanceof Error ? error.message : 'board_load_failed');
    } finally {
      setBoardsLoading(false);
    }
  }, [apiRequest, session]);

  const loadIdeas = useCallback(
    async (boardId: string) => {
      if (!session) {
        return;
      }

      setIdeasLoading(true);
      setIdeasError(null);
      try {
        const data = await apiRequest<{ items: Idea[] }>(
          `/workspaces/${session.workspaceId}/boards/${boardId}/ideas`,
        );
        setIdeas(data.items);

        if (data.items.length === 0) {
          setSelectedIdeaId(null);
          setComments([]);
          return;
        }

        setSelectedIdeaId((current) =>
          current && data.items.some((idea) => idea.id === current) ? current : data.items[0].id,
        );
      } catch (error) {
        if (error instanceof Error && error.message === 'unauthorized') {
          return;
        }
        setIdeasError(error instanceof Error ? error.message : 'idea_load_failed');
      } finally {
        setIdeasLoading(false);
      }
    },
    [apiRequest, session],
  );

  const loadComments = useCallback(
    async (boardId: string, ideaId: string) => {
      if (!session) {
        return;
      }

      setCommentsLoading(true);
      setCommentsError(null);
      try {
        const data = await apiRequest<{ items: IdeaComment[] }>(
          `/workspaces/${session.workspaceId}/boards/${boardId}/ideas/${ideaId}/comments`,
        );
        setComments(data.items);
      } catch (error) {
        if (error instanceof Error && error.message === 'unauthorized') {
          return;
        }
        setCommentsError(error instanceof Error ? error.message : 'comment_load_failed');
      } finally {
        setCommentsLoading(false);
      }
    },
    [apiRequest, session],
  );

  useEffect(() => {
    if (!session) {
      return;
    }

    void loadBoards();
  }, [session, loadBoards]);

  useEffect(() => {
    if (!session || !selectedBoardId) {
      return;
    }

    void loadIdeas(selectedBoardId);
  }, [session, selectedBoardId, loadIdeas]);

  useEffect(() => {
    if (!session || !selectedBoardId || !selectedIdeaId) {
      setComments([]);
      return;
    }

    void loadComments(selectedBoardId, selectedIdeaId);
  }, [session, selectedBoardId, selectedIdeaId, loadComments]);

  const onSignIn = useCallback(
    (event: FormEvent) => {
      event.preventDefault();
      const workspaceId = workspaceIdInput.trim();
      const userId = userIdInput.trim();
      const userEmail = userEmailInput.trim();

      if (workspaceId.length === 0 || userId.length === 0 || userEmail.length === 0) {
        setAuthNotice('Workspace ID, user ID, and email are required.');
        return;
      }

      clearWorkspaceView();
      setSession({
        workspaceId,
        userId,
        userEmail,
        role: roleInput,
        accessToken: accessTokenInput,
      });
      setAuthNotice(null);

      setWorkspaceOptions((current) =>
        current.includes(workspaceId) ? current : [...current, workspaceId],
      );
    },
    [accessTokenInput, clearWorkspaceView, roleInput, userEmailInput, userIdInput, workspaceIdInput],
  );

  const onSignOut = useCallback(() => {
    clearWorkspaceView();
    setSession(null);
    setAuthNotice('Signed out.');
  }, [clearWorkspaceView]);

  const onWorkspaceSwitch = useCallback(
    (nextWorkspaceId: string) => {
      if (!session || nextWorkspaceId === session.workspaceId) {
        return;
      }

      clearWorkspaceView();
      setSession({ ...session, workspaceId: nextWorkspaceId });
      setWorkspaceIdInput(nextWorkspaceId);
    },
    [clearWorkspaceView, session],
  );

  const onCreateBoard = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      if (!session) {
        return;
      }

      if (boardName.trim().length < 2) {
        setBoardsError('Board name must be at least 2 characters.');
        return;
      }

      setBoardCreateBusy(true);
      setBoardsError(null);
      try {
        const created = await apiRequest<Board>(`/workspaces/${session.workspaceId}/boards`, {
          method: 'POST',
          body: JSON.stringify({
            name: boardName.trim(),
            description: boardDescription.trim().length > 0 ? boardDescription.trim() : undefined,
            visibility: boardVisibility,
          }),
        });

        setBoardName('');
        setBoardDescription('');
        setBoardVisibility('public');
        await loadBoards();
        setSelectedBoardId(created.id);
      } catch (error) {
        if (error instanceof Error && error.message === 'unauthorized') {
          return;
        }
        setBoardsError(error instanceof Error ? error.message : 'board_create_failed');
      } finally {
        setBoardCreateBusy(false);
      }
    },
    [apiRequest, boardDescription, boardName, boardVisibility, loadBoards, session],
  );

  const onCreateIdea = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      if (!session || !selectedBoardId) {
        return;
      }

      if (ideaTitle.trim().length < 4 || ideaDescription.trim().length < 8) {
        setIdeasError('Idea title and description are too short.');
        return;
      }

      setIdeaCreateBusy(true);
      setIdeasError(null);
      try {
        const created = await apiRequest<Idea>(
          `/workspaces/${session.workspaceId}/boards/${selectedBoardId}/ideas`,
          {
            method: 'POST',
            body: JSON.stringify({
              title: ideaTitle.trim(),
              description: ideaDescription.trim(),
            }),
          },
        );

        setIdeaTitle('');
        setIdeaDescription('');
        await loadIdeas(selectedBoardId);
        setSelectedIdeaId(created.id);
      } catch (error) {
        if (error instanceof Error && error.message === 'unauthorized') {
          return;
        }
        setIdeasError(error instanceof Error ? error.message : 'idea_create_failed');
      } finally {
        setIdeaCreateBusy(false);
      }
    },
    [apiRequest, ideaDescription, ideaTitle, loadIdeas, selectedBoardId, session],
  );

  const onToggleVote = useCallback(async () => {
    if (!session || !selectedBoardId || !selectedIdea) {
      return;
    }

    setIdeasError(null);
    try {
      const path = `/workspaces/${session.workspaceId}/boards/${selectedBoardId}/ideas/${selectedIdea.id}/votes`;
      const vote = await apiRequest<{ ideaId: string; voteCount: number; hasVoted: boolean }>(path, {
        method: selectedIdea.viewerHasVoted ? 'DELETE' : 'POST',
      });

      setIdeas((current) =>
        current.map((idea) =>
          idea.id === vote.ideaId
            ? {
                ...idea,
                voteCount: vote.voteCount,
                viewerHasVoted: vote.hasVoted,
              }
            : idea,
        ),
      );
    } catch (error) {
      if (error instanceof Error && error.message === 'unauthorized') {
        return;
      }
      setIdeasError(error instanceof Error ? error.message : 'vote_failed');
    }
  }, [apiRequest, selectedBoardId, selectedIdea, session]);

  const onCreateComment = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      if (!session || !selectedBoardId || !selectedIdeaId) {
        return;
      }

      if (commentBody.trim().length < 2) {
        setCommentsError('Comment must be at least 2 characters.');
        return;
      }

      setCommentBusy(true);
      setCommentsError(null);
      try {
        await apiRequest<IdeaComment>(
          `/workspaces/${session.workspaceId}/boards/${selectedBoardId}/ideas/${selectedIdeaId}/comments`,
          {
            method: 'POST',
            body: JSON.stringify({ body: commentBody.trim() }),
          },
        );

        setCommentBody('');
        await loadComments(selectedBoardId, selectedIdeaId);
        await loadIdeas(selectedBoardId);
      } catch (error) {
        if (error instanceof Error && error.message === 'unauthorized') {
          return;
        }
        setCommentsError(error instanceof Error ? error.message : 'comment_create_failed');
      } finally {
        setCommentBusy(false);
      }
    },
    [apiRequest, commentBody, loadComments, loadIdeas, selectedBoardId, selectedIdeaId, session],
  );

  const onUpdateStatus = useCallback(
    async (status: IdeaStatus) => {
      if (!session || !selectedBoardId || !selectedIdea) {
        return;
      }

      setStatusBusy(true);
      setIdeasError(null);
      try {
        const updated = await apiRequest<Idea>(
          `/workspaces/${session.workspaceId}/boards/${selectedBoardId}/ideas/${selectedIdea.id}/status`,
          {
            method: 'PATCH',
            body: JSON.stringify({ status }),
          },
        );

        setIdeas((current) =>
          current.map((idea) => (idea.id === updated.id ? { ...idea, status: updated.status } : idea)),
        );
      } catch (error) {
        if (error instanceof Error && error.message === 'unauthorized') {
          return;
        }
        setIdeasError(error instanceof Error ? error.message : 'status_update_failed');
      } finally {
        setStatusBusy(false);
      }
    },
    [apiRequest, selectedBoardId, selectedIdea, session],
  );

  if (!session) {
    return (
      <main className="page">
        <section className="panel auth-panel">
          <p className="eyebrow">CustomerVoice v1</p>
          <h1>Workspace Portal Sign In</h1>
          <p className="subtitle">
            Supports mock auth and Supabase JWT mode. Unauthorized API responses redirect back here.
          </p>

          <form className="form-grid" onSubmit={onSignIn}>
            <label>
              API Base URL
              <input value={apiBase} onChange={(event) => setApiBase(event.target.value)} />
            </label>
            <label>
              Workspace ID
              <select
                value={workspaceIdInput}
                onChange={(event) => setWorkspaceIdInput(event.target.value)}
              >
                {workspaceOptions.map((workspaceId) => (
                  <option key={workspaceId} value={workspaceId}>
                    {workspaceId}
                  </option>
                ))}
              </select>
            </label>
            <label>
              User ID
              <input value={userIdInput} onChange={(event) => setUserIdInput(event.target.value)} />
            </label>
            <label>
              User Email
              <input
                value={userEmailInput}
                onChange={(event) => setUserEmailInput(event.target.value)}
              />
            </label>
            <label>
              Role
              <select value={roleInput} onChange={(event) => setRoleInput(event.target.value as Role)}>
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
                value={accessTokenInput}
                onChange={(event) => setAccessTokenInput(event.target.value)}
                placeholder="Required when AUTH_MODE=supabase"
              />
            </label>
            <div className="button-row">
              <button type="submit">Sign In</button>
            </div>
          </form>

          <form
            className="inline-form"
            onSubmit={(event) => {
              event.preventDefault();
              const nextWorkspace = workspaceIdInput.trim();
              if (nextWorkspace.length === 0) {
                return;
              }
              setWorkspaceOptions((current) =>
                current.includes(nextWorkspace) ? current : [...current, nextWorkspace],
              );
            }}
          >
            <label>
              Add Workspace Profile
              <input
                placeholder="workspace-id"
                value={workspaceIdInput}
                onChange={(event) => setWorkspaceIdInput(event.target.value)}
              />
            </label>
            <button type="submit">Save Workspace</button>
          </form>

          {authNotice ? <p className="notice error">{authNotice}</p> : null}
        </section>
      </main>
    );
  }

  return (
    <main className="page">
      <section className="panel">
        <header className="topbar">
          <div>
            <p className="eyebrow">CustomerVoice v1</p>
            <h1>Feedback Portal Shell</h1>
            <p className="subtitle">Boards, ideas, votes, comments, and status management.</p>
          </div>
          <div className="topbar-actions">
            <button onClick={() => void loadBoards()} disabled={boardsLoading}>
              {boardsLoading ? 'Refreshing...' : 'Refresh'}
            </button>
            <button className="secondary" onClick={onSignOut}>
              Sign Out
            </button>
          </div>
        </header>

        <section className="session-strip">
          <label>
            API Base URL
            <input value={apiBase} onChange={(event) => setApiBase(event.target.value)} />
          </label>
          <label>
            Workspace
            <select
              value={session.workspaceId}
              onChange={(event) => onWorkspaceSwitch(event.target.value)}
            >
              {workspaceOptions.map((workspaceId) => (
                <option key={workspaceId} value={workspaceId}>
                  {workspaceId}
                </option>
              ))}
            </select>
          </label>
          <label>
            User
            <input value={`${session.userEmail} (${session.role})`} readOnly />
          </label>
        </section>

        {boardsError ? <p className="notice error">{boardsError}</p> : null}
        {ideasError ? <p className="notice error">{ideasError}</p> : null}
        {commentsError ? <p className="notice error">{commentsError}</p> : null}

        <section className="layout-grid">
          <article className="card">
            <h2>Boards</h2>
            <ul className="list selectable">
              {boards.length === 0 ? <li className="empty">No boards yet.</li> : null}
              {boards.map((board) => (
                <li key={board.id}>
                  <button
                    className={selectedBoardId === board.id ? 'selected' : ''}
                    onClick={() => setSelectedBoardId(board.id)}
                  >
                    <strong>{board.name}</strong>
                    <span>{board.visibility}</span>
                    <small>{board.slug}</small>
                  </button>
                </li>
              ))}
            </ul>

            <form className="stack" onSubmit={onCreateBoard}>
              <h3>Create Board</h3>
              <label>
                Name
                <input value={boardName} onChange={(event) => setBoardName(event.target.value)} />
              </label>
              <label>
                Description
                <textarea
                  rows={3}
                  value={boardDescription}
                  onChange={(event) => setBoardDescription(event.target.value)}
                />
              </label>
              <label>
                Visibility
                <select
                  value={boardVisibility}
                  onChange={(event) =>
                    setBoardVisibility(event.target.value as 'public' | 'private')
                  }
                >
                  <option value="public">public</option>
                  <option value="private">private</option>
                </select>
              </label>
              <button type="submit" disabled={boardCreateBusy}>
                {boardCreateBusy ? 'Creating...' : 'Create Board'}
              </button>
            </form>
          </article>

          <article className="card">
            <h2>Ideas {selectedBoard ? `for ${selectedBoard.name}` : ''}</h2>
            {!selectedBoard ? <p className="empty">Select a board to load ideas.</p> : null}
            {ideasLoading ? <p>Loading ideas...</p> : null}
            <ul className="list selectable ideas-list">
              {selectedBoard && ideas.length === 0 && !ideasLoading ? (
                <li className="empty">No ideas submitted yet.</li>
              ) : null}
              {ideas.map((idea) => (
                <li key={idea.id}>
                  <button
                    className={selectedIdeaId === idea.id ? 'selected' : ''}
                    onClick={() => setSelectedIdeaId(idea.id)}
                  >
                    <strong>{idea.title}</strong>
                    <span className={statusClassName[idea.status]}>{statusLabel[idea.status]}</span>
                    <small>
                      {idea.voteCount} votes · {idea.commentCount} comments
                    </small>
                  </button>
                </li>
              ))}
            </ul>

            {selectedBoard ? (
              <form className="stack" onSubmit={onCreateIdea}>
                <h3>Create Idea</h3>
                <label>
                  Title
                  <input value={ideaTitle} onChange={(event) => setIdeaTitle(event.target.value)} />
                </label>
                <label>
                  Description
                  <textarea
                    rows={4}
                    value={ideaDescription}
                    onChange={(event) => setIdeaDescription(event.target.value)}
                  />
                </label>
                <button type="submit" disabled={ideaCreateBusy}>
                  {ideaCreateBusy ? 'Creating...' : 'Create Idea'}
                </button>
              </form>
            ) : null}
          </article>

          <article className="card detail-card">
            <h2>Idea Detail</h2>
            {!selectedIdea ? <p className="empty">Select an idea to view votes and comments.</p> : null}
            {selectedIdea ? (
              <>
                <h3>{selectedIdea.title}</h3>
                <p>{selectedIdea.description}</p>
                <p className="meta-row">
                  <span className={statusClassName[selectedIdea.status]}>
                    {statusLabel[selectedIdea.status]}
                  </span>
                  <span>{selectedIdea.voteCount} votes</span>
                  <span>{selectedIdea.commentCount} comments</span>
                  <span>Updated {formatDate(selectedIdea.updatedAt)}</span>
                </p>

                <div className="button-row">
                  <button onClick={() => void onToggleVote()}>
                    {selectedIdea.viewerHasVoted ? 'Remove Vote' : 'Upvote Idea'}
                  </button>
                  {canManageStatus ? (
                    <select
                      value={selectedIdea.status}
                      disabled={statusBusy}
                      onChange={(event) => void onUpdateStatus(event.target.value as IdeaStatus)}
                    >
                      {statusOptions.map((status) => (
                        <option key={status} value={status}>
                          {statusLabel[status]}
                        </option>
                      ))}
                    </select>
                  ) : null}
                </div>

                <h4>Comments</h4>
                {commentsLoading ? <p>Loading comments...</p> : null}
                <ul className="list comments">
                  {comments.length === 0 && !commentsLoading ? (
                    <li className="empty">No comments yet.</li>
                  ) : null}
                  {comments.map((comment) => (
                    <li key={comment.id}>
                      <p>{comment.body}</p>
                      <small>
                        {comment.userEmail} · {formatDate(comment.createdAt)}
                      </small>
                    </li>
                  ))}
                </ul>

                <form className="stack" onSubmit={onCreateComment}>
                  <label>
                    Add Comment
                    <textarea
                      rows={3}
                      value={commentBody}
                      onChange={(event) => setCommentBody(event.target.value)}
                    />
                  </label>
                  <button type="submit" disabled={commentBusy}>
                    {commentBusy ? 'Posting...' : 'Post Comment'}
                  </button>
                </form>
              </>
            ) : null}
          </article>
        </section>
      </section>
    </main>
  );
}

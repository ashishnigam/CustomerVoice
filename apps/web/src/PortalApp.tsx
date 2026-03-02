import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

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

type IdeaModerationState = 'normal' | 'spam' | 'merged';

type IdeaSortMode = 'top_voted' | 'most_commented' | 'newest';

type TabKey = 'portal' | 'moderation' | 'analytics';

type Board = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  visibility: 'public' | 'private';
  active: boolean;
};

type IdeaCategory = {
  id: string;
  workspaceId: string;
  name: string;
  slug: string;
  colorHex: string | null;
  active: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

type Idea = {
  id: string;
  workspaceId: string;
  boardId: string;
  title: string;
  description: string;
  status: IdeaStatus;
  moderationState: IdeaModerationState;
  commentsLocked: boolean;
  mergedIntoIdeaId: string | null;
  active: boolean;
  createdBy: string;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
  voteCount: number;
  commentCount: number;
  viewerHasVoted: boolean;
  categoryIds: string[];
  categoryNames: string[];
  categorySlugs: string[];
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

type IdeaVote = {
  ideaId: string;
  voteCount: number;
  hasVoted: boolean;
};

type AnalyticsItem = {
  ideaId: string;
  boardId: string;
  title: string;
  status: IdeaStatus;
  moderationState: IdeaModerationState;
  voteCount: number;
  commentCount: number;
  reach: number;
  impact: number;
  confidence: number;
  effort: number;
  riceScore: number;
  revenuePotentialUsd: number;
  customerSegment: string | null;
  customerCount: number;
  contactEmails: string[];
};

type Session = {
  workspaceId: string;
  userId: string;
  userEmail: string;
  role: Role;
  accessToken: string;
};

type PortalAppProps = {
  path: string;
  onNavigate: (path: string) => void;
};

const defaultApiBase = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000/api/v1';
const defaultWorkspaceId = '22222222-2222-2222-2222-222222222222';
const defaultUserId = '33333333-3333-3333-3333-333333333333';
const defaultUserEmail = 'admin@customervoice.local';

const ideaStatusValues: IdeaStatus[] = [
  'new',
  'under_review',
  'accepted',
  'planned',
  'in_progress',
  'completed',
  'declined',
];

const moderationStateValues: IdeaModerationState[] = ['normal', 'spam', 'merged'];
const sortModes: IdeaSortMode[] = ['top_voted', 'most_commented', 'newest'];

const statusLabel: Record<IdeaStatus, string> = {
  new: 'New',
  under_review: 'Under Review',
  accepted: 'Accepted',
  planned: 'Planned',
  in_progress: 'In Progress',
  completed: 'Completed',
  declined: 'Declined',
};

const moderationLabel: Record<IdeaModerationState, string> = {
  normal: 'Normal',
  spam: 'Spam',
  merged: 'Merged',
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

const moderationClassName: Record<IdeaModerationState, string> = {
  normal: 'status status-normal',
  spam: 'status status-spam',
  merged: 'status status-merged',
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

function toCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

function isRoleAllowed(role: Role, allowedRoles: Role[]): boolean {
  return allowedRoles.includes(role);
}

function getBoardSlugFromPath(path: string): string | null {
  const match = path.match(/^\/app\/boards\/([^/?#]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

function getShareableBoardSlug(slug: string): string {
  return slug.replace(/-[0-9a-f]{8}$/, '');
}

function buildBoardPath(slug: string): string {
  return `/app/boards/${slug}`;
}

export function PortalApp({ path, onNavigate }: PortalAppProps): JSX.Element {
  const [apiBase, setApiBase] = useState(defaultApiBase);

  const [workspaceOptions, setWorkspaceOptions] = useState<string[]>([defaultWorkspaceId]);
  const [workspaceIdInput, setWorkspaceIdInput] = useState(defaultWorkspaceId);
  const [userIdInput, setUserIdInput] = useState(defaultUserId);
  const [userEmailInput, setUserEmailInput] = useState(defaultUserEmail);
  const [roleInput, setRoleInput] = useState<Role>('workspace_admin');
  const [accessTokenInput, setAccessTokenInput] = useState('');

  const [session, setSession] = useState<Session | null>(null);
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>('portal');

  const [boards, setBoards] = useState<Board[]>([]);
  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(null);
  const [boardsLoading, setBoardsLoading] = useState(false);
  const [boardsError, setBoardsError] = useState<string | null>(null);

  const [categories, setCategories] = useState<IdeaCategory[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);

  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [selectedIdeaId, setSelectedIdeaId] = useState<string | null>(null);
  const [ideasLoading, setIdeasLoading] = useState(false);
  const [ideasError, setIdeasError] = useState<string | null>(null);

  const [comments, setComments] = useState<IdeaComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsError, setCommentsError] = useState<string | null>(null);

  const [boardName, setBoardName] = useState('');
  const [boardDescription, setBoardDescription] = useState('');
  const [boardVisibility, setBoardVisibility] = useState<'public' | 'private'>('public');
  const [boardCreateBusy, setBoardCreateBusy] = useState(false);

  const [ideaTitle, setIdeaTitle] = useState('');
  const [ideaDescription, setIdeaDescription] = useState('');
  const [ideaCategoryDraft, setIdeaCategoryDraft] = useState<string[]>([]);
  const [ideaCreateBusy, setIdeaCreateBusy] = useState(false);

  const [commentBody, setCommentBody] = useState('');
  const [commentBusy, setCommentBusy] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);

  const [categoryName, setCategoryName] = useState('');
  const [categoryColorHex, setCategoryColorHex] = useState('#4E84C4');
  const [categoryBusy, setCategoryBusy] = useState(false);

  const [ideaSearch, setIdeaSearch] = useState('');
  const [ideaStatusFilter, setIdeaStatusFilter] = useState<'all' | IdeaStatus>('all');
  const [ideaCategoryFilter, setIdeaCategoryFilter] = useState<'all' | string>('all');
  const [ideaSort, setIdeaSort] = useState<IdeaSortMode>('top_voted');

  const [moderationIdeas, setModerationIdeas] = useState<Idea[]>([]);
  const [moderationLoading, setModerationLoading] = useState(false);
  const [moderationError, setModerationError] = useState<string | null>(null);
  const [moderationSearch, setModerationSearch] = useState('');
  const [moderationStateFilter, setModerationStateFilter] = useState<'all' | IdeaModerationState>('all');
  const [moderationSelection, setModerationSelection] = useState<string[]>([]);
  const [moderationBusy, setModerationBusy] = useState(false);
  const [mergeSourceIdeaId, setMergeSourceIdeaId] = useState('');
  const [mergeTargetIdeaId, setMergeTargetIdeaId] = useState('');

  const [analyticsItems, setAnalyticsItems] = useState<AnalyticsItem[]>([]);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [analyticsStatusFilter, setAnalyticsStatusFilter] = useState<'all' | IdeaStatus>('all');
  const [analyticsSegmentFilter, setAnalyticsSegmentFilter] = useState('');
  const [selectedAnalyticsIdeaId, setSelectedAnalyticsIdeaId] = useState<string | null>(null);
  const [analyticsInputBusy, setAnalyticsInputBusy] = useState(false);
  const [analyticsOutreachBusy, setAnalyticsOutreachBusy] = useState(false);

  const [reachInput, setReachInput] = useState(0);
  const [impactInput, setImpactInput] = useState(0);
  const [confidenceInput, setConfidenceInput] = useState(0.8);
  const [effortInput, setEffortInput] = useState(1);
  const [revenueInput, setRevenueInput] = useState(0);
  const [segmentInput, setSegmentInput] = useState('');
  const [customerCountInput, setCustomerCountInput] = useState(0);

  const [outreachSubject, setOutreachSubject] = useState('');
  const [outreachMessage, setOutreachMessage] = useState('');
  const [shareNotice, setShareNotice] = useState<string | null>(null);

  const baseUrl = useMemo(() => apiBase.replace(/\/+$/, ''), [apiBase]);
  const headers = useMemo(() => (session ? requestHeaders(session) : null), [session]);
  const routeBoardSlug = useMemo(() => getBoardSlugFromPath(path), [path]);

  const selectedBoard = useMemo(
    () => boards.find((board) => board.id === selectedBoardId) ?? null,
    [boards, selectedBoardId],
  );

  const selectedIdea = useMemo(
    () => ideas.find((idea) => idea.id === selectedIdeaId) ?? null,
    [ideas, selectedIdeaId],
  );

  const selectedAnalyticsIdea = useMemo(
    () => analyticsItems.find((item) => item.ideaId === selectedAnalyticsIdeaId) ?? null,
    [analyticsItems, selectedAnalyticsIdeaId],
  );
  const customerBoardUrl = useMemo(
    () =>
      selectedBoard
        ? `${window.location.origin}${buildBoardPath(getShareableBoardSlug(selectedBoard.slug))}`
        : null,
    [selectedBoard],
  );
  const openIdeaCount = useMemo(
    () => ideas.filter((idea) => !['completed', 'declined'].includes(idea.status)).length,
    [ideas],
  );
  const boardVoteCount = useMemo(
    () => ideas.reduce((total, idea) => total + idea.voteCount, 0),
    [ideas],
  );

  const canManageStatus = session ? rolesThatCanManageStatus.has(session.role) : false;

  const isModerationEnabled = session
    ? isRoleAllowed(session.role, ['tenant_admin', 'workspace_admin', 'product_manager', 'engineering_manager'])
    : false;

  const isAnalyticsEnabled = session
    ? isRoleAllowed(session.role, ['tenant_admin', 'workspace_admin', 'product_manager', 'engineering_manager'])
    : false;

  const clearWorkspaceView = useCallback(() => {
    setBoards([]);
    setCategories([]);
    setIdeas([]);
    setComments([]);
    setModerationIdeas([]);
    setAnalyticsItems([]);
    setSelectedBoardId(null);
    setSelectedIdeaId(null);
    setSelectedAnalyticsIdeaId(null);
    setModerationSelection([]);
    setBoardsError(null);
    setCategoriesError(null);
    setIdeasError(null);
    setCommentsError(null);
    setModerationError(null);
    setAnalyticsError(null);
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

      if (response.status === 204) {
        return {} as T;
      }

      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        return (await response.json()) as T;
      }

      return (await response.text()) as T;
    },
    [baseUrl, headers, handleUnauthorized],
  );

  const loadBoards = useCallback(async () => {
    if (!session) return;

    setBoardsLoading(true);
    setBoardsError(null);
    try {
      const data = await apiRequest<{ items: Board[] }>(
        `/workspaces/${session.workspaceId}/boards?includeInactive=false`,
      );
      setBoards(data.items);

      if (data.items.length === 0) {
        setSelectedBoardId(null);
      } else {
        const routeBoard = routeBoardSlug
          ? data.items.find(
              (item) => item.slug === routeBoardSlug || getShareableBoardSlug(item.slug) === routeBoardSlug,
            ) ?? null
          : null;

        if (routeBoard) {
          setSelectedBoardId(routeBoard.id);
        } else {
          setSelectedBoardId((current) =>
            current && data.items.some((item) => item.id === current) ? current : data.items[0].id,
          );
        }
      }
    } catch (error) {
      if (error instanceof Error && error.message === 'unauthorized') return;
      setBoardsError(error instanceof Error ? error.message : 'board_load_failed');
    } finally {
      setBoardsLoading(false);
    }
  }, [apiRequest, routeBoardSlug, session]);

  const loadCategories = useCallback(async () => {
    if (!session) return;

    setCategoriesLoading(true);
    setCategoriesError(null);
    try {
      const data = await apiRequest<{ items: IdeaCategory[] }>(
        `/workspaces/${session.workspaceId}/categories?includeInactive=false`,
      );
      setCategories(data.items);
    } catch (error) {
      if (error instanceof Error && error.message === 'unauthorized') return;
      setCategoriesError(error instanceof Error ? error.message : 'category_load_failed');
    } finally {
      setCategoriesLoading(false);
    }
  }, [apiRequest, session]);

  const loadIdeas = useCallback(async () => {
    if (!session || !selectedBoardId) return;

    setIdeasLoading(true);
    setIdeasError(null);
    try {
      const params = new URLSearchParams();
      params.set('sort', ideaSort);
      if (ideaSearch.trim().length > 0) params.set('search', ideaSearch.trim());
      if (ideaStatusFilter !== 'all') params.set('status', ideaStatusFilter);
      if (ideaCategoryFilter !== 'all') params.set('categoryIds', ideaCategoryFilter);

      const data = await apiRequest<{ items: Idea[] }>(
        `/workspaces/${session.workspaceId}/boards/${selectedBoardId}/ideas?${params.toString()}`,
      );

      setIdeas(data.items);

      if (data.items.length === 0) {
        setSelectedIdeaId(null);
      } else {
        setSelectedIdeaId((current) =>
          current && data.items.some((item) => item.id === current) ? current : data.items[0].id,
        );
      }
    } catch (error) {
      if (error instanceof Error && error.message === 'unauthorized') return;
      setIdeasError(error instanceof Error ? error.message : 'idea_load_failed');
    } finally {
      setIdeasLoading(false);
    }
  }, [apiRequest, ideaCategoryFilter, ideaSearch, ideaSort, ideaStatusFilter, selectedBoardId, session]);

  const loadComments = useCallback(async () => {
    if (!session || !selectedBoardId || !selectedIdeaId) {
      setComments([]);
      return;
    }

    setCommentsLoading(true);
    setCommentsError(null);
    try {
      const data = await apiRequest<{ items: IdeaComment[] }>(
        `/workspaces/${session.workspaceId}/boards/${selectedBoardId}/ideas/${selectedIdeaId}/comments`,
      );
      setComments(data.items);
    } catch (error) {
      if (error instanceof Error && error.message === 'unauthorized') return;
      setCommentsError(error instanceof Error ? error.message : 'comment_load_failed');
    } finally {
      setCommentsLoading(false);
    }
  }, [apiRequest, selectedBoardId, selectedIdeaId, session]);

  const loadModerationIdeas = useCallback(async () => {
    if (!session || !isModerationEnabled) return;

    setModerationLoading(true);
    setModerationError(null);
    try {
      const params = new URLSearchParams();
      if (selectedBoardId) params.set('boardId', selectedBoardId);
      if (moderationSearch.trim().length > 0) params.set('search', moderationSearch.trim());
      if (moderationStateFilter !== 'all') params.set('moderationState', moderationStateFilter);

      const data = await apiRequest<{ items: Idea[] }>(
        `/workspaces/${session.workspaceId}/moderation/ideas?${params.toString()}`,
      );
      setModerationIdeas(data.items);
      setModerationSelection((current) => current.filter((id) => data.items.some((item) => item.id === id)));
    } catch (error) {
      if (error instanceof Error && error.message === 'unauthorized') return;
      setModerationError(error instanceof Error ? error.message : 'moderation_load_failed');
    } finally {
      setModerationLoading(false);
    }
  }, [apiRequest, isModerationEnabled, moderationSearch, moderationStateFilter, selectedBoardId, session]);

  const loadAnalytics = useCallback(async () => {
    if (!session || !isAnalyticsEnabled) return;

    setAnalyticsLoading(true);
    setAnalyticsError(null);
    try {
      const params = new URLSearchParams();
      if (selectedBoardId) params.set('boardId', selectedBoardId);
      if (analyticsStatusFilter !== 'all') params.set('status', analyticsStatusFilter);
      if (analyticsSegmentFilter.trim().length > 0) params.set('customerSegment', analyticsSegmentFilter.trim());

      const data = await apiRequest<{ items: AnalyticsItem[] }>(
        `/workspaces/${session.workspaceId}/analytics/ideas?${params.toString()}`,
      );
      setAnalyticsItems(data.items);
      setSelectedAnalyticsIdeaId((current) =>
        current && data.items.some((item) => item.ideaId === current)
          ? current
          : data.items.length > 0
            ? data.items[0].ideaId
            : null,
      );
    } catch (error) {
      if (error instanceof Error && error.message === 'unauthorized') return;
      setAnalyticsError(error instanceof Error ? error.message : 'analytics_load_failed');
    } finally {
      setAnalyticsLoading(false);
    }
  }, [analyticsSegmentFilter, analyticsStatusFilter, apiRequest, isAnalyticsEnabled, selectedBoardId, session]);

  useEffect(() => {
    if (!session) return;
    void Promise.all([loadBoards(), loadCategories()]);
  }, [session, loadBoards, loadCategories]);

  useEffect(() => {
    if (routeBoardSlug) {
      setTab('portal');
    }
  }, [routeBoardSlug]);

  useEffect(() => {
    if (!routeBoardSlug || boards.length === 0) return;

    const matchedBoard =
      boards.find(
        (board) => board.slug === routeBoardSlug || getShareableBoardSlug(board.slug) === routeBoardSlug,
      ) ?? null;
    if (!matchedBoard) {
      setBoardsError(`Board slug "${routeBoardSlug}" was not found in this workspace.`);
      return;
    }

    setBoardsError((current) =>
      current?.includes('was not found in this workspace') ? null : current,
    );
    if (matchedBoard.id !== selectedBoardId) {
      setSelectedBoardId(matchedBoard.id);
    }
  }, [boards, routeBoardSlug, selectedBoardId]);

  useEffect(() => {
    if (!selectedBoard) return;
    if (tab !== 'portal') return;

    const nextPath = buildBoardPath(getShareableBoardSlug(selectedBoard.slug));
    if (path !== nextPath) {
      onNavigate(nextPath);
    }
  }, [onNavigate, path, selectedBoard, tab]);

  useEffect(() => {
    if (!session || !selectedBoardId) {
      setIdeas([]);
      return;
    }
    void loadIdeas();
  }, [session, selectedBoardId, ideaSearch, ideaStatusFilter, ideaCategoryFilter, ideaSort, loadIdeas]);

  useEffect(() => {
    void loadComments();
  }, [loadComments]);

  useEffect(() => {
    if (!session || !isModerationEnabled) return;
    if (tab !== 'moderation') return;
    void loadModerationIdeas();
  }, [session, isModerationEnabled, tab, selectedBoardId, moderationSearch, moderationStateFilter, loadModerationIdeas]);

  useEffect(() => {
    if (!session || !isAnalyticsEnabled) return;
    if (tab !== 'analytics') return;
    void loadAnalytics();
  }, [session, isAnalyticsEnabled, tab, selectedBoardId, analyticsStatusFilter, analyticsSegmentFilter, loadAnalytics]);

  useEffect(() => {
    if (!selectedAnalyticsIdea) return;
    setReachInput(selectedAnalyticsIdea.reach);
    setImpactInput(selectedAnalyticsIdea.impact);
    setConfidenceInput(selectedAnalyticsIdea.confidence);
    setEffortInput(selectedAnalyticsIdea.effort);
    setRevenueInput(selectedAnalyticsIdea.revenuePotentialUsd);
    setSegmentInput(selectedAnalyticsIdea.customerSegment ?? '');
    setCustomerCountInput(selectedAnalyticsIdea.customerCount);
    setOutreachSubject(`Update on: ${selectedAnalyticsIdea.title}`);
    setOutreachMessage(
      `Thanks for your feedback on "${selectedAnalyticsIdea.title}". We wanted to share an update.`,
    );
  }, [selectedAnalyticsIdea]);

  useEffect(() => {
    setShareNotice(null);
  }, [selectedBoardId]);

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
      setTab('portal');

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
      if (!session || nextWorkspaceId === session.workspaceId) return;

      clearWorkspaceView();
      setSession({ ...session, workspaceId: nextWorkspaceId });
      setWorkspaceIdInput(nextWorkspaceId);
      onNavigate('/app');
    },
    [clearWorkspaceView, onNavigate, session],
  );

  const onSelectBoard = useCallback(
    (boardId: string) => {
      setSelectedBoardId(boardId);
      const board = boards.find((item) => item.id === boardId) ?? null;
      if (board) {
        setTab('portal');
        onNavigate(buildBoardPath(getShareableBoardSlug(board.slug)));
      }
    },
    [boards, onNavigate],
  );

  const onCopyBoardLink = useCallback(async () => {
    if (!customerBoardUrl) return;

    try {
      await navigator.clipboard.writeText(customerBoardUrl);
      setShareNotice('Board link copied.');
    } catch {
      setShareNotice(customerBoardUrl);
    }
  }, [customerBoardUrl]);

  const onCreateBoard = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      if (!session) return;

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
        setTab('portal');
        onNavigate(buildBoardPath(getShareableBoardSlug(created.slug)));
      } catch (error) {
        if (error instanceof Error && error.message === 'unauthorized') return;
        setBoardsError(error instanceof Error ? error.message : 'board_create_failed');
      } finally {
        setBoardCreateBusy(false);
      }
    },
    [apiRequest, boardDescription, boardName, boardVisibility, loadBoards, onNavigate, session],
  );

  const onCreateCategory = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      if (!session) return;

      if (categoryName.trim().length < 2) {
        setCategoriesError('Category name must be at least 2 characters.');
        return;
      }

      setCategoryBusy(true);
      setCategoriesError(null);
      try {
        await apiRequest<IdeaCategory>(`/workspaces/${session.workspaceId}/categories`, {
          method: 'POST',
          body: JSON.stringify({
            name: categoryName.trim(),
            colorHex: categoryColorHex,
          }),
        });

        setCategoryName('');
        await loadCategories();
      } catch (error) {
        if (error instanceof Error && error.message === 'unauthorized') return;
        setCategoriesError(error instanceof Error ? error.message : 'category_create_failed');
      } finally {
        setCategoryBusy(false);
      }
    },
    [apiRequest, categoryColorHex, categoryName, loadCategories, session],
  );

  const onToggleIdeaCategoryDraft = useCallback((categoryId: string) => {
    setIdeaCategoryDraft((current) =>
      current.includes(categoryId)
        ? current.filter((item) => item !== categoryId)
        : [...current, categoryId],
    );
  }, []);

  const onCreateIdea = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      if (!session || !selectedBoardId) return;

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
              categoryIds: ideaCategoryDraft,
            }),
          },
        );

        setIdeaTitle('');
        setIdeaDescription('');
        setIdeaCategoryDraft([]);
        await loadIdeas();
        setSelectedIdeaId(created.id);
      } catch (error) {
        if (error instanceof Error && error.message === 'unauthorized') return;
        setIdeasError(error instanceof Error ? error.message : 'idea_create_failed');
      } finally {
        setIdeaCreateBusy(false);
      }
    },
    [apiRequest, ideaCategoryDraft, ideaDescription, ideaTitle, loadIdeas, selectedBoardId, session],
  );

  const onToggleVote = useCallback(async () => {
    if (!session || !selectedBoardId || !selectedIdea) return;

    setIdeasError(null);
    try {
      const path = `/workspaces/${session.workspaceId}/boards/${selectedBoardId}/ideas/${selectedIdea.id}/votes`;
      const vote = await apiRequest<IdeaVote>(path, {
        method: selectedIdea.viewerHasVoted ? 'DELETE' : 'POST',
      });

      setIdeas((current) =>
        current.map((idea) =>
          idea.id === vote.ideaId
            ? { ...idea, voteCount: vote.voteCount, viewerHasVoted: vote.hasVoted }
            : idea,
        ),
      );
    } catch (error) {
      if (error instanceof Error && error.message === 'unauthorized') return;
      setIdeasError(error instanceof Error ? error.message : 'vote_failed');
    }
  }, [apiRequest, selectedBoardId, selectedIdea, session]);

  const onCreateComment = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      if (!session || !selectedBoardId || !selectedIdeaId) return;

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
        await loadComments();
        await loadIdeas();
      } catch (error) {
        if (error instanceof Error && error.message === 'unauthorized') return;
        setCommentsError(error instanceof Error ? error.message : 'comment_create_failed');
      } finally {
        setCommentBusy(false);
      }
    },
    [apiRequest, commentBody, loadComments, loadIdeas, selectedBoardId, selectedIdeaId, session],
  );

  const onUpdateStatus = useCallback(
    async (status: IdeaStatus) => {
      if (!session || !selectedBoardId || !selectedIdea) return;

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
          current.map((idea) =>
            idea.id === updated.id
              ? {
                  ...idea,
                  status: updated.status,
                  moderationState: updated.moderationState,
                }
              : idea,
          ),
        );
      } catch (error) {
        if (error instanceof Error && error.message === 'unauthorized') return;
        setIdeasError(error instanceof Error ? error.message : 'status_update_failed');
      } finally {
        setStatusBusy(false);
      }
    },
    [apiRequest, selectedBoardId, selectedIdea, session],
  );

  const runModerationBulk = useCallback(
    async (action: 'mark_spam' | 'restore' | 'lock_comments' | 'unlock_comments') => {
      if (!session || moderationSelection.length === 0) return;

      setModerationBusy(true);
      setModerationError(null);
      try {
        await apiRequest<{ processed: string[]; skipped: { ideaId: string; reason: string }[] }>(
          `/workspaces/${session.workspaceId}/moderation/ideas/bulk`,
          {
            method: 'POST',
            body: JSON.stringify({ ideaIds: moderationSelection, action }),
          },
        );

        await Promise.all([loadModerationIdeas(), loadIdeas()]);
      } catch (error) {
        if (error instanceof Error && error.message === 'unauthorized') return;
        setModerationError(error instanceof Error ? error.message : 'moderation_bulk_failed');
      } finally {
        setModerationBusy(false);
      }
    },
    [apiRequest, loadIdeas, loadModerationIdeas, moderationSelection, session],
  );

  const onMergeIdeas = useCallback(async () => {
    if (!session) return;
    if (mergeSourceIdeaId.length === 0 || mergeTargetIdeaId.length === 0) {
      setModerationError('Select both source and target ideas for merge.');
      return;
    }

    setModerationBusy(true);
    setModerationError(null);
    try {
      await apiRequest<{ source: Idea; target: Idea }>(
        `/workspaces/${session.workspaceId}/moderation/ideas/merge`,
        {
          method: 'POST',
          body: JSON.stringify({
            sourceIdeaId: mergeSourceIdeaId,
            targetIdeaId: mergeTargetIdeaId,
          }),
        },
      );

      setMergeSourceIdeaId('');
      setMergeTargetIdeaId('');
      await Promise.all([loadModerationIdeas(), loadIdeas()]);
    } catch (error) {
      if (error instanceof Error && error.message === 'unauthorized') return;
      setModerationError(error instanceof Error ? error.message : 'idea_merge_failed');
    } finally {
      setModerationBusy(false);
    }
  }, [apiRequest, loadIdeas, loadModerationIdeas, mergeSourceIdeaId, mergeTargetIdeaId, session]);

  const onSaveAnalyticsInput = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      if (!session || !selectedAnalyticsIdeaId) return;

      setAnalyticsInputBusy(true);
      setAnalyticsError(null);
      try {
        await apiRequest<unknown>(
          `/workspaces/${session.workspaceId}/analytics/ideas/${selectedAnalyticsIdeaId}/input`,
          {
            method: 'PUT',
            body: JSON.stringify({
              reach: reachInput,
              impact: impactInput,
              confidence: confidenceInput,
              effort: effortInput,
              revenuePotentialUsd: revenueInput,
              customerSegment: segmentInput.trim().length > 0 ? segmentInput.trim() : undefined,
              customerCount: customerCountInput,
            }),
          },
        );

        await loadAnalytics();
      } catch (error) {
        if (error instanceof Error && error.message === 'unauthorized') return;
        setAnalyticsError(error instanceof Error ? error.message : 'analytics_input_save_failed');
      } finally {
        setAnalyticsInputBusy(false);
      }
    },
    [
      apiRequest,
      confidenceInput,
      customerCountInput,
      effortInput,
      impactInput,
      loadAnalytics,
      reachInput,
      revenueInput,
      segmentInput,
      selectedAnalyticsIdeaId,
      session,
    ],
  );

  const onSendOutreach = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      if (!session || !selectedAnalyticsIdeaId) return;

      if (outreachSubject.trim().length < 3 || outreachMessage.trim().length < 5) {
        setAnalyticsError('Outreach subject/message are too short.');
        return;
      }

      setAnalyticsOutreachBusy(true);
      setAnalyticsError(null);
      try {
        await apiRequest<{ notificationJobId: string; recipientCount: number }>(
          `/workspaces/${session.workspaceId}/analytics/ideas/${selectedAnalyticsIdeaId}/outreach`,
          {
            method: 'POST',
            body: JSON.stringify({
              subject: outreachSubject.trim(),
              message: outreachMessage.trim(),
            }),
          },
        );
      } catch (error) {
        if (error instanceof Error && error.message === 'unauthorized') return;
        setAnalyticsError(error instanceof Error ? error.message : 'analytics_outreach_failed');
      } finally {
        setAnalyticsOutreachBusy(false);
      }
    },
    [apiRequest, outreachMessage, outreachSubject, selectedAnalyticsIdeaId, session],
  );

  const onExportAnalyticsCsv = useCallback(async () => {
    if (!session) return;

    try {
      const params = new URLSearchParams();
      if (selectedBoardId) params.set('boardId', selectedBoardId);
      if (analyticsStatusFilter !== 'all') params.set('status', analyticsStatusFilter);
      if (analyticsSegmentFilter.trim().length > 0) params.set('customerSegment', analyticsSegmentFilter.trim());
      params.set('format', 'csv');

      const text = await apiRequest<string>(
        `/workspaces/${session.workspaceId}/analytics/ideas?${params.toString()}`,
      );

      const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'idea-analytics.csv';
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      if (error instanceof Error && error.message === 'unauthorized') return;
      setAnalyticsError(error instanceof Error ? error.message : 'analytics_export_failed');
    }
  }, [analyticsSegmentFilter, analyticsStatusFilter, apiRequest, selectedBoardId, session]);

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
              if (nextWorkspace.length === 0) return;
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
            <p className="eyebrow">CustomerVoice Workspace</p>
            <h1>Configure boards, then share a customer-facing request portal.</h1>
            <p className="subtitle">
              Boards and categories are setup layers. The real surface customers should experience is the shareable
              board view.
            </p>
          </div>
          <div className="topbar-actions">
            {selectedBoard ? (
              <button
                className="secondary"
                onClick={() => onNavigate(buildBoardPath(getShareableBoardSlug(selectedBoard.slug)))}
              >
                Open Board Route
              </button>
            ) : null}
            <button onClick={() => void Promise.all([loadBoards(), loadCategories()])} disabled={boardsLoading}>
              Refresh
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
            <select value={session.workspaceId} onChange={(event) => onWorkspaceSwitch(event.target.value)}>
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
          <label>
            Current Board URL
            <input value={customerBoardUrl ?? 'Create or select a board to generate a route'} readOnly />
          </label>
        </section>

        <nav className="tabbar">
          <button className={tab === 'portal' ? 'tab-active' : ''} onClick={() => setTab('portal')}>
            Portal
          </button>
          <button
            className={tab === 'moderation' ? 'tab-active' : ''}
            onClick={() => setTab('moderation')}
            disabled={!isModerationEnabled}
          >
            Moderation
          </button>
          <button
            className={tab === 'analytics' ? 'tab-active' : ''}
            onClick={() => setTab('analytics')}
            disabled={!isAnalyticsEnabled}
          >
            Analytics
          </button>
        </nav>

        {boardsError ? <p className="notice error">{boardsError}</p> : null}
        {categoriesError ? <p className="notice error">{categoriesError}</p> : null}
        {ideasError ? <p className="notice error">{ideasError}</p> : null}
        {commentsError ? <p className="notice error">{commentsError}</p> : null}
        {moderationError ? <p className="notice error">{moderationError}</p> : null}
        {analyticsError ? <p className="notice error">{analyticsError}</p> : null}

        {tab === 'portal' ? (
          <section className="board-shell">
            <aside className="board-sidebar">
              <article className="card board-directory-card">
                <p className="eyebrow">Board Directory</p>
                <h2>Choose the board customers should land on.</h2>
                <p className="subtitle">
                  Every board becomes a shareable route. Select the board you want to configure or preview.
                </p>
                <ul className="list selectable board-directory-list">
                  {boards.length === 0 ? <li className="empty">No boards yet.</li> : null}
                  {boards.map((board) => (
                    <li key={board.id}>
                      <button
                        className={selectedBoardId === board.id ? 'selected' : ''}
                        onClick={() => onSelectBoard(board.id)}
                      >
                        <strong>{board.name}</strong>
                        <span>{board.visibility === 'public' ? 'Public board' : 'Private board'}</span>
                        <small>{buildBoardPath(getShareableBoardSlug(board.slug))}</small>
                      </button>
                    </li>
                  ))}
                </ul>
              </article>

              <article className="card board-config-card">
                <p className="eyebrow">Board Setup</p>
                <h2>{selectedBoard ? `${selectedBoard.name} configuration` : 'Create your first board'}</h2>
                <p className="subtitle">
                  Create the board once, define the categories, then use the board route as the customer-facing request
                  portal.
                </p>

                {selectedBoard ? (
                  <div className="board-share-panel">
                    <label>
                      Canonical Board Route
                      <input value={customerBoardUrl ?? ''} readOnly />
                    </label>
                    <div className="button-row">
                      <button type="button" onClick={() => void onCopyBoardLink()}>
                        Copy Board Link
                      </button>
                      <button
                        type="button"
                        className="secondary"
                        onClick={() =>
                          onNavigate(buildBoardPath(getShareableBoardSlug(selectedBoard.slug)))
                        }
                      >
                        Open Board Preview
                      </button>
                    </div>
                    {shareNotice ? <p className="inline-note">{shareNotice}</p> : null}
                    <div className="board-setup-stats">
                      <div>
                        <strong>{selectedBoard.visibility}</strong>
                        <span>visibility</span>
                      </div>
                      <div>
                        <strong>{categories.length}</strong>
                        <span>categories</span>
                      </div>
                      <div>
                        <strong>{ideas.length}</strong>
                        <span>visible ideas</span>
                      </div>
                    </div>
                  </div>
                ) : null}

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
                      placeholder="Explain what customers should submit and what this board covers."
                    />
                  </label>
                  <label>
                    Visibility
                    <select
                      value={boardVisibility}
                      onChange={(event) => setBoardVisibility(event.target.value as 'public' | 'private')}
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

              <article className="card category-config-card">
                <p className="eyebrow">Category Setup</p>
                <h2>Structure the request intake.</h2>
                {categoriesLoading ? <p>Loading categories...</p> : null}
                <ul className="list compact-list category-list">
                  {categories.length === 0 ? <li className="empty">No categories yet.</li> : null}
                  {categories.map((category) => (
                    <li key={category.id}>
                      <span className="category-dot" style={{ background: category.colorHex ?? '#4E84C4' }} />
                      <span>{category.name}</span>
                    </li>
                  ))}
                </ul>
                <form className="stack" onSubmit={onCreateCategory}>
                  <h3>Create Category</h3>
                  <label>
                    Name
                    <input value={categoryName} onChange={(event) => setCategoryName(event.target.value)} />
                  </label>
                  <label>
                    Color Hex
                    <input
                      value={categoryColorHex}
                      onChange={(event) => setCategoryColorHex(event.target.value)}
                      placeholder="#4E84C4"
                    />
                  </label>
                  <button type="submit" disabled={categoryBusy}>
                    {categoryBusy ? 'Creating...' : 'Create Category'}
                  </button>
                </form>
              </article>
            </aside>

            <section className="board-main">
              {selectedBoard ? (
                <>
                  <article className="board-hero-card">
                    <div>
                      <p className="eyebrow">Customer Board Preview</p>
                      <h2>{selectedBoard.name}</h2>
                      <p className="subtitle">
                        {selectedBoard.description && selectedBoard.description.trim().length > 0
                          ? selectedBoard.description
                          : 'Use this board to collect feature requests, let customers vote, and keep roadmap decisions visible.'}
                      </p>
                    </div>
                    <div className="board-hero-actions">
                      <div className="board-hero-route">
                        <span>Shareable route</span>
                        <strong>{buildBoardPath(getShareableBoardSlug(selectedBoard.slug))}</strong>
                      </div>
                      <div className="button-row">
                        <button type="button" onClick={() => void onCopyBoardLink()}>
                          Copy Link
                        </button>
                        <button
                          type="button"
                          className="secondary"
                          onClick={() =>
                            onNavigate(buildBoardPath(getShareableBoardSlug(selectedBoard.slug)))
                          }
                        >
                          Stay On Board Route
                        </button>
                      </div>
                    </div>
                    <div className="board-hero-metrics">
                      <div>
                        <strong>{ideas.length}</strong>
                        <span>visible requests</span>
                      </div>
                      <div>
                        <strong>{openIdeaCount}</strong>
                        <span>open items</span>
                      </div>
                      <div>
                        <strong>{boardVoteCount}</strong>
                        <span>total votes</span>
                      </div>
                      <div>
                        <strong>{categories.length}</strong>
                        <span>category filters</span>
                      </div>
                    </div>
                  </article>

                  <div className="board-preview-grid">
                    <article className="card board-ideas-card">
                      <div className="section-heading-row">
                        <div>
                          <p className="eyebrow">Customer Experience</p>
                          <h2>Feature requests, voting, and discovery</h2>
                        </div>
                        <small className="route-chip">
                          {buildBoardPath(getShareableBoardSlug(selectedBoard.slug))}
                        </small>
                      </div>

                      <div className="filter-grid">
                        <label>
                          Search
                          <input
                            value={ideaSearch}
                            onChange={(event) => setIdeaSearch(event.target.value)}
                            placeholder="Search ideas"
                          />
                        </label>
                        <label>
                          Status
                          <select
                            value={ideaStatusFilter}
                            onChange={(event) => setIdeaStatusFilter(event.target.value as 'all' | IdeaStatus)}
                          >
                            <option value="all">all</option>
                            {ideaStatusValues.map((status) => (
                              <option key={status} value={status}>
                                {statusLabel[status]}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          Category
                          <select
                            value={ideaCategoryFilter}
                            onChange={(event) => setIdeaCategoryFilter(event.target.value as 'all' | string)}
                          >
                            <option value="all">all</option>
                            {categories.map((category) => (
                              <option key={category.id} value={category.id}>
                                {category.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          Sort
                          <select value={ideaSort} onChange={(event) => setIdeaSort(event.target.value as IdeaSortMode)}>
                            {sortModes.map((mode) => (
                              <option key={mode} value={mode}>
                                {mode}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>

                      {ideasLoading ? <p>Loading ideas...</p> : null}
                      <ul className="list selectable ideas-list board-idea-list">
                        {selectedBoard && ideas.length === 0 && !ideasLoading ? (
                          <li className="empty">No ideas found for current filters.</li>
                        ) : null}
                        {ideas.map((idea) => (
                          <li key={idea.id}>
                            <button
                              className={selectedIdeaId === idea.id ? 'selected' : ''}
                              onClick={() => setSelectedIdeaId(idea.id)}
                            >
                              <div className="idea-card-topline">
                                <strong>{idea.title}</strong>
                                <span className="vote-pill">{idea.voteCount} votes</span>
                              </div>
                              <p className="idea-excerpt">{idea.description}</p>
                              <div className="status-row">
                                <span className={statusClassName[idea.status]}>{statusLabel[idea.status]}</span>
                                <span className={moderationClassName[idea.moderationState]}>
                                  {moderationLabel[idea.moderationState]}
                                </span>
                              </div>
                              {idea.categoryNames.length > 0 ? (
                                <div className="pill-row">
                                  {idea.categoryNames.map((categoryName) => (
                                    <span className="category-pill" key={`${idea.id}-${categoryName}`}>
                                      {categoryName}
                                    </span>
                                  ))}
                                </div>
                              ) : null}
                              <small>{idea.commentCount} comments · updated {formatDate(idea.updatedAt)}</small>
                            </button>
                          </li>
                        ))}
                      </ul>

                      <form className="stack board-submit-form" onSubmit={onCreateIdea}>
                        <h3>Submit a feature request</h3>
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
                            placeholder="Describe the user problem, desired outcome, and any business impact."
                          />
                        </label>
                        {categories.length > 0 ? (
                          <fieldset className="category-select-grid">
                            <legend>Categories</legend>
                            {categories.map((category) => (
                              <label key={category.id} className="checkbox-row">
                                <input
                                  type="checkbox"
                                  checked={ideaCategoryDraft.includes(category.id)}
                                  onChange={() => onToggleIdeaCategoryDraft(category.id)}
                                />
                                <span>{category.name}</span>
                              </label>
                            ))}
                          </fieldset>
                        ) : null}
                        <button type="submit" disabled={ideaCreateBusy}>
                          {ideaCreateBusy ? 'Submitting...' : 'Submit Idea'}
                        </button>
                      </form>
                    </article>

                    <article className="card detail-card board-detail-card">
                      <p className="eyebrow">Idea Detail</p>
                      {!selectedIdea ? <p className="empty">Select an idea to view details.</p> : null}
                      {selectedIdea ? (
                        <>
                          <h2>{selectedIdea.title}</h2>
                          <p>{selectedIdea.description}</p>
                          <p className="meta-row">
                            <span className={statusClassName[selectedIdea.status]}>
                              {statusLabel[selectedIdea.status]}
                            </span>
                            <span className={moderationClassName[selectedIdea.moderationState]}>
                              {moderationLabel[selectedIdea.moderationState]}
                            </span>
                            <span>{selectedIdea.voteCount} votes</span>
                            <span>{selectedIdea.commentCount} comments</span>
                            <span>Updated {formatDate(selectedIdea.updatedAt)}</span>
                          </p>

                          {selectedIdea.categoryNames.length > 0 ? (
                            <div className="pill-row">
                              {selectedIdea.categoryNames.map((categoryName) => (
                                <span className="category-pill" key={`detail-${categoryName}`}>
                                  {categoryName}
                                </span>
                              ))}
                            </div>
                          ) : null}

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
                                {ideaStatusValues.map((status) => (
                                  <option key={status} value={status}>
                                    {statusLabel[status]}
                                  </option>
                                ))}
                              </select>
                            ) : null}
                          </div>

                          <h3>Comments</h3>
                          {selectedIdea.commentsLocked ? (
                            <p className="locked-note">Comments are locked by moderation.</p>
                          ) : null}
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
                                disabled={selectedIdea.commentsLocked}
                              />
                            </label>
                            <button type="submit" disabled={commentBusy || selectedIdea.commentsLocked}>
                              {commentBusy ? 'Posting...' : 'Post Comment'}
                            </button>
                          </form>
                        </>
                      ) : null}
                    </article>
                  </div>
                </>
              ) : (
                <article className="card board-empty-state">
                  <p className="eyebrow">Start Here</p>
                  <h2>Create a board first.</h2>
                  <p className="subtitle">
                    Once a board exists, CustomerVoice will generate a canonical board route that you can bookmark,
                    share, and use as the main customer-facing request experience.
                  </p>
                </article>
              )}
            </section>
          </section>
        ) : null}

        {tab === 'moderation' ? (
          <section className="layout-grid layout-moderation">
            <article className="card">
              <h2>Moderation Queue</h2>
              <div className="filter-grid">
                <label>
                  Search
                  <input
                    value={moderationSearch}
                    onChange={(event) => setModerationSearch(event.target.value)}
                    placeholder="Search moderation queue"
                  />
                </label>
                <label>
                  State
                  <select
                    value={moderationStateFilter}
                    onChange={(event) =>
                      setModerationStateFilter(event.target.value as 'all' | IdeaModerationState)
                    }
                  >
                    <option value="all">all</option>
                    {moderationStateValues.map((state) => (
                      <option key={state} value={state}>
                        {moderationLabel[state]}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="button-row align-end">
                  <button onClick={() => void loadModerationIdeas()} disabled={moderationLoading}>
                    {moderationLoading ? 'Loading...' : 'Refresh'}
                  </button>
                </div>
              </div>

              <div className="button-row moderation-actions">
                <button onClick={() => void runModerationBulk('mark_spam')} disabled={moderationBusy || moderationSelection.length === 0}>
                  Mark Spam
                </button>
                <button onClick={() => void runModerationBulk('restore')} disabled={moderationBusy || moderationSelection.length === 0}>
                  Restore
                </button>
                <button onClick={() => void runModerationBulk('lock_comments')} disabled={moderationBusy || moderationSelection.length === 0}>
                  Lock Comments
                </button>
                <button onClick={() => void runModerationBulk('unlock_comments')} disabled={moderationBusy || moderationSelection.length === 0}>
                  Unlock Comments
                </button>
              </div>

              <ul className="list moderation-list">
                {moderationIdeas.length === 0 && !moderationLoading ? <li className="empty">No moderation items.</li> : null}
                {moderationIdeas.map((idea) => (
                  <li key={idea.id}>
                    <label className="moderation-item">
                      <input
                        type="checkbox"
                        checked={moderationSelection.includes(idea.id)}
                        onChange={(event) => {
                          if (event.target.checked) {
                            setModerationSelection((current) => [...current, idea.id]);
                          } else {
                            setModerationSelection((current) => current.filter((id) => id !== idea.id));
                          }
                        }}
                      />
                      <div>
                        <strong>{idea.title}</strong>
                        <p className="meta-row">
                          <span className={statusClassName[idea.status]}>{statusLabel[idea.status]}</span>
                          <span className={moderationClassName[idea.moderationState]}>
                            {moderationLabel[idea.moderationState]}
                          </span>
                          <span>{idea.voteCount} votes</span>
                          <span>{idea.commentCount} comments</span>
                        </p>
                      </div>
                    </label>
                  </li>
                ))}
              </ul>
            </article>

            <article className="card">
              <h2>Merge Duplicate Ideas</h2>
              <p className="subtitle">Select source idea to merge into target idea.</p>
              <label>
                Source Idea
                <select value={mergeSourceIdeaId} onChange={(event) => setMergeSourceIdeaId(event.target.value)}>
                  <option value="">select source</option>
                  {moderationIdeas.map((idea) => (
                    <option key={idea.id} value={idea.id}>
                      {idea.title}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Target Idea
                <select value={mergeTargetIdeaId} onChange={(event) => setMergeTargetIdeaId(event.target.value)}>
                  <option value="">select target</option>
                  {moderationIdeas.map((idea) => (
                    <option key={idea.id} value={idea.id}>
                      {idea.title}
                    </option>
                  ))}
                </select>
              </label>
              <div className="button-row">
                <button onClick={() => void onMergeIdeas()} disabled={moderationBusy}>
                  {moderationBusy ? 'Merging...' : 'Merge Ideas'}
                </button>
              </div>
            </article>
          </section>
        ) : null}

        {tab === 'analytics' ? (
          <section className="layout-grid layout-analytics">
            <article className="card">
              <h2>Analytics Dashboard</h2>
              <div className="filter-grid">
                <label>
                  Status
                  <select
                    value={analyticsStatusFilter}
                    onChange={(event) => setAnalyticsStatusFilter(event.target.value as 'all' | IdeaStatus)}
                  >
                    <option value="all">all</option>
                    {ideaStatusValues.map((status) => (
                      <option key={status} value={status}>
                        {statusLabel[status]}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Segment
                  <input
                    value={analyticsSegmentFilter}
                    onChange={(event) => setAnalyticsSegmentFilter(event.target.value)}
                    placeholder="segment filter"
                  />
                </label>
                <div className="button-row align-end">
                  <button onClick={() => void loadAnalytics()} disabled={analyticsLoading}>
                    Refresh
                  </button>
                  <button onClick={() => void onExportAnalyticsCsv()} disabled={analyticsLoading}>
                    Export CSV
                  </button>
                </div>
              </div>

              <ul className="list analytics-list">
                {analyticsItems.length === 0 && !analyticsLoading ? (
                  <li className="empty">No analytics rows available.</li>
                ) : null}
                {analyticsItems.map((item) => (
                  <li key={item.ideaId}>
                    <button
                      className={selectedAnalyticsIdeaId === item.ideaId ? 'selected' : ''}
                      onClick={() => setSelectedAnalyticsIdeaId(item.ideaId)}
                    >
                      <strong>{item.title}</strong>
                      <small>
                        RICE {item.riceScore.toFixed(2)} · Revenue {toCurrency(item.revenuePotentialUsd)} · Contacts{' '}
                        {item.contactEmails.length}
                      </small>
                    </button>
                  </li>
                ))}
              </ul>
            </article>

            <article className="card detail-card">
              <h2>RICE and Revenue Input</h2>
              {!selectedAnalyticsIdea ? <p className="empty">Select an idea from analytics list.</p> : null}
              {selectedAnalyticsIdea ? (
                <>
                  <h3>{selectedAnalyticsIdea.title}</h3>
                  <p className="meta-row">
                    <span className={statusClassName[selectedAnalyticsIdea.status]}>
                      {statusLabel[selectedAnalyticsIdea.status]}
                    </span>
                    <span>Votes: {selectedAnalyticsIdea.voteCount}</span>
                    <span>Comments: {selectedAnalyticsIdea.commentCount}</span>
                  </p>

                  <form className="stack" onSubmit={onSaveAnalyticsInput}>
                    <div className="grid two-col">
                      <label>
                        Reach
                        <input
                          type="number"
                          value={reachInput}
                          onChange={(event) => setReachInput(Number(event.target.value))}
                        />
                      </label>
                      <label>
                        Impact
                        <input
                          type="number"
                          step="0.1"
                          value={impactInput}
                          onChange={(event) => setImpactInput(Number(event.target.value))}
                        />
                      </label>
                      <label>
                        Confidence (0-1)
                        <input
                          type="number"
                          step="0.01"
                          value={confidenceInput}
                          onChange={(event) => setConfidenceInput(Number(event.target.value))}
                        />
                      </label>
                      <label>
                        Effort
                        <input
                          type="number"
                          step="0.1"
                          value={effortInput}
                          onChange={(event) => setEffortInput(Number(event.target.value))}
                        />
                      </label>
                      <label>
                        Revenue Potential USD
                        <input
                          type="number"
                          value={revenueInput}
                          onChange={(event) => setRevenueInput(Number(event.target.value))}
                        />
                      </label>
                      <label>
                        Customer Count
                        <input
                          type="number"
                          value={customerCountInput}
                          onChange={(event) => setCustomerCountInput(Number(event.target.value))}
                        />
                      </label>
                    </div>
                    <label>
                      Customer Segment
                      <input value={segmentInput} onChange={(event) => setSegmentInput(event.target.value)} />
                    </label>
                    <button type="submit" disabled={analyticsInputBusy}>
                      {analyticsInputBusy ? 'Saving...' : 'Save Analytics Input'}
                    </button>
                  </form>

                  <h3>Outreach Trigger</h3>
                  <p className="subtitle">Recipients are resolved from upvoters and commenters.</p>
                  <form className="stack" onSubmit={onSendOutreach}>
                    <label>
                      Subject
                      <input
                        value={outreachSubject}
                        onChange={(event) => setOutreachSubject(event.target.value)}
                      />
                    </label>
                    <label>
                      Message
                      <textarea
                        rows={4}
                        value={outreachMessage}
                        onChange={(event) => setOutreachMessage(event.target.value)}
                      />
                    </label>
                    <button type="submit" disabled={analyticsOutreachBusy}>
                      {analyticsOutreachBusy ? 'Enqueuing...' : 'Send Outreach Job'}
                    </button>
                  </form>

                  <h4>Contact Emails</h4>
                  <ul className="list compact-list">
                    {selectedAnalyticsIdea.contactEmails.length === 0 ? (
                      <li className="empty">No audience contacts yet.</li>
                    ) : null}
                    {selectedAnalyticsIdea.contactEmails.map((email) => (
                      <li key={email}>{email}</li>
                    ))}
                  </ul>
                </>
              ) : null}
            </article>
          </section>
        ) : null}
      </section>
    </main>
  );
}

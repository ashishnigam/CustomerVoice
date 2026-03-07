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
  visibility: 'public' | 'private' | 'link_only';
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
  impactScore: number;
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

type ApiHealthState = {
  status: 'idle' | 'checking' | 'ok' | 'error';
  message: string;
  checkedAt: string | null;
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

function buildHealthUrl(apiBase: string): string | null {
  try {
    const parsed = new URL(apiBase, window.location.origin);
    return new URL('/health', parsed.origin).toString();
  } catch {
    return null;
  }
}

function formatRoleLabel(role: Role): string {
  return role
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_categoriesLoading, setCategoriesLoading] = useState(false);
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
  const [apiHealth, setApiHealth] = useState<ApiHealthState>({
    status: 'idle',
    message: 'API connection has not been checked yet.',
    checkedAt: null,
  });

  const baseUrl = useMemo(() => apiBase.replace(/\/+$/, ''), [apiBase]);
  const headers = useMemo(() => (session ? requestHeaders(session) : null), [session]);
  const routeBoardSlug = useMemo(() => getBoardSlugFromPath(path), [path]);
  const healthUrl = useMemo(() => buildHealthUrl(apiBase), [apiBase]);

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
        ? `${window.location.origin}/portal/boards/${getShareableBoardSlug(selectedBoard.slug)}`
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
  const completedIdeaCount = useMemo(
    () => ideas.filter((idea) => idea.status === 'completed').length,
    [ideas],
  );
  const moderationIssueCount = useMemo(
    () =>
      moderationIdeas.filter(
        (idea) => idea.moderationState !== 'normal' || idea.commentsLocked,
      ).length,
    [moderationIdeas],
  );
  const analyticsAudienceCount = useMemo(
    () => analyticsItems.reduce((total, item) => total + item.contactEmails.length, 0),
    [analyticsItems],
  );
  const highestRiceIdea = useMemo(
    () =>
      analyticsItems.reduce<AnalyticsItem | null>(
        (best, item) => (best === null || item.riceScore > best.riceScore ? item : best),
        null,
      ),
    [analyticsItems],
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

  const checkApiHealth = useCallback(async () => {
    if (!healthUrl) {
      setApiHealth({
        status: 'error',
        message: 'API Base URL is not a valid URL.',
        checkedAt: new Date().toISOString(),
      });
      return;
    }

    setApiHealth({
      status: 'checking',
      message: `Checking ${healthUrl}`,
      checkedAt: null,
    });

    try {
      const response = await fetch(healthUrl);
      if (!response.ok) {
        throw new Error(`Health check failed (${response.status})`);
      }

      setApiHealth({
        status: 'ok',
        message: 'API is reachable and returned a healthy response.',
        checkedAt: new Date().toISOString(),
      });
    } catch (error) {
      setApiHealth({
        status: 'error',
        message: error instanceof Error ? error.message : 'Unable to reach API health endpoint.',
        checkedAt: new Date().toISOString(),
      });
    }
  }, [healthUrl]);

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
    void checkApiHealth();
  }, [checkApiHealth]);

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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _onWorkspaceSwitch = useCallback(
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


  /* ── group ideas by status for Kanban columns ── */
  const kanbanColumns: { status: IdeaStatus; label: string; color: string }[] = [
    { status: 'new', label: 'New', color: '#6366f1' },
    { status: 'under_review', label: 'Under Review', color: '#f59e0b' },
    { status: 'accepted', label: 'Accepted', color: '#10b981' },
    { status: 'planned', label: 'Planned', color: '#2a78b7' },
    { status: 'in_progress', label: 'In Progress', color: '#3b82f6' },
    { status: 'completed', label: 'Completed', color: '#22c55e' },
    { status: 'declined', label: 'Declined', color: '#ef4444' },
  ];

  const ideasByStatus = useMemo(() => {
    const map = new Map<IdeaStatus, Idea[]>();
    for (const col of kanbanColumns) {
      map.set(col.status, []);
    }
    for (const idea of ideas) {
      const bucket = map.get(idea.status);
      if (bucket) bucket.push(idea);
    }
    return map;
  }, [ideas]);

  /* ── public portal status filter tabs ── */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _publicStatusTabs: { value: 'all' | IdeaStatus; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'new', label: 'New' },
    { value: 'planned', label: 'Planned' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'completed', label: 'Completed' },
  ];

  /* ── Render: detail slide-over panel ── */
  function renderDetailSlideover(): JSX.Element | null {
    if (!selectedIdea) return null;
    return (
      <>
        <div className="detail-overlay" onClick={() => setSelectedIdeaId(null)} />
        <aside className="detail-slideover">
          <header className="detail-slideover-header">
            <h2>Idea Detail</h2>
            <button className="detail-close-btn" onClick={() => setSelectedIdeaId(null)}>✕</button>
          </header>
          <div className="detail-slideover-body">
            <h1 className="detail-title">{selectedIdea.title}</h1>
            <p className="detail-description">{selectedIdea.description}</p>

            <div className="detail-meta-grid">
              <div className="detail-meta-item">
                <span>Status</span>
                <strong><span className={statusClassName[selectedIdea.status]}>{statusLabel[selectedIdea.status]}</span></strong>
              </div>
              <div className="detail-meta-item">
                <span>Votes</span>
                <strong>{selectedIdea.voteCount}</strong>
              </div>
              <div className="detail-meta-item">
                <span>Comments</span>
                <strong>{selectedIdea.commentCount}</strong>
              </div>
              <div className="detail-meta-item">
                <span>Updated</span>
                <strong>{formatDate(selectedIdea.updatedAt)}</strong>
              </div>
            </div>

            {selectedIdea.categoryNames.length > 0 ? (
              <div className="pill-row">
                {selectedIdea.categoryNames.map((cat) => (
                  <span className="category-pill" key={`d-${cat}`}>{cat}</span>
                ))}
              </div>
            ) : null}

            <div className="detail-actions">
              <button
                className={`detail-vote-btn ${selectedIdea.viewerHasVoted ? 'voted' : ''}`}
                onClick={() => void onToggleVote()}
              >
                {selectedIdea.viewerHasVoted ? '✓ Voted' : '▲ Upvote'}
              </button>
              {canManageStatus ? (
                <select
                  value={selectedIdea.status}
                  disabled={statusBusy}
                  onChange={(event) => void onUpdateStatus(event.target.value as IdeaStatus)}
                >
                  {ideaStatusValues.map((s) => (
                    <option key={s} value={s}>{statusLabel[s]}</option>
                  ))}
                </select>
              ) : null}
            </div>

            <h3 className="detail-section-title">Comments ({comments.length})</h3>
            {selectedIdea.commentsLocked ? (
              <p className="locked-note">Comments are locked by moderation.</p>
            ) : null}
            {commentsLoading ? <p className="empty">Loading comments…</p> : null}
            {comments.map((c) => (
              <div className="detail-comment" key={c.id}>
                <p>{c.body}</p>
                <small>{c.userEmail} · {formatDate(c.createdAt)}</small>
              </div>
            ))}
            {comments.length === 0 && !commentsLoading ? (
              <p className="empty">No comments yet.</p>
            ) : null}

            <form className="detail-comment-form" onSubmit={onCreateComment}>
              <textarea
                rows={3}
                value={commentBody}
                onChange={(e) => setCommentBody(e.target.value)}
                placeholder="Add a comment…"
                disabled={selectedIdea.commentsLocked}
              />
              <button type="submit" disabled={commentBusy || selectedIdea.commentsLocked} className="btn-sm">
                {commentBusy ? 'Posting…' : 'Post Comment'}
              </button>
            </form>
          </div>
        </aside>
      </>
    );
  }

  /* ════════════════════════════════════════
     AUTH SHELL (not signed in)
     ════════════════════════════════════════ */
  if (!session) {
    return (
      <main className="page">
        <section className="auth-shell">
          <article className="auth-story-card">
            <p className="eyebrow">CustomerVoice Operator Console</p>
            <h1>Make the public request board feel calm, clear, and worth returning to.</h1>
            <p>The customer surface should stay simple. Operators handle routing, moderation, and prioritization from this workspace shell.</p>

            <div className="auth-story-grid">
              <section className="auth-story-section">
                <p className="eyebrow">Recommended local mode</p>
                <h2>Mock auth with seeded workspace data</h2>
                <p>Use the default IDs below unless you are testing Supabase mode intentionally.</p>
                <div className="pill-row" style={{ marginTop: '10px' }}>
                  <span className="category-pill">Workspace {defaultWorkspaceId.slice(0, 8)}…</span>
                  <span className="category-pill">Admin {defaultUserId.slice(0, 8)}…</span>
                  <span className="category-pill">Role {formatRoleLabel(roleInput)}</span>
                </div>
              </section>
              <section className="auth-story-section">
                <p className="eyebrow">Connection status</p>
                <div className={`health-pill health-${apiHealth.status}`}>
                  <strong>{apiHealth.status === 'ok' ? 'API ready' : apiHealth.status === 'checking' ? 'Checking API' : apiHealth.status === 'error' ? 'API unreachable' : 'Not checked'}</strong>
                  <span>{apiHealth.message}</span>
                </div>
                <div className="button-row" style={{ marginTop: '10px' }}>
                  <button type="button" onClick={() => void checkApiHealth()} disabled={apiHealth.status === 'checking'} className="btn-sm">
                    {apiHealth.status === 'checking' ? 'Checking…' : 'Check API'}
                  </button>
                </div>
              </section>
            </div>
          </article>

          <section className="auth-panel">
            <p className="eyebrow">Workspace access</p>
            <h2>Sign in to the operator view</h2>
            <p className="subtitle" style={{ marginBottom: '16px' }}>Supports mock auth and Supabase JWT mode.</p>

            <form className="form-grid" onSubmit={onSignIn}>
              <label>API Base URL<input value={apiBase} onChange={(e) => setApiBase(e.target.value)} /></label>
              <label>Workspace ID
                <select value={workspaceIdInput} onChange={(e) => setWorkspaceIdInput(e.target.value)}>
                  {workspaceOptions.map((w) => <option key={w} value={w}>{w}</option>)}
                </select>
              </label>
              <label>User ID<input value={userIdInput} onChange={(e) => setUserIdInput(e.target.value)} /></label>
              <label>User Email<input value={userEmailInput} onChange={(e) => setUserEmailInput(e.target.value)} /></label>
              <label>Role
                <select value={roleInput} onChange={(e) => setRoleInput(e.target.value as Role)}>
                  <option value="tenant_admin">tenant_admin</option>
                  <option value="workspace_admin">workspace_admin</option>
                  <option value="product_manager">product_manager</option>
                  <option value="engineering_manager">engineering_manager</option>
                  <option value="contributor">contributor</option>
                  <option value="viewer">viewer</option>
                </select>
              </label>
              <label>Access Token (optional)<input value={accessTokenInput} onChange={(e) => setAccessTokenInput(e.target.value)} placeholder="Required when AUTH_MODE=supabase" /></label>
              <div className="button-row"><button type="submit">Enter workspace</button></div>
            </form>

            <form className="inline-form" onSubmit={(e) => { e.preventDefault(); const n = workspaceIdInput.trim(); if (n.length === 0) return; setWorkspaceOptions((c) => c.includes(n) ? c : [...c, n]); }}>
              <label>Save workspace profile<input placeholder="workspace-id" value={workspaceIdInput} onChange={(e) => setWorkspaceIdInput(e.target.value)} /></label>
              <button type="submit" className="btn-sm">Save</button>
            </form>

            {authNotice ? <p className="notice error">{authNotice}</p> : null}
          </section>
        </section>
      </main>
    );
  }

  /* ════════════════════════════════════════
     OPERATOR DASHBOARD (signed in)
     ════════════════════════════════════════ */
  return (
    <div className="dashboard-layout">
      {/* ── Top Toolbar ── */}
      <header className="dash-toolbar">
        <div className="dash-toolbar-brand">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M8 12l2 2 4-4" /></svg>
          CustomerVoice
        </div>
        <div className="dash-toolbar-search">
          <input
            value={ideaSearch}
            onChange={(e) => setIdeaSearch(e.target.value)}
            placeholder="Search ideas…"
          />
        </div>
        <div className="dash-toolbar-actions">
          <div className="user-badge">
            {session.userEmail}
            <span className="role-tag">{formatRoleLabel(session.role)}</span>
          </div>
          <button className="btn-sm secondary" onClick={() => void Promise.all([loadBoards(), loadCategories()])} disabled={boardsLoading}>↻ Refresh</button>
          <button className="btn-sm secondary" onClick={onSignOut}>Sign out</button>
        </div>
      </header>

      {/* ── Sidebar ── */}
      <nav className="dash-sidebar">
        <div className="dash-sidebar-section">
          <div className="dash-sidebar-section-title">Boards</div>
          {boards.length === 0 ? <p className="empty" style={{ padding: '0 12px', fontSize: '0.82rem' }}>No boards yet</p> : null}
          {boards.map((board) => (
            <button
              key={board.id}
              className={`dash-sidebar-item ${selectedBoardId === board.id ? 'active' : ''}`}
              onClick={() => onSelectBoard(board.id)}
            >
              <span className="sidebar-icon">📋</span>
              {board.name}
              <span
                className={`sidebar-board-vis ${board.visibility}`}
                onClick={(e) => {
                  e.stopPropagation();
                  if (board.visibility === 'public' || board.visibility === 'link_only') {
                    window.open(`/portal/boards/${getShareableBoardSlug(board.slug)}`, '_blank');
                  }
                }}
                title={board.visibility === 'public' ? 'Public Portal (Click to view)' : board.visibility === 'link_only' ? 'Link Only (Click to view)' : 'Private'}
              >
                {board.visibility === 'public' ? '🌐' : board.visibility === 'link_only' ? '🔗' : '🔒'}
              </span>
            </button>
          ))}
        </div>

        <div className="dash-sidebar-section">
          <div className="dash-sidebar-section-title">Workspace</div>
          <button className={`dash-sidebar-item ${tab === 'portal' ? 'active' : ''}`} onClick={() => setTab('portal')}>
            <span className="sidebar-icon">📊</span>Kanban Board
          </button>
          {isModerationEnabled ? (
            <button className={`dash-sidebar-item ${tab === 'moderation' ? 'active' : ''}`} onClick={() => setTab('moderation')}>
              <span className="sidebar-icon">🛡️</span>Moderation
              {moderationIssueCount > 0 ? <span className="sidebar-badge">{moderationIssueCount}</span> : null}
            </button>
          ) : null}
          {isAnalyticsEnabled ? (
            <button className={`dash-sidebar-item ${tab === 'analytics' ? 'active' : ''}`} onClick={() => setTab('analytics')}>
              <span className="sidebar-icon">📈</span>Insights
            </button>
          ) : null}
        </div>

        {selectedBoard ? (
          <div className="dash-sidebar-section" style={{ marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid var(--cv-border)' }}>
            <div className="dash-sidebar-section-title">Board Link</div>
            <button className="dash-sidebar-item" onClick={() => void onCopyBoardLink()} style={{ fontSize: '0.78rem' }}>
              <span className="sidebar-icon">🔗</span>Copy public link
            </button>
            {shareNotice ? <p className="inline-note" style={{ padding: '0 12px' }}>{shareNotice}</p> : null}
          </div>
        ) : null}

        {/* Board create in sidebar */}
        <div className="dash-sidebar-section">
          <form className="board-create-form" onSubmit={onCreateBoard}>
            <h3>New Board</h3>
            <label>Name<input value={boardName} onChange={(e) => setBoardName(e.target.value)} placeholder="e.g. Feature Requests" /></label>
            <label>Visibility
              <select value={boardVisibility} onChange={(e) => setBoardVisibility(e.target.value as 'public' | 'private')}>
                <option value="public">Public</option>
                <option value="private">Private</option>
              </select>
            </label>
            <button type="submit" disabled={boardCreateBusy} className="btn-sm">{boardCreateBusy ? 'Creating…' : 'Create'}</button>
          </form>
        </div>
      </nav>

      {/* ── Main Content ── */}
      <main className="dash-main">
        {/* Error notices */}
        {boardsError ? <p className="notice error">{boardsError}</p> : null}
        {categoriesError ? <p className="notice error">{categoriesError}</p> : null}
        {ideasError ? <p className="notice error">{ideasError}</p> : null}
        {commentsError ? <p className="notice error">{commentsError}</p> : null}
        {moderationError ? <p className="notice error">{moderationError}</p> : null}
        {analyticsError ? <p className="notice error">{analyticsError}</p> : null}

        {tab === 'portal' ? (
          <>
            {/* Summary stats */}
            <div className="summary-stats-row">
              <div className="summary-stat"><span>Open Requests</span><strong>{openIdeaCount}</strong></div>
              <div className="summary-stat"><span>Total Votes</span><strong>{boardVoteCount}</strong></div>
              <div className="summary-stat"><span>Completed</span><strong>{completedIdeaCount}</strong></div>
              <div className="summary-stat"><span>Categories</span><strong>{categories.length}</strong></div>
            </div>

            {/* Kanban header */}
            <div className="kanban-header">
              <h2>{selectedBoard ? selectedBoard.name : 'Select a board'}</h2>
              <div className="kanban-header-right">
                <select value={ideaStatusFilter} onChange={(e) => setIdeaStatusFilter(e.target.value as 'all' | IdeaStatus)}>
                  <option value="all">All statuses</option>
                  {kanbanColumns.map((c) => <option key={c.status} value={c.status}>{c.label}</option>)}
                </select>
                <select value={ideaCategoryFilter} onChange={(e) => setIdeaCategoryFilter(e.target.value)}>
                  <option value="all">All categories</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <select value={ideaSort} onChange={(e) => setIdeaSort(e.target.value as IdeaSortMode)}>
                  {sortModes.map((m) => <option key={m} value={m}>{m.replace('_', ' ')}</option>)}
                </select>
              </div>
            </div>

            {ideasLoading ? <p className="empty">Loading ideas…</p> : null}

            {!selectedBoard ? (
              <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                <h2 style={{ marginBottom: '8px' }}>Create a board to get started</h2>
                <p className="subtitle">Use the sidebar to create your first feedback board.</p>
              </div>
            ) : (
              <div className="kanban-board">
                {kanbanColumns.map((col) => {
                  const columnIdeas = ideasByStatus.get(col.status) ?? [];
                  return (
                    <div className="kanban-column" key={col.status}>
                      <div className="kanban-column-header">
                        <span className="kanban-column-dot" style={{ background: col.color }} />
                        <span className="kanban-column-title">{col.label}</span>
                        <span className="kanban-column-count">{columnIdeas.length}</span>
                      </div>
                      <div className="kanban-column-body">
                        {columnIdeas.map((idea) => (
                          <button
                            key={idea.id}
                            className={`kanban-card ${selectedIdeaId === idea.id ? 'active' : ''}`}
                            onClick={() => setSelectedIdeaId(idea.id)}
                          >
                            <span className="kanban-card-title">{idea.title}</span>
                            <div className="kanban-card-meta">
                              <span className="kanban-card-vote">▲ {idea.voteCount} / ${idea.impactScore || 0}</span>
                              <span className="kanban-card-comments">💬 {idea.commentCount}</span>
                            </div>
                            {idea.categoryNames.length > 0 ? (
                              <div className="pill-row">
                                {idea.categoryNames.map((cat) => (
                                  <span className="category-pill" key={`k-${idea.id}-${cat}`}>{cat}</span>
                                ))}
                              </div>
                            ) : null}
                          </button>
                        ))}
                        {columnIdeas.length === 0 ? <p className="empty" style={{ padding: '12px', textAlign: 'center' }}>No ideas</p> : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Submit idea form */}
            {selectedBoard ? (
              <div className="public-submit-section" style={{ marginTop: '20px' }}>
                <h3>Submit a feature request</h3>
                <form className="public-form" onSubmit={onCreateIdea}>
                  <label>Title<input value={ideaTitle} onChange={(e) => setIdeaTitle(e.target.value)} placeholder="Brief summary of the feature" /></label>
                  <label>Description<textarea rows={3} value={ideaDescription} onChange={(e) => setIdeaDescription(e.target.value)} placeholder="Describe the user problem and desired outcome" /></label>
                  {categories.length > 0 ? (
                    <fieldset className="category-select-grid">
                      <legend>Categories</legend>
                      {categories.map((c) => (
                        <label key={c.id} className="checkbox-row">
                          <input type="checkbox" checked={ideaCategoryDraft.includes(c.id)} onChange={() => onToggleIdeaCategoryDraft(c.id)} />
                          <span>{c.name}</span>
                        </label>
                      ))}
                    </fieldset>
                  ) : null}
                  <button type="submit" disabled={ideaCreateBusy}>{ideaCreateBusy ? 'Submitting…' : 'Submit Idea'}</button>
                </form>
              </div>
            ) : null}

            {/* Category management */}
            {selectedBoard ? (
              <div className="board-create-form" style={{ marginTop: '16px' }}>
                <h3>Manage Categories</h3>
                <div className="pill-row" style={{ marginBottom: '8px' }}>
                  {categories.map((c) => (
                    <span className="category-pill" key={c.id} style={{ borderLeftColor: c.colorHex ?? '#4E84C4', borderLeftWidth: '3px', borderLeftStyle: 'solid' }}>
                      {c.name}
                    </span>
                  ))}
                  {categories.length === 0 ? <span className="empty">No categories yet</span> : null}
                </div>
                <form className="public-form" onSubmit={onCreateCategory} style={{ gridTemplateColumns: '1fr auto auto', alignItems: 'end' }}>
                  <label>Name<input value={categoryName} onChange={(e) => setCategoryName(e.target.value)} placeholder="Category name" /></label>
                  <label>Color<input value={categoryColorHex} onChange={(e) => setCategoryColorHex(e.target.value)} type="color" style={{ width: '48px', padding: '4px' }} /></label>
                  <button type="submit" disabled={categoryBusy} className="btn-sm">{categoryBusy ? '…' : 'Add'}</button>
                </form>
              </div>
            ) : null}
          </>
        ) : null}

        {
          tab === 'moderation' ? (
            <div className="mod-panel">
              <div className="mod-panel-header">
                <h2>🛡️ Moderation Queue</h2>
                <div className="button-row">
                  <button className="btn-sm" onClick={() => void loadModerationIdeas()} disabled={moderationLoading}>{moderationLoading ? 'Loading…' : 'Refresh'}</button>
                </div>
              </div>

              <div className="summary-stats-row">
                <div className="summary-stat"><span>Selected</span><strong>{moderationSelection.length}</strong></div>
                <div className="summary-stat"><span>Flagged</span><strong>{moderationIssueCount}</strong></div>
                <div className="summary-stat"><span>In Queue</span><strong>{moderationIdeas.length}</strong></div>
              </div>

              <div className="filter-grid">
                <label>Search<input value={moderationSearch} onChange={(e) => setModerationSearch(e.target.value)} placeholder="Search queue" /></label>
                <label>State
                  <select value={moderationStateFilter} onChange={(e) => setModerationStateFilter(e.target.value as 'all' | IdeaModerationState)}>
                    <option value="all">All</option>
                    {moderationStateValues.map((s) => <option key={s} value={s}>{moderationLabel[s]}</option>)}
                  </select>
                </label>
              </div>

              <div className="mod-actions-bar">
                <button className="btn-sm" onClick={() => void runModerationBulk('mark_spam')} disabled={moderationBusy || moderationSelection.length === 0}>🚫 Mark Spam</button>
                <button className="btn-sm secondary" onClick={() => void runModerationBulk('restore')} disabled={moderationBusy || moderationSelection.length === 0}>✓ Restore</button>
                <button className="btn-sm secondary" onClick={() => void runModerationBulk('lock_comments')} disabled={moderationBusy || moderationSelection.length === 0}>🔒 Lock Comments</button>
                <button className="btn-sm secondary" onClick={() => void runModerationBulk('unlock_comments')} disabled={moderationBusy || moderationSelection.length === 0}>🔓 Unlock</button>
              </div>

              <div className="list">
                {moderationIdeas.length === 0 && !moderationLoading ? <p className="empty">No moderation items.</p> : null}
                {moderationIdeas.map((idea) => (
                  <div className="mod-idea-row" key={idea.id}>
                    <input
                      type="checkbox"
                      checked={moderationSelection.includes(idea.id)}
                      onChange={(e) => {
                        if (e.target.checked) setModerationSelection((c) => [...c, idea.id]);
                        else setModerationSelection((c) => c.filter((id) => id !== idea.id));
                      }}
                    />
                    <div>
                      <strong>{idea.title}</strong>
                      <div className="meta-row">
                        <span className={statusClassName[idea.status]}>{statusLabel[idea.status]}</span>
                        <span className={moderationClassName[idea.moderationState]}>{moderationLabel[idea.moderationState]}</span>
                        <span>{idea.voteCount} votes</span>
                        <span>&middot;</span>
                        <span>{idea.impactScore ? `$${idea.impactScore.toFixed(2)} MRR` : '$0 MRR'}</span>
                        <span>{idea.commentCount} comments</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mod-merge-section">
                <h3>Merge Duplicate Ideas</h3>
                <label>Source Idea
                  <select value={mergeSourceIdeaId} onChange={(e) => setMergeSourceIdeaId(e.target.value)}>
                    <option value="">Select source</option>
                    {moderationIdeas.map((i) => <option key={i.id} value={i.id}>{i.title}</option>)}
                  </select>
                </label>
                <label>Target Idea
                  <select value={mergeTargetIdeaId} onChange={(e) => setMergeTargetIdeaId(e.target.value)}>
                    <option value="">Select target</option>
                    {moderationIdeas.map((i) => <option key={i.id} value={i.id}>{i.title}</option>)}
                  </select>
                </label>
                <button onClick={() => void onMergeIdeas()} disabled={moderationBusy} className="btn-sm">
                  {moderationBusy ? 'Merging…' : 'Merge Ideas'}
                </button>
              </div>
            </div>
          ) : null
        }

        {
          tab === 'analytics' ? (
            <div className="analytics-panel">
              <div className="analytics-panel-header">
                <h2>📈 Insights & Prioritization</h2>
                <div className="button-row">
                  <button className="btn-sm" onClick={() => void loadAnalytics()} disabled={analyticsLoading}>Refresh</button>
                  <button className="btn-sm secondary" onClick={() => void onExportAnalyticsCsv()} disabled={analyticsLoading}>Export CSV</button>
                </div>
              </div>

              <div className="summary-stats-row">
                <div className="summary-stat"><span>Ideas Scored</span><strong>{analyticsItems.length}</strong></div>
                <div className="summary-stat"><span>Audience</span><strong>{analyticsAudienceCount}</strong></div>
                <div className="summary-stat"><span>Top RICE</span><strong>{highestRiceIdea ? highestRiceIdea.riceScore.toFixed(1) : '0.0'}</strong></div>
              </div>

              <div className="filter-grid">
                <label>Status
                  <select value={analyticsStatusFilter} onChange={(e) => setAnalyticsStatusFilter(e.target.value as 'all' | IdeaStatus)}>
                    <option value="all">All statuses</option>
                    {ideaStatusValues.map((s) => <option key={s} value={s}>{statusLabel[s]}</option>)}
                  </select>
                </label>
                <label>Segment<input value={analyticsSegmentFilter} onChange={(e) => setAnalyticsSegmentFilter(e.target.value)} placeholder="Filter by segment" /></label>
              </div>

              <div className="analytics-grid">
                <div className="analytics-list-card">
                  <div className="acard-header"><strong>Ideas</strong></div>
                  <div className="acard-body">
                    {analyticsItems.length === 0 && !analyticsLoading ? <p className="empty">No analytics data</p> : null}
                    {analyticsItems.map((item) => (
                      <button key={item.ideaId} className={`analytics-idea-btn ${selectedAnalyticsIdeaId === item.ideaId ? 'active' : ''}`} onClick={() => setSelectedAnalyticsIdeaId(item.ideaId)}>
                        <strong>{item.title}</strong>
                        <small>RICE {item.riceScore.toFixed(2)} · {toCurrency(item.revenuePotentialUsd)} · {item.contactEmails.length} contacts</small>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="analytics-detail-card">
                  {!selectedAnalyticsIdea ? <p className="empty">Select an idea from the list.</p> : (
                    <>
                      <h3>{selectedAnalyticsIdea.title}</h3>
                      <div className="meta-row">
                        <span className={statusClassName[selectedAnalyticsIdea.status]}>{statusLabel[selectedAnalyticsIdea.status]}</span>
                        <span>Votes: {selectedAnalyticsIdea.voteCount}</span>
                        <span>Comments: {selectedAnalyticsIdea.commentCount}</span>
                      </div>

                      <form className="stack" onSubmit={onSaveAnalyticsInput}>
                        <div className="grid two-col">
                          <label>Reach<input type="number" value={reachInput} onChange={(e) => setReachInput(Number(e.target.value))} /></label>
                          <label>Impact<input type="number" step="0.1" value={impactInput} onChange={(e) => setImpactInput(Number(e.target.value))} /></label>
                          <label>Confidence (0-1)<input type="number" step="0.01" value={confidenceInput} onChange={(e) => setConfidenceInput(Number(e.target.value))} /></label>
                          <label>Effort<input type="number" step="0.1" value={effortInput} onChange={(e) => setEffortInput(Number(e.target.value))} /></label>
                          <label>Revenue USD<input type="number" value={revenueInput} onChange={(e) => setRevenueInput(Number(e.target.value))} /></label>
                          <label>Customer Count<input type="number" value={customerCountInput} onChange={(e) => setCustomerCountInput(Number(e.target.value))} /></label>
                        </div>
                        <label>Segment<input value={segmentInput} onChange={(e) => setSegmentInput(e.target.value)} /></label>
                        <button type="submit" disabled={analyticsInputBusy} className="btn-sm">{analyticsInputBusy ? 'Saving…' : 'Save Analytics Input'}</button>
                      </form>

                      <h3 className="detail-section-title">Outreach</h3>
                      <form className="stack" onSubmit={onSendOutreach}>
                        <label>Subject<input value={outreachSubject} onChange={(e) => setOutreachSubject(e.target.value)} /></label>
                        <label>Message<textarea rows={3} value={outreachMessage} onChange={(e) => setOutreachMessage(e.target.value)} /></label>
                        <button type="submit" disabled={analyticsOutreachBusy} className="btn-sm">{analyticsOutreachBusy ? 'Sending…' : 'Send Outreach'}</button>
                      </form>

                      <h3 className="detail-section-title">Contact Emails</h3>
                      <ul className="list compact-list">
                        {selectedAnalyticsIdea.contactEmails.length === 0 ? <li className="empty">No contacts yet</li> : null}
                        {selectedAnalyticsIdea.contactEmails.map((email) => <li key={email}>{email}</li>)}
                      </ul>
                    </>
                  )}
                </div>
              </div>
            </div>
          ) : null
        }

        {renderDetailSlideover()}
      </main >
    </div >
  );
}

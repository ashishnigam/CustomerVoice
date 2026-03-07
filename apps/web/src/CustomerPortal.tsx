import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/* ── Types ── */
type IdeaStatus = 'new' | 'under_review' | 'accepted' | 'planned' | 'in_progress' | 'completed' | 'declined';
type IdeaSortMode = 'top_voted' | 'most_commented' | 'newest' | 'highest_impact';
type PortalAccessMode = 'public' | 'link_only' | 'private' | 'domain_restricted';

interface Board {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    visibility: 'public' | 'private';
    _accessRestricted?: boolean;
    _accessMode?: PortalAccessMode;
    _accessDeniedReason?: 'auth_required' | 'domain_not_allowed';
}

interface BoardSettings {
    boardId: string;
    accessMode: PortalAccessMode;
    allowedDomains?: string[];
    allowedEmails?: string[];
    requireAuthToVote: boolean;
    requireAuthToComment: boolean;
    requireAuthToSubmit: boolean;
    allowAnonymousIdeas: boolean;
    enableIdeaSubmission: boolean;
    enableCommenting: boolean;
    showVoteCount: boolean;
    showStatusFilter: boolean;
    showCategoryFilter: boolean;
    portalTitle: string | null;
    welcomeMessage: string | null;
    customAccentColor: string | null;
    customLogoUrl: string | null;
    headerBgColor?: string | null;
    customCss?: string | null;
    fontFamily?: string | null;
    hidePoweredBy?: boolean;
}

interface IdeaCategory {
    id: string;
    name: string;
    slug: string;
    colorHex: string | null;
}

export interface Attachment {
    id: string;
    fileName: string;
    fileUrl: string;
    contentType: string;
    sizeBytes: number;
    createdAt: string;
}

interface Idea {
    id: string;
    title: string;
    description: string;
    status: IdeaStatus;
    voteCount: number;
    commentCount: number;
    mergedIntoId?: string | null;
    mergedIntoIdeaId?: string | null;
    viewerHasVoted: boolean;
    categoryIds: string[];
    categoryNames: string[];
    createdAt: string;
    updatedAt: string;
    attachments?: Attachment[];
}

interface IdeaComment {
    id: string;
    body: string;
    userEmail: string;
    isOfficial: boolean;
    isTeamMember: boolean;
    isInternal?: boolean;
    createdAt: string;
    upvoteCount?: number;
    viewerHasUpvoted?: boolean;
    parentCommentId?: string | null;
    replies?: IdeaComment[];
    attachments?: Attachment[];
}

interface ChangelogEntry {
    id: string;
    title: string;
    content: string;
    createdAt: string;
    authorName: string | null;
}

interface IdeaVote {
    ideaId: string;
    voteCount: number;
    hasVoted: boolean;
}

interface PortalUser {
    id: string;
    email: string;
    displayName: string | null;
    avatarUrl: string | null;
}

interface CustomerPortalProps {
    path: string;
    onNavigate: (path: string) => void;
}

interface CommentCreatePayload {
    body: string;
    isInternal: boolean;
    parentCommentId?: string;
}

/* ── Constants ── */
const apiBase = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000/api/v1').replace(/\/+$/, '');
const portalTokenStorageKey = 'cv_portal_token';
const portalPostAuthPathStorageKey = 'cv_portal_post_auth_path';

function isAuthCallbackPath(path: string): boolean {
    return path === '/portal/callback' || path === '/portal/auth/callback';
}

function parseSsoDomainInput(value: string): string {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return '';
    if (normalized.includes('@')) {
        return normalized.split('@').pop() ?? '';
    }
    return normalized.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
}

function getOrCreateVisitorId(): string {
    const key = 'cv_visitor_id';
    let id = localStorage.getItem(key);
    if (!id) {
        id = crypto.randomUUID();
        localStorage.setItem(key, id);
    }
    return id;
}

const statusConfig: Record<IdeaStatus, { label: string; color: string; icon: string }> = {
    new: { label: 'New', color: '#6366f1', icon: '✨' },
    under_review: { label: 'Under Review', color: '#f59e0b', icon: '🔍' },
    accepted: { label: 'Accepted', color: '#10b981', icon: '✅' },
    planned: { label: 'Planned', color: '#2a78b7', icon: '📋' },
    in_progress: { label: 'In Progress', color: '#3b82f6', icon: '⚡' },
    completed: { label: 'Completed', color: '#22c55e', icon: '🎉' },
    declined: { label: 'Declined', color: '#ef4444', icon: '✗' },
};

const publicStatusTabs: { value: 'all' | IdeaStatus; label: string }[] = [
    { value: 'all', label: 'All Ideas' },
    { value: 'new', label: 'New' },
    { value: 'planned', label: 'Planned' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'completed', label: 'Completed' },
];

const sortOptions: { value: IdeaSortMode; label: string; icon: string }[] = [
    { value: 'top_voted', label: 'Top Voted', icon: '🔥' },
    { value: 'most_commented', label: 'Most Discussed', icon: '💬' },
    { value: 'newest', label: 'Newest', icon: '🕐' },
    { value: 'highest_impact', label: 'Highest Impact', icon: '💰' },
];

function buildCommentTree(comments: IdeaComment[]): IdeaComment[] {
    const map = new Map<string, IdeaComment>();
    const roots: IdeaComment[] = [];

    for (const c of comments) {
        map.set(c.id, { ...c, replies: [] });
    }

    for (const c of map.values()) {
        if (c.parentCommentId && map.has(c.parentCommentId)) {
            map.get(c.parentCommentId)!.replies!.push(c);
        } else {
            roots.push(c);
        }
    }
    return roots;
}

function formatDate(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getSlugFromPath(path: string): string | null {
    const match = path.match(/^\/portal\/boards\/([^/?#]+)/);
    return match ? decodeURIComponent(match[1]) : null;
}

function getIdeaIdFromPath(path: string): string | null {
    const match = path.match(/^\/portal\/boards\/[^/?#]+\/ideas\/([^/?#]+)/);
    return match ? decodeURIComponent(match[1]) : null;
}

const defaultSettings: BoardSettings = {
    boardId: '',
    accessMode: 'public',
    requireAuthToVote: false,
    requireAuthToComment: true,
    requireAuthToSubmit: true,
    allowAnonymousIdeas: false,
    enableIdeaSubmission: true,
    enableCommenting: true,
    showVoteCount: true,
    showStatusFilter: true,
    showCategoryFilter: true,
    portalTitle: null,
    welcomeMessage: null,
    customAccentColor: null,
    customLogoUrl: null,
};

/* ── Component ── */
export function CustomerPortal({ path }: CustomerPortalProps): JSX.Element {
    const visitorId = useMemo(() => getOrCreateVisitorId(), []);
    const boardSlug = useMemo(() => getSlugFromPath(path), [path]);
    const deepLinkIdeaId = useMemo(() => getIdeaIdFromPath(path), [path]);

    /* ── Auth State ── */
    const [portalUser, setPortalUser] = useState<PortalUser | null>(null);
    const [authToken, setAuthToken] = useState<string | null>(() => localStorage.getItem(portalTokenStorageKey));
    const [showAuthModal, setShowAuthModal] = useState(false);
    const [authMode, setAuthMode] = useState<'login' | 'register' | 'forgot-password'>('login');
    const [authEmail, setAuthEmail] = useState('');
    const [authPassword, setAuthPassword] = useState('');
    const [authDisplayName, setAuthDisplayName] = useState('');
    const [authError, setAuthError] = useState<string | null>(null);
    const [authSuccess, setAuthSuccess] = useState<string | null>(null);
    const [authBusy, setAuthBusy] = useState(false);
    const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
    const [callbackStatus, setCallbackStatus] = useState<'idle' | 'processing' | 'error'>('idle');
    const [callbackError, setCallbackError] = useState<string | null>(null);
    const [ssoDomainInput, setSsoDomainInput] = useState('');
    const [ssoError, setSsoError] = useState<string | null>(null);

    /* ── Password Reset ── */
    const [resetToken, setResetToken] = useState<string | null>(null);
    const [newPassword, setNewPassword] = useState('');
    const [resetBusy, setResetBusy] = useState(false);
    const [resetError, setResetError] = useState<string | null>(null);
    const [resetSuccess, setResetSuccess] = useState(false);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const authTokenFromCallback = params.get('token');
        if (authTokenFromCallback) {
            localStorage.setItem(portalTokenStorageKey, authTokenFromCallback);
            setAuthToken(authTokenFromCallback);
            setCallbackStatus('processing');
            setCallbackError(null);
            setShowAuthModal(false);

            const storedPath = localStorage.getItem(portalPostAuthPathStorageKey);
            localStorage.removeItem(portalPostAuthPathStorageKey);

            const nextPath =
                storedPath && !isAuthCallbackPath(new URL(storedPath, window.location.origin).pathname)
                    ? storedPath
                    : '/';

            window.location.replace(nextPath);
            return;
        }

        if (isAuthCallbackPath(path)) {
            setCallbackStatus('error');
            setCallbackError('Authentication callback did not include a session token.');
            return;
        }

        setCallbackStatus('idle');
        setCallbackError(null);

        const resetTokenFromUrl = params.get('reset_token');
        if (resetTokenFromUrl) {
            setResetToken(resetTokenFromUrl);
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }, [path]);

    /* ── Board & Data State ── */
    const [board, setBoard] = useState<Board | null>(null);
    const [settings, setSettings] = useState<BoardSettings>(defaultSettings);
    const [categories, setCategories] = useState<IdeaCategory[]>([]);
    const [ideas, setIdeas] = useState<Idea[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    /* ── Filters ── */
    const [statusFilter, setStatusFilter] = useState<'all' | IdeaStatus>('all');
    const [categoryFilter, setCategoryFilter] = useState<'all' | string>('all');
    const [sort, setSort] = useState<IdeaSortMode>('top_voted');
    const [search, setSearch] = useState('');

    /* ── Detail Panel ── */
    const [selectedIdea, setSelectedIdea] = useState<Idea | null>(null);
    const [detailComments, setDetailComments] = useState<IdeaComment[]>([]);
    const [detailLoading, setDetailLoading] = useState(false);
    const [detailViewMode, setDetailViewMode] = useState<'panel' | 'page'>('panel');

    /* ── Follow / Favorite state ── */
    const [isSubscribed, setIsSubscribed] = useState(false);
    const [isFavorited, setIsFavorited] = useState(false);
    const [favoritedIds, setFavoritedIds] = useState<Set<string>>(new Set());
    /* ── Views ── */
    const [currentTab, setCurrentTab] = useState<'ideas' | 'roadmap' | 'changelog'>('ideas');
    const [sidebarView, setSidebarView] = useState<'all' | 'favorites'>('all');

    /* ── Changelog ── */
    const [changelog, setChangelog] = useState<ChangelogEntry[]>([]);
    const [changelogLoading, setChangelogLoading] = useState(false);

    /* ── Pagination ── */
    const PAGE_SIZE = 20;
    const [offset, setOffset] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);

    /* ── Comment ── */
    const [commentBody, setCommentBody] = useState('');
    const [commentFile, setCommentFile] = useState<File | null>(null);
    const [isInternal, setIsInternal] = useState(false);
    const [commentBusy, setCommentBusy] = useState(false);
    const [replyingTo, setReplyingTo] = useState<IdeaComment | null>(null);

    /* ── Submit Idea Modal ── */
    const [showSubmitModal, setShowSubmitModal] = useState(false);
    const [submitTitle, setSubmitTitle] = useState('');
    const [submitDescription, setSubmitDescription] = useState('');
    const [submitCategory, setSubmitCategory] = useState<string>('');
    const [submitFile, setSubmitFile] = useState<File | null>(null);
    const [submitBusy, setSubmitBusy] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [similarIdeas, setSimilarIdeas] = useState<Idea[]>([]);

    /* ── Share ── */
    const [showShareMenu, setShowShareMenu] = useState<string | null>(null);
    const [shareNotice, setShareNotice] = useState<string | null>(null);

    const authHeaders = useMemo(() => {
        const h: Record<string, string> = {
            'Content-Type': 'application/json',
            'x-visitor-id': visitorId,
        };
        if (authToken) h.authorization = `Bearer ${authToken}`;
        return h;
    }, [visitorId, authToken]);

    /* ── SSE Live Updates ── */
    useEffect(() => {
        if (!boardSlug || !board || board._accessRestricted) return;

        const eventSource = new EventSource(`${apiBase}/public/boards/${boardSlug}/stream`);

        eventSource.addEventListener('idea.voted', (event) => {
            try {
                const data = JSON.parse(event.data) as { ideaId: string; delta: number };
                setIdeas((prev) =>
                    prev.map((i) =>
                        i.id === data.ideaId ? { ...i, voteCount: i.voteCount + data.delta } : i
                    )
                );
                setSelectedIdea((prev) =>
                    prev && prev.id === data.ideaId
                        ? { ...prev, voteCount: prev.voteCount + data.delta }
                        : prev
                );
            } catch { /* ignore */ }
        });

        eventSource.addEventListener('comment.created', (event) => {
            try {
                const data = JSON.parse(event.data) as { ideaId: string; comment: IdeaComment };
                // Increment comment count, but don't duplicate if the user just posted it themselves
                // (we already optimistically incremented it for the author). However, this might double-count
                // for the author unless we check if they authored it, but for simplicity, we'll let it fetch.
                setIdeas((prev) =>
                    prev.map((i) =>
                        i.id === data.ideaId ? { ...i, commentCount: i.commentCount + 1 } : i
                    )
                );
                setSelectedIdea((prev) =>
                    prev && prev.id === data.ideaId
                        ? { ...prev, commentCount: prev.commentCount + 1 }
                        : prev
                );
            } catch { /* ignore */ }
        });

        return () => {
            eventSource.close();
        };
    }, [board, boardSlug]);

    const rememberPostAuthPath = useCallback(() => {
        localStorage.setItem(
            portalPostAuthPathStorageKey,
            `${window.location.pathname}${window.location.search}`,
        );
    }, []);

    /* ── Auth helpers ── */
    const requireAuth = useCallback((action: () => void) => {
        if (portalUser) {
            action();
            return;
        }
        setPendingAction(() => action);
        setShowAuthModal(true);
    }, [portalUser]);

    const loadCurrentUser = useCallback(async (token: string) => {
        try {
            const res = await fetch(`${apiBase}/public/auth/me`, {
                headers: { authorization: `Bearer ${token}` },
            });
            if (res.ok) {
                const data = await res.json() as { user: PortalUser };
                setPortalUser(data.user);
            } else {
                localStorage.removeItem(portalTokenStorageKey);
                setAuthToken(null);
                setPortalUser(null);
            }
        } catch { /* ignore */ }
    }, []);

    const handlePasswordReset = useCallback(async (e: FormEvent) => {
        e.preventDefault();
        if (!resetToken) return;
        setResetBusy(true);
        setResetError(null);
        try {
            const res = await fetch(`${apiBase}/public/auth/reset-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: resetToken, password: newPassword }),
            });
            if (res.ok) {
                setResetSuccess(true);
            } else {
                const data = await res.json();
                setResetError(data.error ?? 'Failed to reset password');
            }
        } catch {
            setResetError('Network error. Please try again.');
        } finally {
            setResetBusy(false);
        }
    }, [resetToken, newPassword]);

    const handleAuthSubmit = useCallback(async (e: FormEvent) => {
        e.preventDefault();
        setAuthBusy(true);
        setAuthError(null);
        setAuthSuccess(null);

        if (authMode === 'forgot-password') {
            try {
                const res = await fetch(`${apiBase}/public/auth/forgot-password`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: authEmail }),
                });
                if (res.ok) {
                    setAuthSuccess('Password reset link sent to your email.');
                } else {
                    const data = await res.json();
                    setAuthError(data.error ?? 'Failed to send reset link.');
                }
            } catch {
                setAuthError('Network error. Please try again.');
            } finally {
                setAuthBusy(false);
            }
            return;
        }

        const endpoint = authMode === 'register' ? '/public/auth/register' : '/public/auth/login';
        const body: Record<string, string> = {
            email: authEmail,
            password: authPassword,
        };
        if (authMode === 'register' && authDisplayName.trim()) {
            body.displayName = authDisplayName.trim();
        }

        try {
            const res = await fetch(`${apiBase}${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });

            const data = await res.json();

            if (!res.ok) {
                if (data.error === 'email_already_registered') {
                    setAuthError('This email is already registered. Try signing in instead.');
                } else if (data.error === 'invalid_credentials') {
                    setAuthError('Invalid email or password.');
                } else {
                    setAuthError(data.error ?? 'Authentication failed');
                }
                return;
            }

            const token = data.token as string;
            localStorage.setItem(portalTokenStorageKey, token);
            setAuthToken(token);
            setPortalUser(data.user);
            setShowAuthModal(false);
            setAuthEmail('');
            setAuthPassword('');
            setAuthDisplayName('');
            setSsoError(null);

            if (pendingAction) {
                const action = pendingAction;
                setPendingAction(null);
                setTimeout(() => action(), 50);
            }
        } catch {
            setAuthError('Network error. Please try again.');
        } finally {
            setAuthBusy(false);
        }
    }, [authMode, authEmail, authPassword, authDisplayName, pendingAction]);

    const handleSignOut = useCallback(async () => {
        if (authToken) {
            await fetch(`${apiBase}/public/auth/logout`, {
                method: 'POST',
                headers: { authorization: `Bearer ${authToken}` },
            }).catch(() => { /* ignore */ });
        }
        localStorage.removeItem(portalTokenStorageKey);
        localStorage.removeItem(portalPostAuthPathStorageKey);
        setAuthToken(null);
        setPortalUser(null);
        setSsoError(null);
    }, [authToken]);

    const handleSsoSignIn = useCallback(() => {
        const domain = parseSsoDomainInput(ssoDomainInput || authEmail);
        if (!domain) {
            setSsoError('Enter your work email or company domain to continue with SSO.');
            return;
        }

        rememberPostAuthPath();
        setSsoError(null);
        window.location.href = `${apiBase}/auth/sso/login?domain=${encodeURIComponent(domain)}`;
    }, [authEmail, rememberPostAuthPath, ssoDomainInput]);

    /* ── Load board & settings ── */
    const loadBoard = useCallback(async () => {
        if (!boardSlug) return;
        try {
            const res = await fetch(`${apiBase}/public/boards/${boardSlug}`, { headers: authHeaders });
            if (!res.ok) throw new Error('Board not found');
            const data = await res.json() as Board;
            setBoard(data);
            setError(null);
        } catch (err) {
            setBoard(null);
            setError(err instanceof Error ? err.message : 'Failed to load board');
        }
    }, [boardSlug, authHeaders]);

    const loadSettings = useCallback(async () => {
        if (!boardSlug) return;
        try {
            const res = await fetch(`${apiBase}/public/boards/${boardSlug}/settings`, { headers: authHeaders });
            if (res.ok) {
                const data = await res.json() as BoardSettings;
                setSettings(data);
            }
        } catch { /* ignore */ }
    }, [boardSlug, authHeaders]);

    const loadCategories = useCallback(async () => {
        if (!boardSlug || !board?.id || board._accessRestricted) return;
        try {
            const res = await fetch(`${apiBase}/public/boards/${boardSlug}/categories`, { headers: authHeaders });
            if (res.ok) {
                const data = await res.json() as { items: IdeaCategory[] };
                setCategories(data.items);
            }
        } catch { /* silently fail */ }
    }, [board?.id, board?._accessRestricted, boardSlug, authHeaders]);

    const loadIdeas = useCallback(async () => {
        if (!boardSlug || !board?.id || board._accessRestricted) return;
        setLoading(true);
        setError(null);
        setOffset(0);
        try {
            const params = new URLSearchParams();
            params.set('sort', sort);
            params.set('limit', String(PAGE_SIZE));
            params.set('offset', '0');
            if (statusFilter !== 'all') params.set('status', statusFilter);
            if (categoryFilter !== 'all') params.set('categoryIds', categoryFilter);
            if (search.trim().length > 0) params.set('search', search.trim());

            const res = await fetch(`${apiBase}/public/boards/${boardSlug}/ideas?${params}`, { headers: authHeaders });
            if (!res.ok) throw new Error('Failed to load ideas');
            const data = await res.json() as { items: Idea[] };
            setIdeas(data.items);
            setHasMore(data.items.length >= PAGE_SIZE);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load ideas');
        } finally {
            setLoading(false);
        }
    }, [board?.id, board?._accessRestricted, boardSlug, authHeaders, sort, statusFilter, categoryFilter, search]);

    const loadMoreIdeas = useCallback(async () => {
        if (!boardSlug || !board?.id || board._accessRestricted || loadingMore || !hasMore) return;
        setLoadingMore(true);
        const nextOffset = offset + PAGE_SIZE;
        try {
            const params = new URLSearchParams();
            params.set('sort', sort);
            params.set('limit', String(PAGE_SIZE));
            params.set('offset', String(nextOffset));
            if (statusFilter !== 'all') params.set('status', statusFilter);
            if (categoryFilter !== 'all') params.set('categoryIds', categoryFilter);
            if (search.trim().length > 0) params.set('search', search.trim());

            const res = await fetch(`${apiBase}/public/boards/${boardSlug}/ideas?${params}`, { headers: authHeaders });
            if (res.ok) {
                const data = await res.json() as { items: Idea[] };
                setIdeas((prev) => [...prev, ...data.items]);
                setOffset(nextOffset);
                setHasMore(data.items.length >= PAGE_SIZE);
            }
        } catch { /* ignore */ }
        finally { setLoadingMore(false); }
    }, [board?.id, board?._accessRestricted, boardSlug, authHeaders, sort, statusFilter, categoryFilter, search, offset, loadingMore, hasMore]);

    /* ── Load idea detail ── */
    const loadIdeaDetail = useCallback(async (ideaId: string, viewMode: 'panel' | 'page' = 'panel') => {
        if (!boardSlug || !board?.id || board._accessRestricted) return;
        setDetailLoading(true);
        setDetailViewMode(viewMode);
        try {
            const res = await fetch(`${apiBase}/public/boards/${boardSlug}/ideas/${ideaId}?threaded=true`, { headers: authHeaders });
            if (res.ok) {
                const data = await res.json() as { idea: Idea; comments: IdeaComment[]; isSubscribed?: boolean; isFavorited?: boolean };
                setSelectedIdea(data.idea);
                setDetailComments(buildCommentTree(data.comments));
                setIsSubscribed(data.isSubscribed ?? false);
                setIsFavorited(data.isFavorited ?? false);
            }
        } catch { /* ignore */ }
        finally { setDetailLoading(false); }
    }, [board?.id, board?._accessRestricted, boardSlug, authHeaders]);

    /* ── Load changelog ── */
    const loadChangelog = useCallback(async () => {
        if (!boardSlug || !board?.id || board._accessRestricted) return;
        setChangelogLoading(true);
        try {
            const res = await fetch(`${apiBase}/public/boards/${boardSlug}/changelog`, { headers: authHeaders });
            if (res.ok) {
                const data = await res.json() as { items: ChangelogEntry[] };
                setChangelog(data.items);
            }
        } catch { /* ignore */ }
        finally { setChangelogLoading(false); }
    }, [board?.id, board?._accessRestricted, boardSlug, authHeaders]);

    /* ── Toggle follow/subscribe ── */
    const onToggleFollow = useCallback(async () => {
        if (!selectedIdea || !boardSlug) return;
        if (!portalUser) { requireAuth(() => void onToggleFollow()); return; }
        const method = isSubscribed ? 'DELETE' : 'POST';
        try {
            const res = await fetch(`${apiBase}/public/boards/${boardSlug}/ideas/${selectedIdea.id}/subscribe`, { method, headers: authHeaders });
            if (res.ok) setIsSubscribed(!isSubscribed);
        } catch { /* ignore */ }
    }, [selectedIdea, boardSlug, portalUser, isSubscribed, authHeaders, requireAuth]);

    /* ── Toggle favorite ── */
    const onToggleFavorite = useCallback(async (ideaId: string) => {
        if (!boardSlug) return;
        if (!portalUser) { requireAuth(() => void onToggleFavorite(ideaId)); return; }
        const isFav = favoritedIds.has(ideaId);
        const method = isFav ? 'DELETE' : 'POST';
        try {
            const res = await fetch(`${apiBase}/public/boards/${boardSlug}/ideas/${ideaId}/favorite`, { method, headers: authHeaders });
            if (res.ok) {
                setFavoritedIds((prev) => { const next = new Set(prev); if (isFav) next.delete(ideaId); else next.add(ideaId); return next; });
                if (selectedIdea?.id === ideaId) setIsFavorited(!isFav);
            }
        } catch { /* ignore */ }
    }, [boardSlug, portalUser, favoritedIds, selectedIdea, authHeaders, requireAuth]);

    /* ── Load user favorites list ── */
    const loadUserFavorites = useCallback(async () => {
        if (!portalUser || !authToken) return;
        try {
            const res = await fetch(`${apiBase}/public/me/favorites`, { headers: authHeaders });
            if (res.ok) {
                const data = await res.json() as { ideaIds: string[] };
                setFavoritedIds(new Set(data.ideaIds));
            }
        } catch { /* ignore */ }
    }, [portalUser, authToken, authHeaders]);

    /* ── Toggle vote ── */
    const doToggleVote = useCallback(async (idea: Idea) => {
        if (!boardSlug) return;
        try {
            const method = idea.viewerHasVoted ? 'DELETE' : 'POST';
            const res = await fetch(`${apiBase}/public/boards/${boardSlug}/ideas/${idea.id}/votes`, {
                method,
                headers: authHeaders,
            });

            if (res.status === 401) {
                requireAuth(() => void doToggleVote(idea));
                return;
            }

            if (res.ok) {
                const vote = await res.json() as IdeaVote;
                setIdeas((prev) =>
                    prev.map((i) =>
                        i.id === vote.ideaId
                            ? { ...i, voteCount: vote.voteCount, viewerHasVoted: vote.hasVoted }
                            : i,
                    ),
                );
                if (selectedIdea && selectedIdea.id === vote.ideaId) {
                    setSelectedIdea((prev) =>
                        prev ? { ...prev, voteCount: vote.voteCount, viewerHasVoted: vote.hasVoted } : prev,
                    );
                }
            }
        } catch { /* ignore */ }
    }, [boardSlug, authHeaders, selectedIdea, requireAuth]);

    const onToggleVote = useCallback((idea: Idea) => {
        if (settings.requireAuthToVote && !portalUser) {
            requireAuth(() => void doToggleVote(idea));
        } else {
            void doToggleVote(idea);
        }
    }, [settings.requireAuthToVote, portalUser, requireAuth, doToggleVote]);

    /* ── Post Comment ── */
    const onPostComment = useCallback(async () => {
        if (!boardSlug || !selectedIdea || commentBody.trim().length < 2) return;

        const doPost = async () => {
            setCommentBusy(true);
            try {
                const bodyToSubmit = commentBody.trim();
                const payload: CommentCreatePayload = { body: bodyToSubmit, isInternal };
                if (replyingTo) payload.parentCommentId = replyingTo.id;

                // NOTE: The instruction provided a different URL and auth scheme.
                // Assuming `boardSlug` is still the correct identifier for the board.
                // The instruction also implies `visitorId` is used as a bearer token,
                // which is unusual for public APIs but followed as per instruction.
                const res = await fetch(`${apiBase}/public/boards/${boardSlug}/ideas/${selectedIdea.id}/comments`, {
                    method: 'POST',
                    headers: authHeaders,
                    body: JSON.stringify(payload),
                });

                if (res.status === 401) {
                    requireAuth(() => void onPostComment());
                    return;
                }

                if (res.ok) {
                    const newComment = await res.json() as IdeaComment;

                    if (commentFile) {
                        const formData = new FormData();
                        formData.append('file', commentFile);
                        const uploadHeaders = { ...authHeaders };
                        delete uploadHeaders['Content-Type'];

                        try {
                            await fetch(`${apiBase}/public/boards/${boardSlug}/ideas/${selectedIdea.id}/comments/${newComment.id}/attachments`, {
                                method: 'POST',
                                headers: uploadHeaders,
                                body: formData,
                            });
                        } catch { /* ignore attachment errors for now */ }
                    }

                    void loadIdeaDetail(selectedIdea.id, detailViewMode);
                    setCommentBody('');
                    setIsInternal(false);
                    setCommentFile(null);
                    setReplyingTo(null);
                    setSelectedIdea((prev) =>
                        prev ? { ...prev, commentCount: prev.commentCount + 1 } : prev,
                    );
                    setIdeas((prev) =>
                        prev.map((i) =>
                            i.id === selectedIdea.id ? { ...i, commentCount: i.commentCount + 1 } : i,
                        ),
                    );
                }
            } catch { /* ignore */ }
            finally { setCommentBusy(false); }
        };

        if (settings.requireAuthToComment && !portalUser) {
            requireAuth(() => void doPost());
        } else {
            void doPost();
        }
    }, [boardSlug, selectedIdea, commentBody, replyingTo, detailViewMode, authHeaders, settings.requireAuthToComment, portalUser, requireAuth, loadIdeaDetail]);

    /* ── Submit Idea ── */
    const onSubmitIdea = useCallback(async () => {
        if (!boardSlug || submitTitle.trim().length < 4 || submitDescription.trim().length < 8) return;
        setSubmitBusy(true);
        setSubmitError(null);

        try {
            const body: Record<string, unknown> = {
                title: submitTitle.trim(),
                description: submitDescription.trim(),
            };
            if (submitCategory) body.categoryIds = [submitCategory];

            const res = await fetch(`${apiBase}/public/boards/${boardSlug}/ideas`, {
                method: 'POST',
                headers: authHeaders,
                body: JSON.stringify(body),
            });

            if (res.status === 401) {
                requireAuth(() => void onSubmitIdea());
                return;
            }

            if (!res.ok) {
                const data = await res.json();
                setSubmitError(data.error ?? 'Failed to submit idea');
                return;
            }

            const newIdea = await res.json() as Idea;

            if (submitFile) {
                const formData = new FormData();
                formData.append('file', submitFile);
                const uploadHeaders = { ...authHeaders };
                delete uploadHeaders['Content-Type'];

                try {
                    await fetch(`${apiBase}/public/boards/${boardSlug}/ideas/${newIdea.id}/attachments`, {
                        method: 'POST',
                        headers: uploadHeaders,
                        body: formData,
                    });
                } catch { /* ignore attachment errors for now */ }
            }

            setShowSubmitModal(false);
            setSubmitTitle('');
            setSubmitDescription('');
            setSubmitCategory('');
            setSubmitFile(null);
            setSimilarIdeas([]);
            void loadIdeas();
        } catch {
            setSubmitError('Network error. Please try again.');
        } finally {
            setSubmitBusy(false);
        }
    }, [boardSlug, submitTitle, submitDescription, submitCategory, authHeaders, requireAuth, loadIdeas]);

    /* ── Search for similar ideas (duplicate detection) ── */
    useEffect(() => {
        if (submitTitle.trim().length < 4 || !boardSlug) {
            setSimilarIdeas([]);
            return;
        }

        const timer = setTimeout(async () => {
            try {
                const params = new URLSearchParams({ search: submitTitle.trim(), limit: '5' });
                const res = await fetch(`${apiBase}/public/boards/${boardSlug}/ideas?${params}`, {
                    headers: authHeaders,
                });
                if (res.ok) {
                    const data = await res.json() as { items: Idea[] };
                    setSimilarIdeas(data.items.slice(0, 3));
                }
            } catch { /* ignore */ }
        }, 500);

        return () => clearTimeout(timer);
    }, [submitTitle, boardSlug, authHeaders]);

    /* ── Share helpers ── */
    const getIdeaUrl = useCallback((ideaId: string) => {
        return `${window.location.origin}/portal/boards/${boardSlug}/ideas/${ideaId}`;
    }, [boardSlug]);

    const onCopyLink = useCallback((ideaId: string) => {
        void navigator.clipboard.writeText(getIdeaUrl(ideaId));
        setShareNotice('Link copied!');
        setShowShareMenu(null);
        setTimeout(() => setShareNotice(null), 2000);
    }, [getIdeaUrl]);

    const onShareTwitter = useCallback((idea: Idea) => {
        const url = getIdeaUrl(idea.id);
        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(idea.title)}&url=${encodeURIComponent(url)}`, '_blank');
        setShowShareMenu(null);
    }, [getIdeaUrl]);

    const onShareLinkedIn = useCallback((idea: Idea) => {
        const url = getIdeaUrl(idea.id);
        window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`, '_blank');
        setShowShareMenu(null);
    }, [getIdeaUrl]);

    const onShareEmail = useCallback((idea: Idea) => {
        const url = getIdeaUrl(idea.id);
        window.open(`mailto:?subject=${encodeURIComponent(idea.title)}&body=${encodeURIComponent(`Check this out: ${url}`)}`, '_blank');
        setShowShareMenu(null);
    }, [getIdeaUrl]);

    /* ── Toggle Comment Upvote ── */
    const onToggleCommentUpvote = useCallback(async (comment: IdeaComment) => {
        if (!boardSlug || !selectedIdea) return;
        if (!portalUser) { requireAuth(() => void onToggleCommentUpvote(comment)); return; }

        const method = comment.viewerHasUpvoted ? 'DELETE' : 'POST';
        try {
            const res = await fetch(`${apiBase}/public/boards/${boardSlug}/ideas/${selectedIdea.id}/comments/${comment.id}/upvote`, {
                method,
                headers: authHeaders,
            });
            if (res.ok) {
                void loadIdeaDetail(selectedIdea.id, detailViewMode);
            }
        } catch { /* ignore */ }
    }, [boardSlug, selectedIdea, portalUser, authHeaders, requireAuth, loadIdeaDetail, detailViewMode]);

    /* ── Effects ── */
    useEffect(() => {
        if (authToken) void loadCurrentUser(authToken);
    }, [authToken, loadCurrentUser]);

    useEffect(() => {
        void loadBoard();
    }, [loadBoard]);

    useEffect(() => {
        void loadSettings();
    }, [loadSettings]);

    useEffect(() => {
        void loadCategories();
    }, [loadCategories]);

    useEffect(() => {
        void loadIdeas();
    }, [loadIdeas]);

    useEffect(() => {
        if (deepLinkIdeaId) {
            void loadIdeaDetail(deepLinkIdeaId, 'page');
        }
    }, [deepLinkIdeaId, loadIdeaDetail]);

    useEffect(() => {
        if (currentTab === 'changelog' && changelog.length === 0) {
            void loadChangelog();
        }
    }, [currentTab, changelog.length, loadChangelog]);

    // Load favorites when user logs in
    useEffect(() => {
        if (portalUser) void loadUserFavorites();
    }, [portalUser, loadUserFavorites]);

    // Close share menu on outside click
    useEffect(() => {
        if (!showShareMenu) return;
        const handler = () => setShowShareMenu(null);
        document.addEventListener('click', handler);
        return () => document.removeEventListener('click', handler);
    }, [showShareMenu]);

    /* ── Computed ── */
    const statusCounts = useMemo(() => {
        const counts: Record<string, number> = { all: ideas.length };
        for (const idea of ideas) {
            counts[idea.status] = (counts[idea.status] ?? 0) + 1;
        }
        return counts;
    }, [ideas]);

    const totalVotes = useMemo(() => ideas.reduce((sum, i) => sum + i.voteCount, 0), [ideas]);

    const portalTitle = settings.portalTitle ?? board?.name ?? 'Feature Requests';
    const isWidget = new URLSearchParams(window.location.search).get('widget') === 'true';
    const boardAccessMode = board?._accessMode ?? settings.accessMode;
    const isBoardAccessRestricted = Boolean(board?._accessRestricted);
    const isDomainRestrictedBoard = boardAccessMode === 'domain_restricted';
    const customStyles = useMemo(() => {
        const styles: React.CSSProperties & Record<string, string> = {};
        if (settings.customAccentColor) {
            styles['--cv-blue'] = settings.customAccentColor;
            // Also derive darker/lighter variants if needed, or rely on simple override
        }
        return styles;
    }, [settings.customAccentColor]);

    if (isAuthCallbackPath(path)) {
        return (
            <div className="cp-shell">
                <div className="cp-empty-state">
                    <h1>{callbackStatus === 'error' ? 'Authentication Failed' : 'Signing You In'}</h1>
                    <p>{callbackError ?? 'Completing your sign-in and returning you to the portal...'}</p>
                </div>
            </div>
        );
    }

    /* ── Render: No board slug ── */
    if (!boardSlug) {
        return (
            <div className="cp-shell">
                <div className="cp-empty-state">
                    <h1>Portal Not Found</h1>
                    <p>Please navigate to a specific board, e.g. <code>/portal/boards/customervoice-features</code></p>
                </div>
            </div>
        );
    }

    /* ── Render: Error ── */
    if (error && !board) {
        return (
            <div className="cp-shell">
                <div className="cp-empty-state">
                    <h1>Board Not Found</h1>
                    <p>{error}</p>
                </div>
            </div>
        );
    }

    if (board && isBoardAccessRestricted) {
        return (
            <div className={`cp-shell ${isWidget ? 'is-widget' : ''}`}>
                <header className="cp-header" style={{ background: settings.headerBgColor || undefined }}>
                    <div className="cp-header-inner">
                        <div className="cp-header-brand">
                            {settings.customLogoUrl ? (
                                <img src={settings.customLogoUrl} alt="Logo" className="cp-custom-logo" />
                            ) : (
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="28" height="28">
                                    <circle cx="12" cy="12" r="10" />
                                    <path d="M8 12l2 2 4-4" />
                                </svg>
                            )}
                            <div className="cp-header-title">
                                <span className="cp-brand-name">CustomerVoice</span>
                                <span className="cp-brand-sep">|</span>
                                <span className="cp-board-name">{portalTitle}</span>
                            </div>
                        </div>
                    </div>
                </header>

                <div className="cp-empty-state" style={{ maxWidth: '640px', margin: '80px auto', padding: '32px' }}>
                    <h1>{isDomainRestrictedBoard ? 'Restricted Workspace Portal' : 'Private Feedback Portal'}</h1>
                    <p>
                        {board._accessDeniedReason === 'domain_not_allowed'
                            ? 'Your current account is not allowed to access this board. Sign in with an approved work account or continue with workspace SSO.'
                            : 'This board requires authentication before you can view ideas, comments, roadmap, and changelog content.'}
                    </p>
                    <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap', marginTop: '24px' }}>
                        <button
                            className="cp-auth-submit"
                            onClick={() => {
                                setAuthMode('login');
                                setShowAuthModal(true);
                            }}
                        >
                            Sign In
                        </button>
                        {isDomainRestrictedBoard ? (
                            <button
                                className="hero-button ghost"
                                onClick={() => {
                                    setAuthMode('login');
                                    setShowAuthModal(true);
                                }}
                            >
                                Continue with SSO
                            </button>
                        ) : null}
                    </div>
                    {isDomainRestrictedBoard ? (
                        <div style={{ marginTop: '24px', textAlign: 'left' }}>
                            <label style={{ display: 'block', fontWeight: 600, marginBottom: '8px' }}>Work Email or Company Domain</label>
                            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                                <input
                                    type="text"
                                    value={ssoDomainInput}
                                    onChange={(e) => setSsoDomainInput(e.target.value)}
                                    placeholder="you@company.com or company.com"
                                    style={{ flex: 1, minWidth: '260px' }}
                                />
                                <button className="hero-button ghost" onClick={handleSsoSignIn}>
                                    Start SSO
                                </button>
                            </div>
                            {ssoError ? (
                                <p className="cp-auth-error" style={{ marginTop: '12px' }}>{ssoError}</p>
                            ) : null}
                        </div>
                    ) : null}
                </div>
            </div>
        );
    }

    return (
        <div className={`cp-shell ${isWidget ? 'is-widget' : ''}`} style={customStyles}>
            {/* ── Share toast ── */}
            {shareNotice ? (
                <div className="cp-toast">{shareNotice}</div>
            ) : null}

            {/* ── Header ── */}
            <header className="cp-header" style={{ background: settings.headerBgColor || undefined }}>
                <div className="cp-header-inner">
                    <div className="cp-header-brand">
                        {settings.customLogoUrl ? (
                            <img src={settings.customLogoUrl} alt="Logo" className="cp-custom-logo" />
                        ) : (
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="28" height="28">
                                <circle cx="12" cy="12" r="10" />
                                <path d="M8 12l2 2 4-4" />
                            </svg>
                        )}
                        <div className="cp-header-title">
                            <span className="cp-brand-name">CustomerVoice</span>
                            <span className="cp-brand-sep">|</span>
                            <span className="cp-board-name">{portalTitle}</span>
                        </div>
                    </div>
                    <div className="cp-header-search">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
                        </svg>
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search feature requests..."
                        />
                    </div>
                    <div className="cp-header-actions">
                        {settings.enableIdeaSubmission ? (
                            <button
                                className="cp-submit-btn"
                                onClick={() => {
                                    if (settings.requireAuthToSubmit && !portalUser) {
                                        requireAuth(() => setShowSubmitModal(true));
                                    } else {
                                        setShowSubmitModal(true);
                                    }
                                }}
                            >
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="16" height="16">
                                    <path d="M12 5v14M5 12h14" />
                                </svg>
                                Submit Idea
                            </button>
                        ) : null}

                        {portalUser ? (
                            <div className="cp-user-menu">
                                <button className="cp-user-avatar-btn" title={portalUser.email}>
                                    {portalUser.displayName?.charAt(0)?.toUpperCase() ?? portalUser.email.charAt(0).toUpperCase()}
                                </button>
                                <div className="cp-user-dropdown">
                                    <div className="cp-user-info">
                                        <strong>{portalUser.displayName ?? portalUser.email.split('@')[0]}</strong>
                                        <span>{portalUser.email}</span>
                                    </div>
                                    <button onClick={() => setSidebarView('favorites')}>★ My Favorites ({favoritedIds.size})</button>
                                    <button onClick={handleSignOut}>🚪 Sign Out</button>
                                </div>
                            </div>
                        ) : (
                            <button
                                className="cp-signin-btn"
                                onClick={() => setShowAuthModal(true)}
                            >
                                Sign In
                            </button>
                        )}
                    </div>
                </div>
            </header>

            {/* ── Welcome banner ── */}
            {settings.welcomeMessage ? (
                <div className="cp-board-banner">
                    <p>{settings.welcomeMessage}</p>
                </div>
            ) : board?.description ? (
                <div className="cp-board-banner">
                    <p>{board.description}</p>
                </div>
            ) : null}

            {/* ── Stats bar ── */}
            <div className="cp-stats-bar">
                <div className="cp-header-stat">
                    <strong>{ideas.length}</strong>
                    <span>Ideas</span>
                </div>
                <div className="cp-header-stat">
                    <strong>{totalVotes}</strong>
                    <span>Votes</span>
                </div>
                <div className="cp-header-stat">
                    <strong>{ideas.reduce((sum, i) => sum + i.commentCount, 0)}</strong>
                    <span>Comments</span>
                </div>
            </div>

            {/* ── Tabs ── */}
            <div className="cp-portal-nav">
                <button
                    className={`cp-nav-tab ${currentTab === 'ideas' ? 'active' : ''}`}
                    onClick={() => setCurrentTab('ideas')}
                >
                    Feature Requests
                </button>
                <button
                    className={`cp-nav-tab ${currentTab === 'roadmap' ? 'active' : ''}`}
                    onClick={() => setCurrentTab('roadmap')}
                >
                    Roadmap
                </button>
                <button
                    className={`cp-nav-tab ${currentTab === 'changelog' ? 'active' : ''}`}
                    onClick={() => setCurrentTab('changelog')}
                >
                    Changelog
                </button>
            </div>

            {/* ── Body ── */}
            <div className="cp-body">
                {currentTab === 'ideas' ? (
                    <>
                        {/* ── Sidebar ── */}
                        <aside className="cp-sidebar">
                            <div className="cp-sidebar-section">
                                <h3 className="cp-sidebar-heading">Sort By</h3>
                                <div className="cp-sort-options">
                                    {sortOptions.map((opt) => (
                                        <button
                                            key={opt.value}
                                            className={`cp-sort-btn ${sort === opt.value ? 'active' : ''}`}
                                            onClick={() => setSort(opt.value)}
                                        >
                                            <span>{opt.icon}</span> {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {settings.showCategoryFilter && categories.length > 0 ? (
                                <div className="cp-sidebar-section">
                                    <h3 className="cp-sidebar-heading">Categories</h3>
                                    <div className="cp-category-filters">
                                        <button
                                            className={`cp-cat-btn ${categoryFilter === 'all' ? 'active' : ''}`}
                                            onClick={() => { setCategoryFilter('all'); setSidebarView('all'); }}
                                        >
                                            All Categories
                                        </button>
                                        {categories.map((cat) => (
                                            <button
                                                key={cat.id}
                                                className={`cp-cat-btn ${categoryFilter === cat.id ? 'active' : ''}`}
                                                onClick={() => { setCategoryFilter(cat.id); setSidebarView('all'); }}
                                            >
                                                <span className="cp-cat-dot" style={{ background: cat.colorHex ?? '#6366f1' }} />
                                                {cat.name}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ) : null}

                            {portalUser ? (
                                <div className="cp-sidebar-section">
                                    <h3 className="cp-sidebar-heading">My Views</h3>
                                    <div className="cp-category-filters">
                                        <button
                                            className={`cp-cat-btn ${sidebarView === 'all' ? 'active' : ''}`}
                                            onClick={() => setSidebarView('all')}
                                        >
                                            📋 All Ideas
                                        </button>
                                        <button
                                            className={`cp-cat-btn ${sidebarView === 'favorites' ? 'active' : ''}`}
                                            onClick={() => setSidebarView('favorites')}
                                        >
                                            ★ My Favorites ({favoritedIds.size})
                                        </button>
                                    </div>
                                </div>
                            ) : null}

                            <div className="cp-sidebar-section cp-sidebar-help">
                                <p>💡 <strong>Have an idea?</strong> Browse existing requests and vote for features you want. Your votes help us prioritize!</p>
                            </div>
                        </aside>

                        {/* ── Main Content ── */}
                        <main className="cp-main">
                            {/* ── Status Tabs ── */}
                            {settings.showStatusFilter ? (
                                <div className="cp-status-tabs">
                                    {publicStatusTabs.map((tab) => (
                                        <button
                                            key={tab.value}
                                            className={`cp-status-tab ${statusFilter === tab.value ? 'active' : ''}`}
                                            onClick={() => setStatusFilter(tab.value)}
                                        >
                                            {tab.label}
                                            {statusCounts[tab.value] !== undefined ? (
                                                <span className="cp-tab-count">{statusCounts[tab.value]}</span>
                                            ) : null}
                                        </button>
                                    ))}
                                </div>
                            ) : null}

                            {/* ── Active filters ── */}
                            {(statusFilter !== 'all' || categoryFilter !== 'all' || search.trim().length > 0) ? (
                                <div className="cp-active-filters">
                                    {statusFilter !== 'all' ? (
                                        <span className="cp-filter-chip">
                                            Status: {statusConfig[statusFilter].label}
                                            <button onClick={() => setStatusFilter('all')}>✕</button>
                                        </span>
                                    ) : null}
                                    {categoryFilter !== 'all' ? (
                                        <span className="cp-filter-chip">
                                            Category: {categories.find((c) => c.id === categoryFilter)?.name ?? 'Selected'}
                                            <button onClick={() => setCategoryFilter('all')}>✕</button>
                                        </span>
                                    ) : null}
                                    {search.trim().length > 0 ? (
                                        <span className="cp-filter-chip">
                                            Search: &quot;{search}&quot;
                                            <button onClick={() => setSearch('')}>✕</button>
                                        </span>
                                    ) : null}
                                    <button className="cp-clear-filters" onClick={() => {
                                        setStatusFilter('all');
                                        setCategoryFilter('all');
                                        setSearch('');
                                    }}>Clear all</button>
                                </div>
                            ) : null}

                            {/* ── Ideas List ── */}
                            {loading ? (
                                <div className="cp-loading">
                                    <div className="cp-spinner" />
                                    <p>Loading feature requests...</p>
                                </div>
                            ) : ideas.length === 0 ? (
                                <div className="cp-empty-list">
                                    <p>No feature requests found matching your filters.</p>
                                </div>
                            ) : (
                                <div className="cp-ideas-list">
                                    {(sidebarView === 'favorites' ? ideas.filter((i) => favoritedIds.has(i.id)) : ideas).map((idea, index) => (
                                        <article
                                            key={idea.id}
                                            className={`cp-idea-card ${selectedIdea?.id === idea.id ? 'selected' : ''}`}
                                            style={{ animationDelay: `${index * 0.04}s` }}
                                        >
                                            {/* Vote section */}
                                            <div className="cp-idea-vote-col">
                                                <button
                                                    className={`cp-vote-btn ${idea.viewerHasVoted ? 'voted' : ''}`}
                                                    onClick={(e) => { e.stopPropagation(); onToggleVote(idea); }}
                                                    title={idea.viewerHasVoted ? 'Remove vote' : 'Upvote this idea'}
                                                    disabled={idea.status === 'declined'}
                                                    style={idea.status === 'declined' ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
                                                >
                                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="16" height="16">
                                                        <path d="M12 19V5M5 12l7-7 7 7" />
                                                    </svg>
                                                </button>
                                                {settings.showVoteCount ? (
                                                    <span className={`cp-vote-count ${idea.viewerHasVoted ? 'voted' : ''}`}>
                                                        {idea.voteCount}
                                                    </span>
                                                ) : null}
                                            </div>

                                            {/* Content */}
                                            <div className="cp-idea-content" onClick={() => void loadIdeaDetail(idea.id)}>
                                                <div className="cp-idea-header">
                                                    <h3 className="cp-idea-title">{idea.title}</h3>
                                                    <span
                                                        className="cp-status-badge"
                                                        style={{ background: `${statusConfig[idea.status].color}18`, color: statusConfig[idea.status].color }}
                                                    >
                                                        {statusConfig[idea.status].icon} {statusConfig[idea.status].label}
                                                    </span>
                                                </div>
                                                <div className="cp-idea-desc">
                                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{idea.description}</ReactMarkdown>
                                                </div>
                                                <div className="cp-idea-footer">
                                                    <div className="cp-idea-meta">
                                                        {idea.categoryNames.map((cat) => (
                                                            <span className="cp-idea-cat-pill" key={cat}>{cat}</span>
                                                        ))}
                                                    </div>
                                                    <div className="cp-idea-stats">
                                                        <span className="cp-idea-comment-count">💬 {idea.commentCount}</span>
                                                        <span className="cp-idea-date">{formatDate(idea.createdAt)}</span>
                                                        {/* Favorite button */}
                                                        <button
                                                            className={`cp-fav-btn ${favoritedIds.has(idea.id) ? 'active' : ''}`}
                                                            onClick={(e) => { e.stopPropagation(); void onToggleFavorite(idea.id); }}
                                                            title={favoritedIds.has(idea.id) ? 'Remove from favorites' : 'Add to favorites'}
                                                        >
                                                            {favoritedIds.has(idea.id) ? '★' : '☆'}
                                                        </button>
                                                        {/* Share button */}
                                                        <div className="cp-share-wrapper" onClick={(e) => e.stopPropagation()}>
                                                            <button
                                                                className="cp-share-btn"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setShowShareMenu(showShareMenu === idea.id ? null : idea.id);
                                                                }}
                                                                title="Share"
                                                            >
                                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                                                                    <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13" />
                                                                </svg>
                                                            </button>
                                                            {showShareMenu === idea.id ? (
                                                                <div className="cp-share-dropdown">
                                                                    <button onClick={() => onCopyLink(idea.id)}>📋 Copy link</button>
                                                                    <button onClick={() => onShareTwitter(idea)}>🐦 Share on X</button>
                                                                    <button onClick={() => onShareLinkedIn(idea)}>💼 Share on LinkedIn</button>
                                                                    <button onClick={() => onShareEmail(idea)}>📧 Share via Email</button>
                                                                </div>
                                                            ) : null}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </article>
                                    ))}

                                    {/* Load More */}
                                    {hasMore && sidebarView === 'all' ? (
                                        <div className="cp-load-more">
                                            <button
                                                className="cp-load-more-btn"
                                                onClick={() => void loadMoreIdeas()}
                                                disabled={loadingMore}
                                            >
                                                {loadingMore ? 'Loading...' : 'Load More Ideas'}
                                            </button>
                                        </div>
                                    ) : null}
                                </div>
                            )}
                        </main>
                    </>
                ) : null}

                {/* ── Roadmap Tab ── */}
                {currentTab === 'roadmap' ? (
                    <main className="cp-roadmap cp-main-full">
                        <div className="cp-kanban-board">
                            {['planned', 'in_progress', 'completed'].map((status) => {
                                const colIdeas = ideas.filter((i) => i.status === status);
                                const cfg = statusConfig[status as IdeaStatus];
                                return (
                                    <div className="cp-kanban-col" key={status}>
                                        <div className="cp-kanban-col-header" style={{ borderTopColor: cfg.color }}>
                                            <h3>{cfg.icon} {cfg.label}</h3>
                                            <span className="cp-kanban-count">{colIdeas.length}</span>
                                        </div>
                                        <div className="cp-kanban-cards">
                                            {colIdeas.length === 0 ? (
                                                <p className="cp-muted cp-kanban-empty">No items yet</p>
                                            ) : null}
                                            {colIdeas.map(idea => (
                                                <div className="cp-kanban-card" key={idea.id} onClick={() => void loadIdeaDetail(idea.id)}>
                                                    <h4>{idea.title}</h4>
                                                    <div className="cp-kanban-meta">
                                                        <span>▲ {idea.voteCount}</span>
                                                        <span>💬 {idea.commentCount}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </main>
                ) : null}

                {/* ── Changelog Tab ── */}
                {currentTab === 'changelog' ? (
                    <main className="cp-changelog cp-main-full">
                        {changelogLoading ? (
                            <div className="cp-loading">
                                <div className="cp-spinner" />
                                <p>Loading changelog...</p>
                            </div>
                        ) : changelog.length === 0 ? (
                            <div className="cp-empty-state">
                                <p>No changelog entries yet.</p>
                            </div>
                        ) : (
                            <div className="cp-changelog-list">
                                {changelog.map((entry) => (
                                    <article className="cp-changelog-entry" key={entry.id}>
                                        <div className="cp-cl-date">{formatDate(entry.createdAt)}</div>
                                        <div className="cp-cl-content">
                                            <h2>{entry.title}</h2>
                                            <div className="cp-cl-body">
                                                <ReactMarkdown remarkPlugins={[remarkGfm]}>{entry.content}</ReactMarkdown>
                                            </div>
                                            {entry.authorName ? (
                                                <div className="cp-cl-author">By {entry.authorName}</div>
                                            ) : null}
                                        </div>
                                    </article>
                                ))}
                            </div>
                        )}
                    </main>
                ) : null}
            </div>

            {/* ── Detail Slide-Over ── */}
            {selectedIdea ? (
                <>
                    <div className="cp-overlay" onClick={() => setSelectedIdea(null)} />
                    <aside className="cp-detail-panel">
                        <header className="cp-detail-header">
                            <h2>Feature Detail</h2>
                            <div className="cp-detail-header-actions">
                                {/* Follow button */}
                                <button
                                    className={`cp-follow-btn ${isSubscribed ? 'active' : ''}`}
                                    onClick={() => void onToggleFollow()}
                                    title={isSubscribed ? 'Unfollow this idea' : 'Follow this idea'}
                                >
                                    {isSubscribed ? '🔔 Following' : '🔔 Follow'}
                                </button>
                                {/* Favorite button */}
                                <button
                                    className={`cp-fav-btn-detail ${isFavorited ? 'active' : ''}`}
                                    onClick={() => void onToggleFavorite(selectedIdea.id)}
                                    title={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
                                >
                                    {isFavorited ? '★' : '☆'}
                                </button>
                                {/* Share in detail */}
                                <div className="cp-share-wrapper">
                                    <button
                                        className="cp-detail-share-btn"
                                        onClick={() => setShowShareMenu(showShareMenu === 'detail' ? null : 'detail')}
                                        title="Share"
                                    >
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                                            <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13" />
                                        </svg>
                                        Share
                                    </button>
                                    {showShareMenu === 'detail' ? (
                                        <div className="cp-share-dropdown">
                                            <button onClick={() => onCopyLink(selectedIdea.id)}>📋 Copy link</button>
                                            <button onClick={() => onShareTwitter(selectedIdea)}>🐦 Share on X</button>
                                            <button onClick={() => onShareLinkedIn(selectedIdea)}>💼 Share on LinkedIn</button>
                                            <button onClick={() => onShareEmail(selectedIdea)}>📧 Share via Email</button>
                                        </div>
                                    ) : null}
                                </div>
                                <button className="cp-detail-close" onClick={() => setSelectedIdea(null)}>✕</button>
                            </div>
                        </header>
                        <div className="cp-detail-body">
                            <div className="cp-detail-vote-row">
                                <button
                                    className={`cp-detail-vote-btn ${selectedIdea.viewerHasVoted ? 'voted' : ''}`}
                                    onClick={() => onToggleVote(selectedIdea)}
                                    disabled={selectedIdea.status === 'declined'}
                                    style={selectedIdea.status === 'declined' ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
                                >
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="18" height="18">
                                        <path d="M12 19V5M5 12l7-7 7 7" />
                                    </svg>
                                    <span>{selectedIdea.viewerHasVoted ? 'Voted' : 'Upvote'}</span>
                                </button>
                                <span className="cp-detail-vote-count">{selectedIdea.voteCount} votes</span>
                            </div>

                            {/* Merged Banner */}
                            {(selectedIdea.mergedIntoIdeaId || selectedIdea.mergedIntoId) && (
                                <div style={{
                                    padding: '16px',
                                    background: '#fef3c7',
                                    color: '#b45309',
                                    borderRadius: '8px',
                                    marginBottom: '16px',
                                    fontSize: '0.9rem',
                                    border: '1px solid #fde68a'
                                }}>
                                    <strong>This idea has been merged.</strong> Its votes and comments point to the new parent idea.
                                    <button
                                        className="hero-button ghost"
                                        style={{ display: 'block', marginTop: '8px', padding: '6px 12px', fontSize: '0.8rem', background: '#fef3c7', borderColor: '#fde68a' }}
                                        onClick={() => void loadIdeaDetail(selectedIdea.mergedIntoIdeaId || selectedIdea.mergedIntoId || '')}
                                    >
                                        View merged idea ➔
                                    </button>
                                </div>
                            )}

                            <h1 className="cp-detail-title">{selectedIdea.title}</h1>

                            <span
                                className="cp-status-badge cp-detail-status"
                                style={{ background: `${statusConfig[selectedIdea.status].color}18`, color: statusConfig[selectedIdea.status].color }}
                            >
                                {statusConfig[selectedIdea.status].icon} {statusConfig[selectedIdea.status].label}
                            </span>

                            <div className="cp-detail-description">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>{selectedIdea.description}</ReactMarkdown>
                                {selectedIdea.attachments && selectedIdea.attachments.length > 0 ? (
                                    <div className="cp-attachments-list" style={{ marginTop: '16px' }}>
                                        <h4 style={{ fontSize: '0.85rem', color: 'var(--cv-subtle)', marginBottom: '8px' }}>Attachments</h4>
                                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                            {selectedIdea.attachments.map(att => (
                                                <a key={att.id} href={att.fileUrl} target="_blank" rel="noopener noreferrer" className="cp-attachment-link" style={{ padding: '6px 10px', background: 'var(--cv-bg-hover)', borderRadius: '6px', fontSize: '0.85rem', color: 'var(--cv-text)', textDecoration: 'none', border: '1px solid var(--cv-border)' }}>
                                                    📎 {att.fileName}
                                                </a>
                                            ))}
                                        </div>
                                    </div>
                                ) : null}
                            </div>

                            {selectedIdea.categoryNames.length > 0 ? (
                                <div className="cp-detail-categories">
                                    {selectedIdea.categoryNames.map((cat) => (
                                        <span className="cp-idea-cat-pill" key={cat}>{cat}</span>
                                    ))}
                                </div>
                            ) : null}

                            <div className="cp-detail-meta-grid">
                                <div className="cp-detail-meta-item">
                                    <span>Comments</span>
                                    <strong>{detailComments.length}</strong>
                                </div>
                                <div className="cp-detail-meta-item">
                                    <span>Updated</span>
                                    <strong>{formatDate(selectedIdea.updatedAt)}</strong>
                                </div>
                            </div>

                            {/* Official Responses */}
                            {detailComments.some((c) => c.isOfficial) ? (
                                <>
                                    <h3 className="cp-detail-section-heading">📢 Official Responses</h3>
                                    {detailComments.filter((c) => c.isOfficial).map((c) => (
                                        <div className="cp-comment cp-official-comment" key={c.id}>
                                            <div className="cp-comment-avatar cp-official-avatar">
                                                {c.userEmail.charAt(0).toUpperCase()}
                                            </div>
                                            <div className="cp-comment-content">
                                                <div className="cp-comment-header">
                                                    <strong>{c.userEmail.split('@')[0]}</strong>
                                                    <span className="cp-official-badge">📢 Official Response</span>
                                                    <span>{formatDate(c.createdAt)}</span>
                                                </div>
                                                <div className="cp-comment-text">
                                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{c.body}</ReactMarkdown>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </>
                            ) : null}

                            <h3 className="cp-detail-section-heading">Comments ({detailComments.filter((c) => !c.isOfficial).length})</h3>
                            {detailLoading ? <p className="cp-muted">Loading comments...</p> : null}
                            {detailComments.filter((c) => !c.isOfficial).length === 0 && !detailLoading ? (
                                <p className="cp-muted">No comments yet. Be the first to share your thoughts!</p>
                            ) : null}
                            {detailComments.map((c) => {
                                // Recursive render inner function
                                const renderCommentNode = (node: IdeaComment, depth = 0) => {
                                    if (node.isOfficial && depth === 0) return null; // officials rendered above at depth 0
                                    return (
                                        <div className={`cp-comment-thread ${depth > 0 ? 'cp-comment-reply' : ''}`} key={node.id}>
                                            <div className={`cp-comment ${node.isTeamMember ? 'cp-team-comment' : ''}`}>
                                                <div className="cp-comment-avatar">
                                                    {node.userEmail.charAt(0).toUpperCase()}
                                                </div>
                                                <div className="cp-comment-content">
                                                    <div className="cp-comment-header">
                                                        <strong>{node.userEmail.split('@')[0]}</strong>
                                                        {node.isTeamMember ? <span className="cp-team-badge">Team</span> : null}
                                                        {node.isInternal ? <span className="cp-internal-badge" style={{ background: '#fef3c7', color: '#b45309', padding: '2px 6px', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 'bold' }}>🔒 Internal</span> : null}
                                                        <span>{formatDate(node.createdAt)}</span>
                                                    </div>
                                                    <div className="cp-comment-text">
                                                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{node.body}</ReactMarkdown>
                                                        {node.attachments && node.attachments.length > 0 ? (
                                                            <div className="cp-attachments-list" style={{ marginTop: '8px' }}>
                                                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                                                    {node.attachments.map(att => (
                                                                        <a key={att.id} href={att.fileUrl} target="_blank" rel="noopener noreferrer" className="cp-attachment-link" style={{ padding: '4px 8px', background: 'var(--cv-bg-hover)', borderRadius: '4px', fontSize: '0.75rem', color: 'var(--cv-subtle)', textDecoration: 'none', border: '1px solid var(--cv-border)' }}>
                                                                            📎 {att.fileName}
                                                                        </a>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        ) : null}
                                                    </div>
                                                    <div className="cp-comment-actions">
                                                        <button
                                                            className={`cp-comment-action-btn ${node.viewerHasUpvoted ? 'active' : ''}`}
                                                            onClick={() => void onToggleCommentUpvote(node)}
                                                        >
                                                            ▲ {node.upvoteCount || 0}
                                                        </button>
                                                        {settings.enableCommenting && depth < 2 ? (
                                                            <button
                                                                className="cp-comment-action-btn"
                                                                onClick={() => setReplyingTo(node)}
                                                            >
                                                                Reply
                                                            </button>
                                                        ) : null}
                                                    </div>
                                                </div>
                                            </div>
                                            {node.replies && node.replies.length > 0 ? (
                                                <div className="cp-comment-replies">
                                                    {node.replies.map((reply) => renderCommentNode(reply, depth + 1))}
                                                </div>
                                            ) : null}
                                        </div>
                                    );
                                };
                                return renderCommentNode(c, 0);
                            })}

                            {/* ── Comment Input ── */}
                            {settings.enableCommenting ? (
                                <div className="cp-comment-input-section" ref={(el) => {
                                    if (el && replyingTo) el.scrollIntoView({ behavior: 'smooth' });
                                }}>
                                    {replyingTo ? (
                                        <div className="cp-replying-to">
                                            Replying to {replyingTo.userEmail.split('@')[0]}
                                            <button onClick={() => setReplyingTo(null)}>✕</button>
                                        </div>
                                    ) : null}
                                    <div className="cp-comment-input-wrapper">
                                        <textarea
                                            className="cp-comment-textarea"
                                            value={commentBody}
                                            onChange={(e) => setCommentBody(e.target.value)}
                                            placeholder={
                                                settings.requireAuthToComment && !portalUser
                                                    ? 'Sign in to comment...'
                                                    : 'Write your thoughts...'
                                            }
                                            rows={3}
                                            disabled={commentBusy}
                                        />
                                        <div style={{ padding: '8px 12px', borderTop: '1px solid var(--cv-border)', background: 'var(--cv-bg-hover)', display: 'flex', alignItems: 'center', borderBottomLeftRadius: '8px', borderBottomRightRadius: '24px', justifyContent: 'space-between' }}>
                                            <label style={{ fontSize: '0.75rem', color: 'var(--cv-subtle)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                📎 <input type="file" onChange={(e) => setCommentFile(e.target.files?.[0] || null)} style={{ fontSize: '0.75rem', width: '200px' }} />
                                            </label>
                                            {portalUser?.email?.endsWith('@customervoice.com') ? (
                                                <label style={{ fontSize: '0.75rem', color: 'var(--cv-subtle)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    <input type="checkbox" checked={isInternal} onChange={(e) => setIsInternal(e.target.checked)} />
                                                    🔒 Internal Note
                                                </label>
                                            ) : null}
                                        </div>
                                        <button
                                            className="cp-comment-post-btn"
                                            onClick={() => void onPostComment()}
                                            disabled={commentBusy || commentBody.trim().length < 2}
                                        >
                                            {commentBusy ? 'Posting...' : 'Post ➤'}
                                        </button>
                                    </div>
                                    {settings.requireAuthToComment && !portalUser ? (
                                        <p className="cp-auth-hint" onClick={() => setShowAuthModal(true)}>
                                            💬 <strong>Sign in</strong> to join the conversation
                                        </p>
                                    ) : null}
                                </div>
                            ) : null}
                        </div>
                    </aside>
                </>
            ) : null}

            {/* ── Password Reset Modal ── */}
            {resetToken && !resetSuccess ? (
                <>
                    <div className="cp-overlay cp-modal-overlay" />
                    <div className="cp-modal cp-auth-modal">
                        <h2>Set New Password</h2>
                        <form onSubmit={handlePasswordReset}>
                            <div className="cp-form-group">
                                <label>New Password</label>
                                <input
                                    type="password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    placeholder="••••••••"
                                    required
                                    minLength={6}
                                />
                            </div>
                            {resetError && <div className="cp-auth-error">{resetError}</div>}
                            <button
                                type="submit"
                                className="cp-auth-submit"
                                disabled={resetBusy}
                            >
                                {resetBusy ? 'Updating...' : 'Update Password'}
                            </button>
                        </form>
                    </div>
                </>
            ) : null}

            {resetSuccess ? (
                <>
                    <div className="cp-overlay cp-modal-overlay" onClick={() => setResetSuccess(false)} />
                    <div className="cp-modal cp-auth-modal">
                        <h2>Password Updated</h2>
                        <p className="cp-modal-subtitle">Your password has been successfully reset.</p>
                        <button
                            className="cp-auth-submit"
                            style={{ marginTop: '20px' }}
                            onClick={() => {
                                setResetSuccess(false);
                                setResetToken(null);
                                setAuthMode('login');
                                setShowAuthModal(true);
                            }}
                        >
                            Sign In Now
                        </button>
                    </div>
                </>
            ) : null}

            {/* ── Auth Modal ── */}
            {showAuthModal ? (
                <>
                    <div className="cp-overlay cp-modal-overlay" onClick={() => { setShowAuthModal(false); setPendingAction(null); setSsoError(null); }} />
                    <div className="cp-modal cp-auth-modal">
                        <button className="cp-modal-close" onClick={() => { setShowAuthModal(false); setPendingAction(null); setSsoError(null); }}>✕</button>
                        <h2>{authMode === 'register' ? 'Create Account' : authMode === 'forgot-password' ? 'Reset Password' : 'Sign In'}</h2>
                        <p className="cp-modal-subtitle">
                            {authMode === 'register'
                                ? 'Join the conversation and submit your ideas'
                                : authMode === 'forgot-password'
                                    ? 'Enter your email to receive a reset link'
                                    : 'Sign in to vote, comment, and submit ideas'}
                        </p>

                        <form onSubmit={handleAuthSubmit}>
                            {authMode === 'register' ? (
                                <div className="cp-form-group">
                                    <label>Display Name</label>
                                    <input
                                        type="text"
                                        value={authDisplayName}
                                        onChange={(e) => setAuthDisplayName(e.target.value)}
                                        placeholder="John Doe"
                                    />
                                </div>
                            ) : null}
                            <div className="cp-form-group">
                                <label>Email</label>
                                <input
                                    type="email"
                                    value={authEmail}
                                    onChange={(e) => setAuthEmail(e.target.value)}
                                    placeholder="you@company.com"
                                    required
                                />
                            </div>
                            {authMode !== 'forgot-password' && (
                                <div className="cp-form-group">
                                    <label>Password</label>
                                    <input
                                        type="password"
                                        value={authPassword}
                                        onChange={(e) => setAuthPassword(e.target.value)}
                                        placeholder="••••••••"
                                        required
                                        minLength={6}
                                    />
                                    {authMode === 'login' && (
                                        <div className="cp-forgot-pwd-link">
                                            <button type="button" onClick={() => { setAuthMode('forgot-password'); setAuthError(null); setAuthSuccess(null); }}>
                                                Forgot Password?
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}

                            {authError ? (
                                <div className="cp-auth-error">{authError}</div>
                            ) : null}
                            {authSuccess ? (
                                <div className="cp-auth-success" style={{ color: 'var(--cv-mint)', fontSize: '0.9rem', marginBottom: '16px' }}>
                                    {authSuccess}
                                </div>
                            ) : null}

                            <button
                                type="submit"
                                className="cp-auth-submit"
                                disabled={authBusy}
                            >
                                {authBusy ? 'Please wait...' : authMode === 'register' ? 'Create Account' : authMode === 'forgot-password' ? 'Send Reset Link' : 'Sign In'}
                            </button>
                        </form>

                        {authMode !== 'forgot-password' && (
                            <div className="cp-social-auth-stubs" style={{ marginTop: '24px' }}>
                                <div className="cp-auth-divider" style={{ display: 'flex', alignItems: 'center', textAlign: 'center', margin: '16px 0', color: 'var(--cv-subtle)', fontSize: '0.85rem' }}>
                                    <div style={{ flex: 1, borderBottom: '1px solid var(--cv-border)' }}></div>
                                    <span style={{ padding: '0 10px' }}>OR</span>
                                    <div style={{ flex: 1, borderBottom: '1px solid var(--cv-border)' }}></div>
                                </div>
                                <div style={{ display: 'flex', gap: '12px', flexDirection: 'column' }}>
                                    <button
                                        type="button"
                                        className="hero-button ghost"
                                        onClick={() => {
                                            rememberPostAuthPath();
                                            window.location.href = `${apiBase}/public/auth/google`;
                                        }}
                                        style={{ width: '100%' }}
                                    >
                                        Continue with Google
                                    </button>
                                    <button
                                        type="button"
                                        className="hero-button ghost"
                                        onClick={() => {
                                            rememberPostAuthPath();
                                            window.location.href = `${apiBase}/public/auth/github`;
                                        }}
                                        style={{ width: '100%' }}
                                    >
                                        Continue with GitHub
                                    </button>
                                </div>
                            </div>
                        )}

                        {authMode !== 'forgot-password' && isDomainRestrictedBoard ? (
                            <div style={{ marginTop: '20px' }}>
                                <div className="cp-auth-divider" style={{ display: 'flex', alignItems: 'center', textAlign: 'center', margin: '16px 0', color: 'var(--cv-subtle)', fontSize: '0.85rem' }}>
                                    <div style={{ flex: 1, borderBottom: '1px solid var(--cv-border)' }}></div>
                                    <span style={{ padding: '0 10px' }}>WORKSPACE SSO</span>
                                    <div style={{ flex: 1, borderBottom: '1px solid var(--cv-border)' }}></div>
                                </div>
                                <div className="cp-form-group">
                                    <label>Work Email or Company Domain</label>
                                    <input
                                        type="text"
                                        value={ssoDomainInput}
                                        onChange={(e) => setSsoDomainInput(e.target.value)}
                                        placeholder="you@company.com or company.com"
                                    />
                                </div>
                                {ssoError ? (
                                    <div className="cp-auth-error">{ssoError}</div>
                                ) : null}
                                <button
                                    type="button"
                                    className="hero-button ghost"
                                    style={{ width: '100%' }}
                                    onClick={handleSsoSignIn}
                                >
                                    Continue with SSO
                                </button>
                            </div>
                        ) : null}

                        <div className="cp-auth-switch">
                            {authMode === 'login' ? (
                                <p>Don't have an account? <button onClick={() => { setAuthMode('register'); setAuthError(null); setAuthSuccess(null); }}>Sign Up</button></p>
                            ) : (
                                <p>{authMode === 'forgot-password' ? 'Remember your password?' : 'Already have an account?'} <button onClick={() => { setAuthMode('login'); setAuthError(null); setAuthSuccess(null); }}>Sign In</button></p>
                            )}
                        </div>

                        <div className="cp-auth-legal" style={{ marginTop: '20px', textAlign: 'center', fontSize: '0.75rem', color: 'var(--cv-subtle)' }}>
                            By continuing, you agree to our <a href="#" style={{ textDecoration: 'underline' }}>Terms of Service</a> and <a href="#" style={{ textDecoration: 'underline' }}>Privacy Policy</a>.
                        </div>
                    </div>
                </>
            ) : null}

            {/* ── Submit Idea Modal ── */}
            {showSubmitModal ? (
                <>
                    <div className="cp-overlay cp-modal-overlay" onClick={() => setShowSubmitModal(false)} />
                    <div className="cp-modal cp-submit-modal">
                        <button className="cp-modal-close" onClick={() => setShowSubmitModal(false)}>✕</button>
                        <h2>💡 Submit a New Idea</h2>
                        <p className="cp-modal-subtitle">Share your idea with the team</p>

                        <div className="cp-form-group">
                            <label>Title</label>
                            <input
                                type="text"
                                value={submitTitle}
                                onChange={(e) => setSubmitTitle(e.target.value)}
                                placeholder="E.g. Dark mode for the dashboard"
                                maxLength={180}
                            />
                        </div>

                        {similarIdeas.length > 0 ? (
                            <div className="cp-similar-ideas">
                                <p className="cp-similar-label">🔍 Similar ideas found — vote instead?</p>
                                {similarIdeas.map((si) => (
                                    <button
                                        key={si.id}
                                        className="cp-similar-item"
                                        onClick={() => {
                                            setShowSubmitModal(false);
                                            void loadIdeaDetail(si.id);
                                        }}
                                    >
                                        <span className="cp-similar-title">{si.title}</span>
                                        <span className="cp-similar-votes">▲ {si.voteCount}</span>
                                    </button>
                                ))}
                            </div>
                        ) : null}

                        <div className="cp-form-group">
                            <label>Description</label>
                            <textarea
                                value={submitDescription}
                                onChange={(e) => setSubmitDescription(e.target.value)}
                                placeholder="Describe your idea in detail. What problem does it solve?"
                                rows={5}
                                maxLength={8000}
                            />
                        </div>

                        <div className="cp-form-group">
                            <label>Attachment (optional)</label>
                            <input
                                type="file"
                                onChange={(e) => setSubmitFile(e.target.files?.[0] || null)}
                                style={{ fontSize: '0.85rem' }}
                            />
                        </div>

                        {categories.length > 0 ? (
                            <div className="cp-form-group">
                                <label>Category (optional)</label>
                                <select
                                    value={submitCategory}
                                    onChange={(e) => setSubmitCategory(e.target.value)}
                                >
                                    <option value="">Select a category</option>
                                    {categories.map((cat) => (
                                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                                    ))}
                                </select>
                            </div>
                        ) : null}

                        {submitError ? (
                            <div className="cp-auth-error">{submitError}</div>
                        ) : null}

                        <div className="cp-modal-actions">
                            <button
                                className="cp-modal-cancel"
                                onClick={() => setShowSubmitModal(false)}
                            >
                                Cancel
                            </button>
                            <button
                                className="cp-modal-submit"
                                onClick={() => void onSubmitIdea()}
                                disabled={submitBusy || submitTitle.trim().length < 4 || submitDescription.trim().length < 8}
                            >
                                {submitBusy ? 'Submitting...' : 'Submit Idea'}
                            </button>
                        </div>
                    </div>
                </>
            ) : null}
        </div>
    );
}
